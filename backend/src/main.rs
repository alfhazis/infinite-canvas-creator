use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod error;
mod handlers;
mod middleware;
mod models;
mod routes;
mod state;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "canvas_ide_backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = config::Config::from_env()?;

    let pool = PgPoolOptions::new()
        .max_connections(cfg.db_max_connections)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&cfg.database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    let app_state = state::AppState::new(pool, cfg.clone());

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = routes::build_router(app_state)
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    let addr = format!("{}:{}", cfg.host, cfg.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Listening on {}", addr);

    axum::serve(listener, app).await?;
    Ok(())
}
