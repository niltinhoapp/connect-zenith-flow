/**
 * Tipos do banco (schema `public`) — espelham as migrations em
 * `supabase/migrations`. Escrito à mão na F1 para manter o cliente Supabase
 * tipado sem um projeto provisionado.
 *
 * Na F1 (ativação), substituir pelo output oficial do CLI:
 *   supabase gen types typescript --linked > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Timestamps & {
          id: string;
          name: string;
          slug: string;
          plan_id: string;
          enabled_modules: string[];
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan_id?: string;
          enabled_modules?: string[];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: Timestamps & {
          id: string;
          full_name: string;
          email: string;
          avatar_url: string | null;
          active_organization_id: string | null;
        };
        Insert: {
          id: string;
          full_name?: string;
          email: string;
          avatar_url?: string | null;
          active_organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      roles: {
        Row: Timestamps & {
          id: string;
          organization_id: string | null;
          key: string;
          name: string;
          description: string;
          is_system: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          key: string;
          name: string;
          description?: string;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };
      permissions: {
        Row: Timestamps & {
          id: string;
          key: string;
          module: string;
          description: string;
        };
        Insert: {
          id?: string;
          key: string;
          module: string;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["permissions"]["Insert"]>;
        Relationships: [];
      };
      role_permissions: {
        Row: Timestamps & { role_id: string; permission_id: string };
        Insert: { role_id: string; permission_id: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["role_permissions"]["Insert"]>;
        Relationships: [];
      };
      organization_members: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          user_id: string;
          role_id: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role_id: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["organization_members"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: Timestamps & {
          id: string;
          organization_id: string | null;
          actor_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          actor_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      provision_organization: {
        Args: { p_name: string };
        Returns: Database["public"]["Tables"]["organizations"]["Row"];
      };
      set_active_organization: {
        Args: { p_org: string };
        Returns: undefined;
      };
      create_role: {
        Args: { p_org: string; p_name: string; p_permission_keys: string[] };
        Returns: Database["public"]["Tables"]["roles"]["Row"];
      };
      current_org: { Args: Record<string, never>; Returns: string | null };
      is_org_member: { Args: { org: string }; Returns: boolean };
      has_permission: { Args: { org: string; perm: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
