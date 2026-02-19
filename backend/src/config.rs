use anyhow::Context;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiry_secs: u64,
    pub refresh_expiry_secs: u64,
    pub host: String,
    pub port: u16,
    pub db_max_connections: u32,
    pub openrouter_fallback_key: Option<String>,
    pub openrouter_base_url: String,
    pub api_key_encryption_secret: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?,
            jwt_secret: std::env::var("JWT_SECRET").context("JWT_SECRET must be set")?,
            jwt_expiry_secs: std::env::var("JWT_EXPIRY_SECS")
                .unwrap_or_else(|_| "900".to_string())
                .parse()?,
            refresh_expiry_secs: std::env::var("REFRESH_EXPIRY_SECS")
                .unwrap_or_else(|_| "2592000".to_string())
                .parse()?,
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()?,
            db_max_connections: std::env::var("DB_MAX_CONNECTIONS")
                .unwrap_or_else(|_| "10".into())
                .parse()?,
            openrouter_fallback_key: std::env::var("OPENROUTER_FALLBACK_KEY").ok(),
            openrouter_base_url: std::env::var("OPENROUTER_BASE_URL")
                .unwrap_or_else(|_| "https://openrouter.ai/api/v1".into()),
            api_key_encryption_secret: std::env::var("API_KEY_ENCRYPTION_SECRET")
                .context("API_KEY_ENCRYPTION_SECRET must be set")?,
        })
    }
}
