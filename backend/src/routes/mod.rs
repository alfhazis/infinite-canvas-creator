use axum::{
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::json;

use crate::{
    handlers::{ai_proxy, auth, projects, variations},
    state::AppState,
};

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/refresh", post(auth::refresh))
        .route("/api/auth/logout", post(auth::logout))
        .route(
            "/api/projects",
            get(projects::list_projects).post(projects::create_project),
        )
        .route(
            "/api/projects/:id",
            get(projects::get_project)
                .put(projects::update_project)
                .delete(projects::delete_project),
        )
        .route(
            "/api/projects/:id/canvas",
            get(projects::load_canvas).put(projects::save_canvas),
        )
        .route(
            "/api/projects/:id/variations",
            get(variations::list_variations).post(variations::save_variations),
        )
        .route(
            "/api/projects/:id/variations/:vid",
            delete(variations::delete_variation),
        )
        .route("/api/ai/complete", post(ai_proxy::complete))
        .route("/api/ai/models", get(ai_proxy::list_models))
        .route(
            "/api/ai/key",
            put(ai_proxy::save_key).delete(ai_proxy::delete_key),
        )
        .with_state(state)
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
