use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;

/// Node type determines what kind of content and editor the node uses
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, ToSchema)]
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

/// Lifecycle status of a node
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "node_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum NodeStatus {
    Idle,
    Generating,
    Ready,
    Running,
}

/// Target platform for generated output
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, ToSchema)]
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

/// A link from an HTML element inside a design node to another canvas node
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ElementLink {
    /// CSS selector identifying the element in the visual editor
    pub selector: String,
    /// Display label shown in the editor
    pub label: String,
    /// client_id of the target node
    pub target_node_id: String,
    /// Element type hint: form, button, input, link, image, etc.
    pub element_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
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

/// Create a new canvas node
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateNodeRequest {
    /// Frontend-generated ID like "node-3-1716000000000"
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
    /// Raw HTML content for design nodes
    pub content: Option<String>,
    pub file_name: Option<String>,
    /// Generated code output
    pub generated_code: Option<String>,
    /// Whether this node is selected for assembly
    pub picked: Option<bool>,
    /// client_id of parent that generated this node
    pub parent_id: Option<String>,
    /// Assembly role: header, hero, features, pricing, footer, dashboard
    pub page_role: Option<String>,
    /// Color tag for grouping
    pub tag: Option<String>,
    pub platform: Option<NodePlatform>,
    pub language: Option<String>,
    pub ai_model: Option<String>,
    pub element_links: Option<Vec<ElementLink>>,
    pub env_vars: Option<HashMap<String, String>>,
    /// client_ids of nodes to connect to
    pub connected_to: Option<Vec<String>>,
}

/// Partially update a canvas node's fields
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNodeRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub status: Option<NodeStatus>,
    pub content: Option<String>,
    pub file_name: Option<String>,
    pub generated_code: Option<String>,
    pub picked: Option<bool>,
    pub page_role: Option<String>,
    pub tag: Option<String>,
    pub platform: Option<NodePlatform>,
    pub language: Option<String>,
    pub ai_model: Option<String>,
    pub element_links: Option<Vec<ElementLink>>,
    pub env_vars: Option<HashMap<String, String>>,
}

/// Create a directed connection between two nodes
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConnectNodesRequest {
    /// client_id of the source node
    pub from_client_id: String,
    /// client_id of the target node
    pub to_client_id: String,
}

/// Remove a connection between two nodes
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DisconnectNodesRequest {
    pub from_client_id: String,
    pub to_client_id: String,
}

/// Bulk replace entire canvas state atomically
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BulkCanvasSave {
    pub nodes: Vec<CreateNodeRequest>,
    pub connections: Vec<[String; 2]>,
    pub zoom: Option<f64>,
    pub pan_x: Option<f64>,
    pub pan_y: Option<f64>,
}

/// Full canvas state (nodes + connections + viewport)
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CanvasState {
    pub nodes: Vec<CanvasNodeResponse>,
    pub connections: Vec<[String; 2]>,
    pub zoom: f64,
    pub pan_x: f64,
    pub pan_y: f64,
}

/// Canvas node as returned from the API
#[derive(Debug, Serialize, ToSchema)]
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
