use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    middleware::auth::AuthUser,
    models::canvas_node::{
        CanvasNode, CanvasNodeResponse, ConnectNodesRequest, CreateNodeRequest,
        DisconnectNodesRequest, ElementLink, NodeStatus, UpdateNodeRequest,
    },
    state::AppState,
};

/// List all nodes for a project
#[utoipa::path(
    get,
    path = "/api/projects/{project_id}/nodes",
    params(("project_id" = Uuid, Path, description = "Project UUID")),
    responses(
        (status = 200, description = "List of canvas nodes", body = Vec<CanvasNodeResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Project not found"),
    ),
    security(("bearer_auth" = []))
)]
pub async fn list_nodes(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<CanvasNodeResponse>>> {
    verify_project_owner(&state, auth.user_id, project_id).await?;

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

    let mut connected_to_map: HashMap<String, Vec<String>> = HashMap::new();
    for (from, to) in conn_rows {
        connected_to_map.entry(from).or_default().push(to);
    }

    let responses = nodes
        .into_iter()
        .map(|n| node_to_response(n, &connected_to_map))
        .collect();

    Ok(Json(responses))
}

/// Create a new node in a project
#[utoipa::path(
    post,
    path = "/api/projects/{project_id}/nodes",
    params(("project_id" = Uuid, Path, description = "Project UUID")),
    request_body = CreateNodeRequest,
    responses(
        (status = 201, description = "Created node", body = CanvasNodeResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Project not found"),
        (status = 409, description = "Node with this client_id already exists"),
    ),
    security(("bearer_auth" = []))
)]
pub async fn create_node(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<CreateNodeRequest>,
) -> Result<(StatusCode, Json<CanvasNodeResponse>)> {
    verify_project_owner(&state, auth.user_id, project_id).await?;

    let element_links =
        serde_json::to_value(req.element_links.as_deref().unwrap_or(&[])).unwrap_or_default();
    let empty_map = HashMap::<String, String>::new();
    let env_vars =
        serde_json::to_value(req.env_vars.as_ref().unwrap_or(&empty_map)).unwrap_or_default();

    let node = sqlx::query_as::<_, CanvasNode>(
        "INSERT INTO canvas_nodes
         (project_id, client_id, node_type, title, description, x, y, width, height,
          status, content, file_name, generated_code, picked, parent_id, page_role,
          tag, platform, language, ai_model, element_links, env_vars)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         RETURNING *",
    )
    .bind(project_id)
    .bind(&req.client_id)
    .bind(&req.node_type)
    .bind(&req.title)
    .bind(&req.description)
    .bind(req.x)
    .bind(req.y)
    .bind(req.width)
    .bind(req.height)
    .bind(req.status.as_ref().unwrap_or(&NodeStatus::Idle))
    .bind(&req.content)
    .bind(&req.file_name)
    .bind(&req.generated_code)
    .bind(req.picked.unwrap_or(false))
    .bind(&req.parent_id)
    .bind(&req.page_role)
    .bind(&req.tag)
    .bind(&req.platform)
    .bind(&req.language)
    .bind(&req.ai_model)
    .bind(element_links)
    .bind(env_vars)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint() == Some("canvas_nodes_project_id_client_id_key") {
                return AppError::Conflict(format!(
                    "Node '{}' already exists in this project",
                    req.client_id
                ));
            }
        }
        AppError::Database(e)
    })?;

    let connected_to = req.connected_to.clone().unwrap_or_default();

    if let Some(ref targets) = req.connected_to {
        for target_id in targets {
            sqlx::query(
                "INSERT INTO node_connections (project_id, from_client_id, to_client_id)
                 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            )
            .bind(project_id)
            .bind(&req.client_id)
            .bind(target_id)
            .execute(&state.db)
            .await?;
        }
    }

    let mut map = HashMap::new();
    map.insert(node.client_id.clone(), connected_to);
    Ok((StatusCode::CREATED, Json(node_to_response(node, &map))))
}

/// Get a single node by client_id
#[utoipa::path(
    get,
    path = "/api/projects/{project_id}/nodes/{client_id}",
    params(
        ("project_id" = Uuid, Path, description = "Project UUID"),
        ("client_id" = String, Path, description = "Frontend-generated node ID"),
    ),
    responses(
        (status = 200, description = "Canvas node", body = CanvasNodeResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_node(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, client_id)): Path<(Uuid, String)>,
) -> Result<Json<CanvasNodeResponse>> {
    verify_project_owner(&state, auth.user_id, project_id).await?;
    let node = fetch_node_response(&state, project_id, &client_id).await?;
    Ok(Json(node))
}

/// Update a node's fields (partial update)
#[utoipa::path(
    patch,
    path = "/api/projects/{project_id}/nodes/{client_id}",
    params(
        ("project_id" = Uuid, Path, description = "Project UUID"),
        ("client_id" = String, Path, description = "Frontend-generated node ID"),
    ),
    request_body = UpdateNodeRequest,
    responses(
        (status = 200, description = "Updated node", body = CanvasNodeResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
    ),
    security(("bearer_auth" = []))
)]
pub async fn update_node(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, client_id)): Path<(Uuid, String)>,
    Json(req): Json<UpdateNodeRequest>,
) -> Result<Json<CanvasNodeResponse>> {
    verify_project_owner(&state, auth.user_id, project_id).await?;

    let element_links_val = req
        .element_links
        .as_ref()
        .map(|v| serde_json::to_value(v).unwrap_or_default());
    let env_vars_val = req
        .env_vars
        .as_ref()
        .map(|v| serde_json::to_value(v).unwrap_or_default());

    sqlx::query(
        "UPDATE canvas_nodes SET
            title          = COALESCE($3, title),
            description    = COALESCE($4, description),
            x              = COALESCE($5, x),
            y              = COALESCE($6, y),
            width          = COALESCE($7, width),
            height         = COALESCE($8, height),
            status         = COALESCE($9, status),
            content        = COALESCE($10, content),
            file_name      = COALESCE($11, file_name),
            generated_code = COALESCE($12, generated_code),
            picked         = COALESCE($13, picked),
            page_role      = COALESCE($14, page_role),
            tag            = COALESCE($15, tag),
            platform       = COALESCE($16, platform),
            language       = COALESCE($17, language),
            ai_model       = COALESCE($18, ai_model),
            element_links  = COALESCE($19, element_links),
            env_vars       = COALESCE($20, env_vars)
         WHERE project_id = $1 AND client_id = $2",
    )
    .bind(project_id)
    .bind(&client_id)
    .bind(req.title.as_deref())
    .bind(req.description.as_deref())
    .bind(req.x)
    .bind(req.y)
    .bind(req.width)
    .bind(req.height)
    .bind(req.status.as_ref())
    .bind(req.content.as_deref())
    .bind(req.file_name.as_deref())
    .bind(req.generated_code.as_deref())
    .bind(req.picked)
    .bind(req.page_role.as_deref())
    .bind(req.tag.as_deref())
    .bind(req.platform.as_ref())
    .bind(req.language.as_deref())
    .bind(req.ai_model.as_deref())
    .bind(element_links_val)
    .bind(env_vars_val)
    .execute(&state.db)
    .await?;

    let node = fetch_node_response(&state, project_id, &client_id).await?;
    Ok(Json(node))
}

/// Delete a node (and its connections)
#[utoipa::path(
    delete,
    path = "/api/projects/{project_id}/nodes/{client_id}",
    params(
        ("project_id" = Uuid, Path, description = "Project UUID"),
        ("client_id" = String, Path, description = "Frontend-generated node ID"),
    ),
    responses(
        (status = 200, description = "Deleted successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
    ),
    security(("bearer_auth" = []))
)]
pub async fn delete_node(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, client_id)): Path<(Uuid, String)>,
) -> Result<Json<Value>> {
    verify_project_owner(&state, auth.user_id, project_id).await?;

    let rows = sqlx::query(
        "DELETE FROM canvas_nodes WHERE project_id = $1 AND client_id = $2",
    )
    .bind(project_id)
    .bind(&client_id)
    .execute(&state.db)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound(format!("Node '{client_id}' not found")));
    }

    Ok(Json(json!({ "message": "Node deleted" })))
}

/// Duplicate a node (copies data with new client_id, offset position)
#[utoipa::path(
    post,
    path = "/api/projects/{project_id}/nodes/{client_id}/duplicate",
    params(
        ("project_id" = Uuid, Path, description = "Project UUID"),
        ("client_id" = String, Path, description = "Node to duplicate"),
    ),
    responses(
        (status = 201, description = "Duplicated node", body = CanvasNodeResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
    ),
    security(("bearer_auth" = []))
)]
pub async fn duplicate_node(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, client_id)): Path<(Uuid, String)>,
) -> Result<(StatusCode, Json<CanvasNodeResponse>)> {
    verify_project_owner(&state, auth.user_id, project_id).await?;

    let new_client_id = format!(
        "{}-copy-{}",
        client_id,
        chrono::Utc::now().timestamp_millis()
    );

    let node = sqlx::query_as::<_, CanvasNode>(
        "INSERT INTO canvas_nodes
         (project_id, client_id, node_type, title, description, x, y, width, height,
          status, content, file_name, generated_code, picked, parent_id, page_role,
          tag, platform, language, ai_model, element_links, env_vars)
         SELECT project_id, $3, node_type, title || ' (copy)', description,
                x + 20, y + 20, width, height,
                status, content, file_name, generated_code, picked, parent_id, page_role,
                tag, platform, language, ai_model, element_links, env_vars
         FROM canvas_nodes
         WHERE project_id = $1 AND client_id = $2
         RETURNING *",
    )
    .bind(project_id)
    .bind(&client_id)
    .bind(&new_client_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Node '{client_id}' not found")))?;

    let empty: HashMap<String, Vec<String>> = HashMap::new();
    Ok((StatusCode::CREATED, Json(node_to_response(node, &empty))))
}

/// List all connections for a project
#[utoipa::path(
    get,
    path = "/api/projects/{project_id}/connections",
    params(("project_id" = Uuid, Path, description = "Project UUID")),
    responses(
        (status = 200, description = "List of [from, to] connection pairs"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer_auth" = []))
)]
pub async fn list_connections(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<[String; 2]>>> {
    verify_project_owner(&state, auth.user_id, project_id).await?;

    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT from_client_id, to_client_id FROM node_connections WHERE project_id = $1",
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;

    let connections = rows.into_iter().map(|(f, t)| [f, t]).collect();
    Ok(Json(connections))
}

/// Create a connection between two nodes
#[utoipa::path(
    post,
    path = "/api/projects/{project_id}/connections",
    params(("project_id" = Uuid, Path, description = "Project UUID")),
    request_body = ConnectNodesRequest,
    responses(
        (status = 201, description = "Connection created"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer_auth" = []))
)]
pub async fn connect_nodes(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<ConnectNodesRequest>,
) -> Result<(StatusCode, Json<Value>)> {
    verify_project_owner(&state, auth.user_id, project_id).await?;

    sqlx::query(
        "INSERT INTO node_connections (project_id, from_client_id, to_client_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    )
    .bind(project_id)
    .bind(&req.from_client_id)
    .bind(&req.to_client_id)
    .execute(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(json!({ "message": "Connection created" }))))
}

/// Remove a connection between two nodes
#[utoipa::path(
    delete,
    path = "/api/projects/{project_id}/connections",
    params(("project_id" = Uuid, Path, description = "Project UUID")),
    request_body = DisconnectNodesRequest,
    responses(
        (status = 200, description = "Connection removed"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer_auth" = []))
)]
pub async fn disconnect_nodes(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<DisconnectNodesRequest>,
) -> Result<Json<Value>> {
    verify_project_owner(&state, auth.user_id, project_id).await?;

    sqlx::query(
        "DELETE FROM node_connections
         WHERE project_id = $1 AND from_client_id = $2 AND to_client_id = $3",
    )
    .bind(project_id)
    .bind(&req.from_client_id)
    .bind(&req.to_client_id)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "message": "Connection removed" })))
}

/// Remove a specific element link from a node by target node ID
#[utoipa::path(
    delete,
    path = "/api/projects/{project_id}/nodes/{client_id}/element-links/{target_id}",
    params(
        ("project_id" = Uuid, Path, description = "Project UUID"),
        ("client_id" = String, Path, description = "Source node client_id"),
        ("target_id" = String, Path, description = "Target node client_id to unlink"),
    ),
    responses(
        (status = 200, description = "Element link removed", body = CanvasNodeResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
    ),
    security(("bearer_auth" = []))
)]
pub async fn remove_element_link(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, client_id, target_id)): Path<(Uuid, String, String)>,
) -> Result<Json<CanvasNodeResponse>> {
    verify_project_owner(&state, auth.user_id, project_id).await?;

    sqlx::query(
        "UPDATE canvas_nodes
         SET element_links = (
             SELECT COALESCE(jsonb_agg(el), '[]'::jsonb)
             FROM jsonb_array_elements(element_links) el
             WHERE el->>'targetNodeId' <> $3
         )
         WHERE project_id = $1 AND client_id = $2",
    )
    .bind(project_id)
    .bind(&client_id)
    .bind(&target_id)
    .execute(&state.db)
    .await?;

    let node = fetch_node_response(&state, project_id, &client_id).await?;
    Ok(Json(node))
}

fn node_to_response(node: CanvasNode, connected_to_map: &HashMap<String, Vec<String>>) -> CanvasNodeResponse {
    let element_links: Vec<ElementLink> =
        serde_json::from_value(node.element_links).unwrap_or_default();
    let env_vars: HashMap<String, String> =
        serde_json::from_value(node.env_vars).unwrap_or_default();
    let connected_to = connected_to_map
        .get(&node.client_id)
        .cloned()
        .unwrap_or_default();

    CanvasNodeResponse {
        id: node.id,
        client_id: node.client_id,
        node_type: node.node_type,
        title: node.title,
        description: node.description,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        status: node.status,
        content: node.content,
        file_name: node.file_name,
        generated_code: node.generated_code,
        picked: node.picked,
        parent_id: node.parent_id,
        page_role: node.page_role,
        tag: node.tag,
        platform: node.platform,
        language: node.language,
        ai_model: node.ai_model,
        element_links,
        env_vars,
        connected_to,
        created_at: node.created_at,
        updated_at: node.updated_at,
    }
}

async fn verify_project_owner(state: &AppState, user_id: Uuid, project_id: Uuid) -> Result<()> {
    let exists: Option<bool> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND user_id = $2)",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    if !exists.unwrap_or(false) {
        return Err(AppError::NotFound(format!(
            "Project {project_id} not found"
        )));
    }
    Ok(())
}

async fn fetch_node_response(
    state: &AppState,
    project_id: Uuid,
    client_id: &str,
) -> Result<CanvasNodeResponse> {
    let node = sqlx::query_as::<_, CanvasNode>(
        "SELECT * FROM canvas_nodes WHERE project_id = $1 AND client_id = $2",
    )
    .bind(project_id)
    .bind(client_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Node '{client_id}' not found")))?;

    let conn_rows = sqlx::query_as::<_, (String, String)>(
        "SELECT from_client_id, to_client_id FROM node_connections WHERE project_id = $1 AND from_client_id = $2",
    )
    .bind(project_id)
    .bind(client_id)
    .fetch_all(&state.db)
    .await?;

    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for (from, to) in conn_rows {
        map.entry(from).or_default().push(to);
    }

    Ok(node_to_response(node, &map))
}
