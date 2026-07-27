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
      customers: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          code: string | null;
          type: "person" | "company";
          first_name: string | null;
          last_name: string | null;
          company_name: string | null;
          document: string | null;
          email: string | null;
          phone: string | null;
          mobile: string | null;
          website: string | null;
          status: string;
          owner_id: string | null;
          source: string | null;
          notes: string | null;
          tags: string[];
          custom_fields: Json;
          last_contact_at: string | null;
          next_followup_at: string | null;
          score: number | null;
          lifetime_value: number;
          origin_channel: string | null;
          deleted_at: string | null;
        };
        Insert: { organization_id: string } & Partial<Database["public"]["Tables"]["customers"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
        Relationships: [];
      };
      leads: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          code: string | null;
          name: string;
          company_name: string | null;
          email: string | null;
          phone: string | null;
          source: string | null;
          status: string;
          owner_id: string | null;
          notes: string | null;
          tags: string[];
          custom_fields: Json;
          converted_customer_id: string | null;
          converted_at: string | null;
          qualified_at: string | null;
          deleted_at: string | null;
        };
        Insert: { organization_id: string; name: string } & Partial<Database["public"]["Tables"]["leads"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
        Relationships: [];
      };
      pipelines: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          name: string;
          is_default: boolean;
          position: number;
          color: string;
          icon: string | null;
          display_order: number;
          deleted_at: string | null;
        };
        Insert: { organization_id: string; name: string } & Partial<Database["public"]["Tables"]["pipelines"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["pipelines"]["Row"]>;
        Relationships: [];
      };
      pipeline_stages: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          pipeline_id: string;
          name: string;
          position: number;
          type: "open" | "won" | "lost";
          probability: number;
          deleted_at: string | null;
        };
        Insert: { organization_id: string; pipeline_id: string; name: string } & Partial<Database["public"]["Tables"]["pipeline_stages"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["pipeline_stages"]["Row"]>;
        Relationships: [];
      };
      deals: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          code: string | null;
          customer_id: string | null;
          pipeline_id: string;
          stage_id: string;
          title: string;
          amount: number;
          currency: string;
          owner_id: string | null;
          source: string | null;
          notes: string | null;
          tags: string[];
          custom_fields: Json;
          expected_close_date: string | null;
          closed_at: string | null;
          won_at: string | null;
          lost_at: string | null;
          loss_reason: string | null;
          win_reason: string | null;
          probability_override: number | null;
          deleted_at: string | null;
        };
        Insert: { organization_id: string; pipeline_id: string; stage_id: string; title: string } & Partial<Database["public"]["Tables"]["deals"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["deals"]["Row"]>;
        Relationships: [];
      };
      customer_timeline: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          customer_id: string | null;
          actor_id: string | null;
          event_type: string;
          title: string;
          description: string | null;
          related_type: string | null;
          related_id: string | null;
          payload: Json;
          module: string | null;
          deleted_at: string | null;
        };
        Insert: { organization_id: string; event_type: string; title: string } & Partial<Database["public"]["Tables"]["customer_timeline"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["customer_timeline"]["Row"]>;
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
      convert_lead_to_customer: {
        Args: { p_lead_id: string };
        Returns: Database["public"]["Tables"]["customers"]["Row"];
      };
      dashboard_metrics: {
        Args: { p_org: string };
        Returns: Json;
      };
      reports_metrics: {
        Args: { p_org: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
