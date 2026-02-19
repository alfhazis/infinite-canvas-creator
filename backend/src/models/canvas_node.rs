use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "node_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    Idea,
    Design,
    Code,
    Import,
    Api,
    Cli,
    Database,
    Payment,
    Env,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "node_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum NodeStatus {
    Idle,
    Generating,
    Ready,
    Running,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "node_platform", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum NodePlatform {
    Web,
    Mobile,
    Api,
    Desktop,
    Cli,
    Database,
    Env,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementLink {
    pub selector: String,
    pub label: String,
    pub target_node_id: String,
    pub element_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CanvasNode {
    pub id: Uuid,
    pub project_id: Uuid,
    pub client_id: String,
    pub node_type: NodeType,
    pub title: String,
    pub description: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub status: NodeStatus,
    pub content: Option<String>,
    pub file_name: Option<String>,
    pub generated_code: Option<String>,
    pub picked: bool,
    pub parent_id: Option<String>,
    pub page_role: Option<String>,
    pub tag: Option<String>,
    pub platform: Option<NodePlatform>,
    pub language: Option<String>,
    pub ai_model: Option<String>,
    pub element_links: serde_json::Value,
    pub env_vars: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNodeRequest {
    pub client_id: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub title: String,
    pub description: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub status: Option<NodeStatus>,
    pub content: Option<String>,
    pub file_name: Option<String>,
    pub generated_code: Option<String>,
    pub picked: Option<bool>,
    pub parent_id: Option<String>,
    pub page_role: Option<String>,
    pub tag: Option<String>,
    pub platform: Option<NodePlatform>,
    pub language: Option<String>,
    pub ai_model: Option<String>,
    pub element_links: Option<Vec<ElementLink>>,
    pub env_vars: Option<HashMap<String, String>>,
    pub connected_to: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCanvasSave {
    pub nodes: Vec<CreateNodeRequest>,
    pub connections: Vec<[String; 2]>,
    pub zoom: Option<f64>,
    pub pan_x: Option<f64>,
    pub pan_y: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasState {
    pub nodes: Vec<CanvasNodeResponse>,
    pub connections: Vec<[String; 2]>,
    pub zoom: f64,
    pub pan_x: f64,
    pub pan_y: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasNodeResponse {
    pub id: Uuid,
    pub client_id: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub title: String,
    pub description: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub status: NodeStatus,
    pub content: Option<String>,
    pub file_name: Option<String>,
    pub generated_code: Option<String>,
    pub picked: bool,
    pub parent_id: Option<String>,
    pub page_role: Option<String>,
    pub tag: Option<String>,
    pub platform: Option<NodePlatform>,
    pub language: Option<String>,
    pub ai_model: Option<String>,
    pub element_links: Vec<ElementLink>,
    pub env_vars: HashMap<String, String>,
    pub connected_to: Vec<String>,
}
