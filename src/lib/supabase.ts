import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      canvas_nodes: {
        Row: {
          id: string;
          project_id: string;
          client_id: string;
          node_type: string;
          title: string;
          description: string;
          x: number;
          y: number;
          width: number;
          height: number;
          status: string;
          content: string | null;
          file_name: string | null;
          generated_code: string | null;
          picked: boolean;
          parent_id: string | null;
          page_role: string | null;
          tag: string | null;
          platform: string | null;
          language: string | null;
          ai_model: string | null;
          element_links: unknown[];
          env_vars: Record<string, string>;
          created_at: string;
          updated_at: string;
        };
      };
      node_connections: {
        Row: {
          id: string;
          project_id: string;
          from_client_id: string;
          to_client_id: string;
          created_at: string;
        };
      };
      ui_variations: {
        Row: {
          id: string;
          project_id: string;
          source_node_client_id: string;
          label: string;
          description: string;
          preview_html: string;
          code: string;
          category: string;
          created_at: string;
        };
      };
      user_api_keys: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          api_key: string;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};
