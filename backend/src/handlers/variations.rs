use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    middleware::auth::AuthUser,
    models::ui_variation::{SaveVariationsRequest, UiVariation},
    state::AppState,
};

pub async fn list_variations(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<UiVariation>>> {
    ensure_project_owned(&state, auth.user_id, project_id).await?;

    let variations = sqlx::query_as::<_, UiVariation>(
        "SELECT * FROM ui_variations WHERE project_id = $1 ORDER BY created_at DESC",
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(variations))
}

pub async fn save_variations(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<SaveVariationsRequest>,
) -> Result<Json<Value>> {
    ensure_project_owned(&state, auth.user_id, project_id).await?;

    for v in &req.variations {
        sqlx::query(
            "INSERT INTO ui_variations
             (project_id, source_node_client_id, label, description, preview_html, code, category)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(project_id)
        .bind(&req.source_node_client_id)
        .bind(&v.label)
        .bind(&v.description)
        .bind(&v.preview_html)
        .bind(&v.code)
        .bind(&v.category)
        .execute(&state.db)
        .await?;
    }

    let count = req.variations.len();
    Ok(Json(json!({ "message": "Variations saved", "count": count })))
}

pub async fn delete_variation(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, variation_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>> {
    ensure_project_owned(&state, auth.user_id, project_id).await?;

    let rows = sqlx::query(
        "DELETE FROM ui_variations WHERE id = $1 AND project_id = $2",
    )
    .bind(variation_id)
    .bind(project_id)
    .execute(&state.db)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Variation {variation_id} not found"
        )));
    }

    Ok(Json(json!({ "message": "Variation deleted" })))
}

async fn ensure_project_owned(
    state: &AppState,
    user_id: Uuid,
    project_id: Uuid,
) -> Result<()> {
    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM projects WHERE id = $1 AND user_id = $2",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    if exists == 0 {
        return Err(AppError::NotFound(format!(
            "Project {project_id} not found"
        )));
    }
    Ok(())
}
