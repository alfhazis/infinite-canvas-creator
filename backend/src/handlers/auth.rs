use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, Json};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    models::user::{AuthResponse, LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest, UserResponse},
    state::AppState,
};

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: i64,
    iat: i64,
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    if req.email.is_empty() || req.password.is_empty() {
        return Err(AppError::Validation("Email and password are required".into()));
    }

    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_one(&state.db)
        .await?;

    if existing > 0 {
        return Err(AppError::Conflict("Email already registered".into()));
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Hash error: {e}")))?
        .to_string();

    let user_id = Uuid::new_v4();
    let display_name = req
        .display_name
        .unwrap_or_else(|| req.email.split('@').next().unwrap_or("User").to_string());

    sqlx::query(
        "INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4)",
    )
    .bind(user_id)
    .bind(&req.email)
    .bind(&hash)
    .bind(&display_name)
    .execute(&state.db)
    .await?;

    let (access_token, refresh_token) = issue_tokens(&state, user_id).await?;

    Ok(Json(AuthResponse {
        access_token,
        refresh_token,
        user: UserResponse {
            id: user_id,
            email: req.email,
            display_name,
            created_at: Utc::now(),
        },
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    let row = sqlx::query_as::<_, crate::models::user::User>("SELECT * FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let hash = row.password_hash.as_deref().ok_or(AppError::Unauthorized)?;
    let parsed = PasswordHash::new(hash).map_err(|_| AppError::Unauthorized)?;
    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed)
        .map_err(|_| AppError::Unauthorized)?;

    let (access_token, refresh_token) = issue_tokens(&state, row.id).await?;

    Ok(Json(AuthResponse {
        access_token,
        refresh_token,
        user: row.into(),
    }))
}

pub async fn refresh(
    State(state): State<AppState>,
    Json(req): Json<RefreshRequest>,
) -> Result<Json<AuthResponse>> {
    let token_hash = sha256_hex(&req.refresh_token);

    let row = sqlx::query_as::<_, (Uuid, chrono::DateTime<Utc>)>(
        "SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = $1",
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let (user_id, expires_at) = row;
    if expires_at < Utc::now() {
        return Err(AppError::Unauthorized);
    }

    sqlx::query("DELETE FROM refresh_tokens WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(&state.db)
        .await?;

    let user = sqlx::query_as::<_, crate::models::user::User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let (access_token, new_refresh_token) = issue_tokens(&state, user_id).await?;

    Ok(Json(AuthResponse {
        access_token,
        refresh_token: new_refresh_token,
        user: user.into(),
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    Json(req): Json<LogoutRequest>,
) -> Result<Json<serde_json::Value>> {
    let token_hash = sha256_hex(&req.refresh_token);
    sqlx::query("DELETE FROM refresh_tokens WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Logged out" })))
}

async fn issue_tokens(state: &AppState, user_id: Uuid) -> Result<(String, String)> {
    let now = Utc::now();

    let claims = Claims {
        sub: user_id.to_string(),
        iat: now.timestamp(),
        exp: (now + Duration::seconds(state.cfg.jwt_expiry_secs as i64)).timestamp(),
    };
    let access_token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.cfg.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("JWT encode error: {e}")))?;

    let raw_refresh = Uuid::new_v4().to_string();
    let token_hash = sha256_hex(&raw_refresh);
    let expires_at = now + Duration::seconds(state.cfg.refresh_expiry_secs as i64);

    sqlx::query(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    )
    .bind(user_id)
    .bind(&token_hash)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    Ok((access_token, raw_refresh))
}

pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}
