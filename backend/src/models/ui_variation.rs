use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

/// Category of UI variation for assembly purposes
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "variation_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum VariationCategory {
    Header,
    Hero,
    Features,
    Pricing,
    Footer,
    Dashboard,
    Mobile,
}

/// A generated UI variation for a source node
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UiVariation {
    pub id: Uuid,
    pub project_id: Uuid,
    pub source_node_client_id: String,
    pub label: String,
    pub description: String,
    pub preview_html: String,
    pub code: String,
    pub category: VariationCategory,
    pub created_at: DateTime<Utc>,
}

/// Save multiple UI variations for a node
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SaveVariationsRequest {
    pub source_node_client_id: String,
    pub variations: Vec<VariationPayload>,
}

/// A single variation payload to save
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VariationPayload {
    pub label: String,
    pub description: String,
    pub preview_html: String,
    pub code: String,
    pub category: VariationCategory,
}
