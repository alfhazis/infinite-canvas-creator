use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: String,
    pub zoom: f64,
    pub pan_x: f64,
    pub pan_y: f64,
    pub ai_model: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub ai_model: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub zoom: Option<f64>,
    pub pan_x: Option<f64>,
    pub pan_y: Option<f64>,
    pub ai_model: Option<String>,
}
