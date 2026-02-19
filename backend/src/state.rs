use reqwest::Client;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub cfg: Config,
    pub http: Client,
    pub model_cache: Arc<RwLock<Option<ModelCache>>>,
}

#[derive(Clone)]
pub struct ModelCache {
    pub models: Vec<serde_json::Value>,
    pub fetched_at: Instant,
}

impl AppState {
    pub fn new(db: PgPool, cfg: Config) -> Self {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .user_agent("canvas-ide-backend/0.1.0")
            .build()
            .expect("Failed to build reqwest client");

        Self {
            db,
            cfg,
            http,
            model_cache: Arc::new(RwLock::new(None)),
        }
    }
}
