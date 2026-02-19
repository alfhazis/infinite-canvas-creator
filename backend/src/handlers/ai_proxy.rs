use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use axum::{extract::State, Json};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

use crate::{
    error::{AppError, Result},
    middleware::auth::AuthUser,
    state::{AppState, ModelCache},
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionRequest {
    pub model: String,
    pub prompt: String,
    pub system_prompt: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionResponse {
    pub content: String,
    pub model: String,
    pub usage: Option<Value>,
}

pub async fn complete(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CompletionRequest>,
) -> Result<Json<CompletionResponse>> {
    let api_key = resolve_api_key(&state, auth.user_id)
        .await?
        .ok_or_else(|| {
            AppError::Validation(
                "No OpenRouter API key configured. Set your key in Settings.".into(),
            )
        })?;

    let mut messages: Vec<Value> = vec![];
    if let Some(sys) = &req.system_prompt {
        messages.push(json!({ "role": "system", "content": sys }));
    }
    messages.push(json!({ "role": "user", "content": req.prompt }));

    let body = json!({
        "model": req.model,
        "messages": messages,
    });

    let or_resp = state
        .http
        .post(format!("{}/chat/completions", state.cfg.openrouter_base_url))
        .bearer_auth(&api_key)
        .header("HTTP-Referer", "https://canvas-ide.app")
        .header("X-Title", "Infinite Canvas IDE")
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::OpenRouter(format!("Request failed: {e}")))?;

    if !or_resp.status().is_success() {
        let status = or_resp.status();
        let err_body: Value = or_resp.json().await.unwrap_or_default();
        let msg = err_body["error"]["message"]
            .as_str()
            .unwrap_or("Unknown error");
        return Err(AppError::OpenRouter(format!(
            "OpenRouter error {status}: {msg}"
        )));
    }

    let data: Value = or_resp
        .json()
        .await
        .map_err(|e| AppError::OpenRouter(format!("Parse error: {e}")))?;

    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let model = data["model"]
        .as_str()
        .unwrap_or(&req.model)
        .to_string();

    Ok(Json(CompletionResponse {
        content,
        model,
        usage: data.get("usage").cloned(),
    }))
}

pub async fn list_models(State(state): State<AppState>) -> Result<Json<Value>> {
    const CACHE_TTL: Duration = Duration::from_secs(600);

    {
        let cache_read = state.model_cache.read().await;
        if let Some(ref cached) = *cache_read {
            if cached.fetched_at.elapsed() < CACHE_TTL {
                return Ok(Json(json!({ "data": cached.models })));
            }
        }
    }

    let resp = state
        .http
        .get(format!("{}/models", state.cfg.openrouter_base_url))
        .send()
        .await
        .map_err(|e| AppError::OpenRouter(format!("Failed to fetch models: {e}")))?;

    let data: Value = resp
        .json()
        .await
        .map_err(|e| AppError::OpenRouter(format!("Failed to parse models: {e}")))?;

    let models = data["data"].as_array().cloned().unwrap_or_default();

    {
        let mut cache_write = state.model_cache.write().await;
        *cache_write = Some(ModelCache {
            models: models.clone(),
            fetched_at: Instant::now(),
        });
    }

    Ok(Json(json!({ "data": models })))
}

#[derive(Debug, Deserialize)]
pub struct SaveKeyRequest {
    pub key: String,
}

pub async fn save_key(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<SaveKeyRequest>,
) -> Result<Json<Value>> {
    if req.key.is_empty() {
        return Err(AppError::Validation("API key cannot be empty".into()));
    }

    let encrypted = encrypt_api_key(&req.key, &state.cfg.api_key_encryption_secret)?;

    sqlx::query(
        "INSERT INTO user_api_keys (user_id, provider, encrypted_key)
         VALUES ($1, 'openrouter', $2)
         ON CONFLICT (user_id, provider) DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, updated_at = NOW()",
    )
    .bind(auth.user_id)
    .bind(&encrypted)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "message": "API key saved" })))
}

pub async fn delete_key(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Value>> {
    sqlx::query(
        "DELETE FROM user_api_keys WHERE user_id = $1 AND provider = 'openrouter'",
    )
    .bind(auth.user_id)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "message": "API key removed" })))
}

async fn resolve_api_key(state: &AppState, user_id: uuid::Uuid) -> Result<Option<String>> {
    let row = sqlx::query_scalar::<_, Option<String>>(
        "SELECT encrypted_key FROM user_api_keys WHERE user_id = $1 AND provider = 'openrouter'",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    if let Some(Some(encrypted)) = row {
        let key = decrypt_api_key(&encrypted, &state.cfg.api_key_encryption_secret)?;
        return Ok(Some(key));
    }

    Ok(state.cfg.openrouter_fallback_key.clone())
}

fn derive_key(secret: &str) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    let hash = Sha256::digest(secret.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash);
    key
}

fn encrypt_api_key(key: &str, secret: &str) -> Result<String> {
    let cipher_key = derive_key(secret);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&cipher_key));

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, key.as_bytes())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Encryption error: {e}")))?;

    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(combined))
}

fn decrypt_api_key(encrypted: &str, secret: &str) -> Result<String> {
    let data = BASE64
        .decode(encrypted)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Base64 decode error: {e}")))?;

    if data.len() < 12 {
        return Err(AppError::Internal(anyhow::anyhow!("Invalid encrypted data")));
    }

    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher_key = derive_key(secret);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&cipher_key));

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Decryption error: {e}")))?;

    String::from_utf8(plaintext)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("UTF-8 decode error: {e}")))
}
