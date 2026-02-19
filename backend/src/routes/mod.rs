use axum::{
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use serde_json::json;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::{
    handlers::{ai_proxy, auth, nodes, projects, variations},
    models::{
        canvas_node::{
            BulkCanvasSave, CanvasNodeResponse, CanvasState, ConnectNodesRequest,
            CreateNodeRequest, DisconnectNodesRequest, ElementLink, NodePlatform, NodeStatus,
            NodeType, UpdateNodeRequest,
        },
        project::{CreateProjectRequest, Project, UpdateProjectRequest},
        ui_variation::{SaveVariationsRequest, UiVariation, VariationCategory, VariationPayload},
        user::{
            AuthResponse, LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest,
            UserResponse,
        },
    },
    state::AppState,
};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Canvas IDE API",
        version = "0.1.0",
        description = "AI-powered visual development workflow backend",
    ),
    paths(
        nodes::list_nodes,
        nodes::create_node,
        nodes::get_node,
        nodes::update_node,
        nodes::delete_node,
        nodes::duplicate_node,
        nodes::list_connections,
        nodes::connect_nodes,
        nodes::disconnect_nodes,
        nodes::remove_element_link,
    ),
    components(
        schemas(
            CanvasNodeResponse,
            CreateNodeRequest,
            UpdateNodeRequest,
            ConnectNodesRequest,
            DisconnectNodesRequest,
            BulkCanvasSave,
            CanvasState,
            NodeType,
            NodeStatus,
            NodePlatform,
            ElementLink,
            Project,
            CreateProjectRequest,
            UpdateProjectRequest,
            UiVariation,
            SaveVariationsRequest,
            VariationPayload,
            VariationCategory,
            UserResponse,
            AuthResponse,
            LoginRequest,
            RegisterRequest,
            RefreshRequest,
            LogoutRequest,
        )
    ),
    security(
        ("bearer_auth" = [])
    ),
    modifiers(&SecurityAddon),
)]
pub struct ApiDoc;

struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
            components.add_security_scheme(
                "bearer_auth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .merge(SwaggerUi::new("/api/docs").url("/api/openapi.json", ApiDoc::openapi()))
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
            "/api/projects/:id/nodes",
            get(nodes::list_nodes).post(nodes::create_node),
        )
        .route(
            "/api/projects/:id/nodes/:client_id",
            get(nodes::get_node)
                .patch(nodes::update_node)
                .delete(nodes::delete_node),
        )
        .route(
            "/api/projects/:id/nodes/:client_id/duplicate",
            post(nodes::duplicate_node),
        )
        .route(
            "/api/projects/:id/connections",
            get(nodes::list_connections)
                .post(nodes::connect_nodes)
                .delete(nodes::disconnect_nodes),
        )
        .route(
            "/api/projects/:id/nodes/:client_id/element-links/:target_id",
            delete(nodes::remove_element_link),
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
