use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    middleware::auth::AuthUser,
    models::{
        canvas_node::{BulkCanvasSave, CanvasNode, CanvasNodeResponse, CanvasState, NodeStatus},
        project::{CreateProjectRequest, Project, UpdateProjectRequest},
    },
    state::AppState,
};

pub async fn list_projects(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Project>>> {
    let projects = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(projects))
}

pub async fn create_project(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateProjectRequest>,
) -> Result<Json<Project>> {
    let project = sqlx::query_as::<_, Project>(
        "INSERT INTO projects (user_id, name, description, ai_model)
         VALUES ($1, $2, $3, $4)
         RETURNING *",
    )
    .bind(auth.user_id)
    .bind(&req.name)
    .bind(req.description.as_deref().unwrap_or(""))
    .bind(req.ai_model.as_deref().unwrap_or("auto"))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(project))
}

pub async fn get_project(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Project>> {
    let project = get_owned_project(&state, auth.user_id, project_id).await?;
    Ok(Json(project))
}

pub async fn update_project(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<UpdateProjectRequest>,
) -> Result<Json<Project>> {
    let project = sqlx::query_as::<_, Project>(
        "UPDATE projects SET
            name        = COALESCE($3, name),
            description = COALESCE($4, description),
            zoom        = COALESCE($5, zoom),
            pan_x       = COALESCE($6, pan_x),
            pan_y       = COALESCE($7, pan_y),
            ai_model    = COALESCE($8, ai_model)
         WHERE id = $1 AND user_id = $2
         RETURNING *",
    )
    .bind(project_id)
    .bind(auth.user_id)
    .bind(req.name)
    .bind(req.description)
    .bind(req.zoom)
    .bind(req.pan_x)
    .bind(req.pan_y)
    .bind(req.ai_model)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Project {project_id} not found")))?;

    Ok(Json(project))
}

pub async fn delete_project(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Value>> {
    let rows = sqlx::query("DELETE FROM projects WHERE id = $1 AND user_id = $2")
        .bind(project_id)
        .bind(auth.user_id)
        .execute(&state.db)
        .await?
        .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound(format!("Project {project_id} not found")));
    }
    Ok(Json(json!({ "message": "Project deleted" })))
}

pub async fn save_canvas(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<BulkCanvasSave>,
) -> Result<Json<Value>> {
    let _ = get_owned_project(&state, auth.user_id, project_id).await?;

    let mut tx = state.db.begin().await?;

    if req.zoom.is_some() || req.pan_x.is_some() || req.pan_y.is_some() {
        sqlx::query(
            "UPDATE projects SET
                zoom  = COALESCE($2, zoom),
                pan_x = COALESCE($3, pan_x),
                pan_y = COALESCE($4, pan_y)
             WHERE id = $1",
        )
        .bind(project_id)
        .bind(req.zoom)
        .bind(req.pan_x)
        .bind(req.pan_y)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query("DELETE FROM canvas_nodes WHERE project_id = $1")
        .bind(project_id)
        .execute(&mut *tx)
        .await?;

    for node in &req.nodes {
        let element_links =
            serde_json::to_value(node.element_links.as_deref().unwrap_or(&[])).unwrap_or_default();
        let empty_map = std::collections::HashMap::<String, String>::new();
        let env_vars = serde_json::to_value(node.env_vars.as_ref().unwrap_or(&empty_map))
            .unwrap_or_default();

        sqlx::query(
            "INSERT INTO canvas_nodes
             (project_id, client_id, node_type, title, description, x, y, width, height,
              status, content, file_name, generated_code, picked, parent_id, page_role,
              tag, platform, language, ai_model, element_links, env_vars)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)",
        )
        .bind(project_id)
        .bind(&node.client_id)
        .bind(&node.node_type)
        .bind(&node.title)
        .bind(&node.description)
        .bind(node.x)
        .bind(node.y)
        .bind(node.width)
        .bind(node.height)
        .bind(node.status.as_ref().unwrap_or(&NodeStatus::Idle))
        .bind(&node.content)
        .bind(&node.file_name)
        .bind(&node.generated_code)
        .bind(node.picked.unwrap_or(false))
        .bind(&node.parent_id)
        .bind(&node.page_role)
        .bind(&node.tag)
        .bind(&node.platform)
        .bind(&node.language)
        .bind(&node.ai_model)
        .bind(element_links)
        .bind(env_vars)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query("DELETE FROM node_connections WHERE project_id = $1")
        .bind(project_id)
        .execute(&mut *tx)
        .await?;

    for [from, to] in &req.connections {
        sqlx::query(
            "INSERT INTO node_connections (project_id, from_client_id, to_client_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING",
        )
        .bind(project_id)
        .bind(from)
        .bind(to)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let node_count = req.nodes.len();
    Ok(Json(json!({ "message": "Canvas saved", "nodeCount": node_count })))
}

pub async fn load_canvas(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<CanvasState>> {
    let project = get_owned_project(&state, auth.user_id, project_id).await?;

    let nodes = sqlx::query_as::<_, CanvasNode>(
        "SELECT * FROM canvas_nodes WHERE project_id = $1 ORDER BY created_at ASC",
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;

    let conn_rows = sqlx::query_as::<_, (String, String)>(
        "SELECT from_client_id, to_client_id FROM node_connections WHERE project_id = $1",
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;

    let connections: Vec<[String; 2]> = conn_rows.into_iter().map(|(f, t)| [f, t]).collect();

    let mut connected_to_map: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for [from, to] in &connections {
        connected_to_map
            .entry(from.clone())
            .or_default()
            .push(to.clone());
    }

    let node_responses = nodes
        .into_iter()
        .map(|n| {
            let element_links: Vec<crate::models::canvas_node::ElementLink> =
                serde_json::from_value(n.element_links).unwrap_or_default();
            let env_vars: std::collections::HashMap<String, String> =
                serde_json::from_value(n.env_vars).unwrap_or_default();
            let connected_to = connected_to_map
                .get(&n.client_id)
                .cloned()
                .unwrap_or_default();

            CanvasNodeResponse {
                id: n.id,
                client_id: n.client_id,
                node_type: n.node_type,
                title: n.title,
                description: n.description,
                x: n.x,
                y: n.y,
                width: n.width,
                height: n.height,
                status: n.status,
                content: n.content,
                file_name: n.file_name,
                generated_code: n.generated_code,
                picked: n.picked,
                parent_id: n.parent_id,
                page_role: n.page_role,
                tag: n.tag,
                platform: n.platform,
                language: n.language,
                ai_model: n.ai_model,
                element_links,
                env_vars,
                connected_to,
                created_at: n.created_at,
                updated_at: n.updated_at,
            }
        })
        .collect();

    Ok(Json(CanvasState {
        nodes: node_responses,
        connections,
        zoom: project.zoom,
        pan_x: project.pan_x,
        pan_y: project.pan_y,
    }))
}

async fn get_owned_project(
    state: &AppState,
    user_id: Uuid,
    project_id: Uuid,
) -> Result<Project> {
    sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Project {project_id} not found")))
}
