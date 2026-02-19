use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
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

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveVariationsRequest {
    pub source_node_client_id: String,
    pub variations: Vec<VariationPayload>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariationPayload {
    pub label: String,
    pub description: String,
    pub preview_html: String,
    pub code: String,
    pub category: VariationCategory,
}
