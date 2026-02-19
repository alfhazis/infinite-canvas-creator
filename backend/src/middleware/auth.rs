use axum::{
    async_trait,
    extract::FromRequestParts,
    http::request::Parts,
    RequestPartsExt,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: i64,
    iat: i64,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|_| AppError::Unauthorized)?;

        let token_data = decode::<Claims>(
            bearer.token(),
            &DecodingKey::from_secret(state.cfg.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|_| AppError::Unauthorized)?;

        let user_id = token_data
            .claims
            .sub
            .parse::<Uuid>()
            .map_err(|_| AppError::Unauthorized)?;

        Ok(AuthUser { user_id })
    }
}
