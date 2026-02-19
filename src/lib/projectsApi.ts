import { supabase } from './supabase';
import type { CanvasNode, UIVariation } from '@/stores/canvasStore';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  zoom: number;
  pan_x: number;
  pan_y: number;
  ai_model: string;
  created_at: string;
  updated_at: string;
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProject(name: string, description = ''): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name, description })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'zoom' | 'pan_x' | 'pan_y' | 'ai_model'>>): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

function nodeToRow(node: CanvasNode, projectId: string) {
  return {
    project_id: projectId,
    client_id: node.id,
    node_type: node.type,
    title: node.title,
    description: node.description,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    status: node.status,
    content: node.content ?? null,
    file_name: node.fileName ?? null,
    generated_code: node.generatedCode ?? null,
    picked: node.picked ?? false,
    parent_id: node.parentId ?? null,
    page_role: node.pageRole ?? null,
    tag: node.tag ?? null,
    platform: node.platform ?? null,
    language: node.language ?? null,
    ai_model: node.aiModel ?? null,
    element_links: node.elementLinks ?? [],
    env_vars: node.envVars ?? {},
  };
}

function rowToNode(row: Record<string, unknown>): CanvasNode {
  const connections = (row._connections as string[]) ?? [];
  return {
    id: row.client_id as string,
    type: row.node_type as CanvasNode['type'],
    title: row.title as string,
    description: row.description as string,
    x: row.x as number,
    y: row.y as number,
    width: row.width as number,
    height: row.height as number,
    status: row.status as CanvasNode['status'],
    content: (row.content as string) ?? undefined,
    fileName: (row.file_name as string) ?? undefined,
    generatedCode: (row.generated_code as string) ?? undefined,
    connectedTo: connections,
    picked: row.picked as boolean,
    parentId: (row.parent_id as string) ?? undefined,
    pageRole: (row.page_role as string) ?? undefined,
    tag: (row.tag as string) ?? undefined,
    platform: (row.platform as CanvasNode['platform']) ?? undefined,
    language: (row.language as string) ?? undefined,
    aiModel: (row.ai_model as string) ?? undefined,
    elementLinks: (row.element_links as CanvasNode['elementLinks']) ?? [],
    envVars: (row.env_vars as Record<string, string>) ?? {},
  };
}

export interface CanvasState {
  nodes: CanvasNode[];
  zoom: number;
  panX: number;
  panY: number;
  aiModel: string;
}

export async function loadCanvas(projectId: string): Promise<CanvasState> {
  const [projectRes, nodesRes, connectionsRes] = await Promise.all([
    supabase.from('projects').select('zoom,pan_x,pan_y,ai_model').eq('id', projectId).single(),
    supabase.from('canvas_nodes').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('node_connections').select('from_client_id,to_client_id').eq('project_id', projectId),
  ]);

  if (projectRes.error) throw projectRes.error;
  if (nodesRes.error) throw nodesRes.error;
  if (connectionsRes.error) throw connectionsRes.error;

  const connectionMap: Record<string, string[]> = {};
  for (const conn of connectionsRes.data ?? []) {
    if (!connectionMap[conn.from_client_id]) connectionMap[conn.from_client_id] = [];
    connectionMap[conn.from_client_id].push(conn.to_client_id);
  }

  const nodes = (nodesRes.data ?? []).map((row) =>
    rowToNode({ ...row, _connections: connectionMap[row.client_id] ?? [] })
  );

  const project = projectRes.data;
  return {
    nodes,
    zoom: project.zoom,
    panX: project.pan_x,
    panY: project.pan_y,
    aiModel: project.ai_model,
  };
}

export async function saveCanvas(
  projectId: string,
  nodes: CanvasNode[],
  viewport: { zoom: number; panX: number; panY: number }
): Promise<void> {
  await updateProject(projectId, {
    zoom: viewport.zoom,
    pan_x: viewport.panX,
    pan_y: viewport.panY,
  });

  const { error: delNodesErr } = await supabase
    .from('canvas_nodes')
    .delete()
    .eq('project_id', projectId);
  if (delNodesErr) throw delNodesErr;

  if (nodes.length > 0) {
    const rows = nodes.map((n) => nodeToRow(n, projectId));
    const { error: insertErr } = await supabase.from('canvas_nodes').insert(rows);
    if (insertErr) throw insertErr;
  }

  const { error: delConnErr } = await supabase
    .from('node_connections')
    .delete()
    .eq('project_id', projectId);
  if (delConnErr) throw delConnErr;

  const connectionRows: { project_id: string; from_client_id: string; to_client_id: string }[] = [];
  for (const node of nodes) {
    for (const targetId of node.connectedTo) {
      connectionRows.push({ project_id: projectId, from_client_id: node.id, to_client_id: targetId });
    }
  }

  if (connectionRows.length > 0) {
    const { error: connErr } = await supabase.from('node_connections').insert(connectionRows);
    if (connErr) throw connErr;
  }
}

export async function saveVariations(
  projectId: string,
  sourceNodeClientId: string,
  variations: UIVariation[]
): Promise<void> {
  const rows = variations.map((v) => ({
    project_id: projectId,
    source_node_client_id: sourceNodeClientId,
    label: v.label,
    description: v.description,
    preview_html: v.previewHtml,
    code: v.code,
    category: v.category,
  }));

  const { error } = await supabase.from('ui_variations').insert(rows);
  if (error) throw error;
}

export async function loadVariations(projectId: string, sourceNodeClientId: string): Promise<UIVariation[]> {
  const { data, error } = await supabase
    .from('ui_variations')
    .select('*')
    .eq('project_id', projectId)
    .eq('source_node_client_id', sourceNodeClientId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    previewHtml: row.preview_html,
    code: row.code,
    category: row.category as UIVariation['category'],
  }));
}

export async function saveOpenRouterKey(apiKey: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_api_keys')
    .upsert({ user_id: user.id, provider: 'openrouter', api_key: apiKey }, { onConflict: 'user_id,provider' });
  if (error) throw error;
}

export async function loadOpenRouterKey(): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('api_key')
    .eq('provider', 'openrouter')
    .maybeSingle();
  if (error) throw error;
  return data?.api_key ?? null;
}

export async function deleteOpenRouterKey(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'openrouter');
  if (error) throw error;
}
