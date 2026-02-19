/*
  # Canvas IDE Full Schema v2

  ## Summary
  Creates all tables for the Canvas IDE application. Uses IF NOT EXISTS and
  DROP POLICY IF EXISTS to be idempotent-safe.

  ## Tables
  - projects: User canvas projects with viewport state
  - canvas_nodes: Individual nodes mirroring frontend CanvasNode interface
  - node_connections: Directed edges between nodes
  - ui_variations: AI-generated UI section variations
  - user_api_keys: Per-user API keys (e.g. OpenRouter)

  ## Security
  - RLS enabled on all tables with ownership-based policies
*/

-- Enums
DO $$ BEGIN
  CREATE TYPE node_type AS ENUM (
    'idea', 'design', 'code', 'import',
    'api', 'cli', 'database', 'payment', 'env'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE node_status AS ENUM (
    'idle', 'generating', 'ready', 'running'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE node_platform AS ENUM (
    'web', 'mobile', 'api', 'desktop', 'cli', 'database', 'env'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE variation_category AS ENUM (
    'header', 'hero', 'features', 'pricing',
    'footer', 'dashboard', 'mobile'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'Untitled Project',
  description text NOT NULL DEFAULT '',
  zoom        float8 NOT NULL DEFAULT 1.0,
  pan_x       float8 NOT NULL DEFAULT 0.0,
  pan_y       float8 NOT NULL DEFAULT 0.0,
  ai_model    text NOT NULL DEFAULT 'auto',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

DO $$ BEGIN
  CREATE TRIGGER set_projects_timestamp
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Canvas nodes
CREATE TABLE IF NOT EXISTS canvas_nodes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id       text NOT NULL,
  node_type       node_type NOT NULL DEFAULT 'idea',
  title           text NOT NULL DEFAULT '',
  description     text NOT NULL DEFAULT '',
  x               float8 NOT NULL DEFAULT 0.0,
  y               float8 NOT NULL DEFAULT 0.0,
  width           float8 NOT NULL DEFAULT 360.0,
  height          float8 NOT NULL DEFAULT 300.0,
  status          node_status NOT NULL DEFAULT 'idle',
  content         text,
  file_name       text,
  generated_code  text,
  picked          boolean NOT NULL DEFAULT false,
  parent_id       text,
  page_role       text,
  tag             text,
  platform        node_platform,
  language        text,
  ai_model        text,
  element_links   jsonb NOT NULL DEFAULT '[]'::jsonb,
  env_vars        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_canvas_nodes_project_id ON canvas_nodes(project_id);

DO $$ BEGIN
  CREATE TRIGGER set_canvas_nodes_timestamp
  BEFORE UPDATE ON canvas_nodes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE canvas_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view nodes in own projects" ON canvas_nodes;
DROP POLICY IF EXISTS "Users can create nodes in own projects" ON canvas_nodes;
DROP POLICY IF EXISTS "Users can update nodes in own projects" ON canvas_nodes;
DROP POLICY IF EXISTS "Users can delete nodes in own projects" ON canvas_nodes;

CREATE POLICY "Users can view nodes in own projects"
  ON canvas_nodes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = canvas_nodes.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create nodes in own projects"
  ON canvas_nodes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = canvas_nodes.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update nodes in own projects"
  ON canvas_nodes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = canvas_nodes.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = canvas_nodes.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete nodes in own projects"
  ON canvas_nodes FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = canvas_nodes.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Node connections
CREATE TABLE IF NOT EXISTS node_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_client_id  text NOT NULL,
  to_client_id    text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, from_client_id, to_client_id)
);

CREATE INDEX IF NOT EXISTS idx_node_connections_project ON node_connections(project_id);

ALTER TABLE node_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view connections in own projects" ON node_connections;
DROP POLICY IF EXISTS "Users can create connections in own projects" ON node_connections;
DROP POLICY IF EXISTS "Users can delete connections in own projects" ON node_connections;

CREATE POLICY "Users can view connections in own projects"
  ON node_connections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = node_connections.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create connections in own projects"
  ON node_connections FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = node_connections.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete connections in own projects"
  ON node_connections FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = node_connections.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- UI variations
CREATE TABLE IF NOT EXISTS ui_variations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_node_client_id   text NOT NULL,
  label                   text NOT NULL,
  description             text NOT NULL DEFAULT '',
  preview_html            text NOT NULL DEFAULT '',
  code                    text NOT NULL DEFAULT '',
  category                variation_category NOT NULL DEFAULT 'hero',
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ui_variations_project ON ui_variations(project_id);
CREATE INDEX IF NOT EXISTS idx_ui_variations_source ON ui_variations(source_node_client_id);

ALTER TABLE ui_variations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view variations in own projects" ON ui_variations;
DROP POLICY IF EXISTS "Users can create variations in own projects" ON ui_variations;
DROP POLICY IF EXISTS "Users can delete variations in own projects" ON ui_variations;

CREATE POLICY "Users can view variations in own projects"
  ON ui_variations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ui_variations.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create variations in own projects"
  ON ui_variations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ui_variations.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete variations in own projects"
  ON ui_variations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ui_variations.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- User API keys
CREATE TABLE IF NOT EXISTS user_api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      text NOT NULL,
  api_key       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

DO $$ BEGIN
  CREATE TRIGGER set_user_api_keys_timestamp
  BEFORE UPDATE ON user_api_keys
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own api keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can create own api keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can update own api keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can delete own api keys" ON user_api_keys;

CREATE POLICY "Users can view own api keys"
  ON user_api_keys FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own api keys"
  ON user_api_keys FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys"
  ON user_api_keys FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys"
  ON user_api_keys FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
