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
      modules: {
        Row: Timestamps & { id: string; key: string; name: string; description: string; category: string; is_core: boolean; icon: string | null; position: number };
        Insert: { key: string; name: string } & Partial<Database["public"]["Tables"]["modules"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["modules"]["Row"]>;
        Relationships: [];
      };
      organization_modules: {
        Row: Timestamps & { id: string; organization_id: string; module_id: string; enabled: boolean; source: string; activated_at: string };
        Insert: { organization_id: string; module_id: string } & Partial<Database["public"]["Tables"]["organization_modules"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["organization_modules"]["Row"]>;
        Relationships: [];
      };
      module_configs: {
        Row: Timestamps & { id: string; organization_id: string; module_id: string; config: Json; schema_version: number; updated_by: string | null; validated_at: string | null };
        Insert: { organization_id: string; module_id: string } & Partial<Database["public"]["Tables"]["module_configs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["module_configs"]["Row"]>;
        Relationships: [];
      };
      jobs: {
        Row: Timestamps & {
          id: string; organization_id: string | null; type: string; payload: Json;
          status: "queued" | "running" | "succeeded" | "failed" | "dead"; priority: number;
          attempts: number; max_attempts: number; available_at: string; locked_at: string | null;
          locked_by: string | null; lease_expires_at: string | null; worker_version: string | null;
          last_error: string | null; result: Json | null; trace_id: string | null; correlation_id: string | null;
          payload_version: number; idempotency_key: string | null;
        };
        Insert: { type: string } & Partial<Database["public"]["Tables"]["jobs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["jobs"]["Row"]>;
        Relationships: [];
      };
      plan_limits: {
        Row: Timestamps & { id: string; plan_id: string; resource: string; limit_value: number; period: "month" | "total" };
        Insert: { plan_id: string; resource: string } & Partial<Database["public"]["Tables"]["plan_limits"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["plan_limits"]["Row"]>;
        Relationships: [];
      };
      quota_usage: {
        Row: Timestamps & { id: string; organization_id: string; resource: string; period_key: string; used: number };
        Insert: { organization_id: string; resource: string } & Partial<Database["public"]["Tables"]["quota_usage"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["quota_usage"]["Row"]>;
        Relationships: [];
      };
      webhooks: {
        Row: Timestamps & { id: string; organization_id: string; url: string; events: string[]; secret: string | null; enabled: boolean; deleted_at: string | null };
        Insert: { organization_id: string; url: string } & Partial<Database["public"]["Tables"]["webhooks"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["webhooks"]["Row"]>;
        Relationships: [];
      };
      operation_traces: {
        Row: { id: string; organization_id: string | null; trace_id: string; span_id: string | null; correlation_id: string | null; actor_id: string | null; operation: string; status: "success" | "error"; duration_ms: number | null; metadata: Json; created_at: string };
        Insert: { trace_id: string; operation: string } & Partial<Database["public"]["Tables"]["operation_traces"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["operation_traces"]["Row"]>;
        Relationships: [];
      };
      market_templates: {
        Row: Timestamps & { id: string; key: string; version: number; name: string; description: string; definition: Json; is_active: boolean; published_at: string | null; position: number };
        Insert: { key: string; name: string } & Partial<Database["public"]["Tables"]["market_templates"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["market_templates"]["Row"]>;
        Relationships: [];
      };
      job_types: {
        Row: Timestamps & { key: string; module: string; description: string; enabled: boolean };
        Insert: { key: string } & Partial<Database["public"]["Tables"]["job_types"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["job_types"]["Row"]>;
        Relationships: [];
      };
      idempotency_keys: {
        Row: { organization_id: string; key: string; created_at: string };
        Insert: { organization_id: string; key: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["idempotency_keys"]["Row"]>;
        Relationships: [];
      };
      domain_events: {
        Row: Timestamps & {
          id: string; organization_id: string; name: string; payload: Json; payload_version: number;
          status: "queued" | "processing" | "done" | "failed"; attempts: number;
          trace_id: string | null; correlation_id: string | null; occurred_at: string; processed_at: string | null;
        };
        Insert: { organization_id: string; name: string } & Partial<Database["public"]["Tables"]["domain_events"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["domain_events"]["Row"]>;
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
      has_module: { Args: { p_org: string; p_key: string }; Returns: boolean };
      enqueue_job: {
        Args: {
          p_org: string | null; p_type: string; p_payload?: Json; p_available_at?: string;
          p_priority?: number; p_max_attempts?: number; p_trace_id?: string; p_correlation_id?: string;
          p_idempotency_key?: string; p_payload_version?: number;
        };
        Returns: string;
      };
      try_consume_quota: { Args: { p_org: string; p_resource: string; p_amount?: number }; Returns: boolean };
      claim_idempotency: { Args: { p_org: string; p_key: string }; Returns: boolean };
      publish_event: {
        Args: { p_org: string; p_name: string; p_payload?: Json; p_payload_version?: number; p_trace_id?: string };
        Returns: string;
      };
      relay_domain_event: { Args: { p_event_id: string }; Returns: number };
      retry_dead_letter: { Args: { p_id: string }; Returns: string };
      discard_dead_letter: { Args: { p_id: string }; Returns: undefined };
      claim_jobs: {
        Args: { p_worker: string; p_limit?: number; p_lease_seconds?: number };
        Returns: Database["public"]["Tables"]["jobs"]["Row"][];
      };
      complete_job: { Args: { p_id: string; p_result?: Json }; Returns: undefined };
      fail_job: { Args: { p_id: string; p_error: string }; Returns: string };
      check_quota: { Args: { p_org: string; p_resource: string; p_amount?: number }; Returns: boolean };
      consume_quota: { Args: { p_org: string; p_resource: string; p_amount?: number }; Returns: undefined };
      write_trace: {
        Args: {
          p_org: string | null; p_trace_id: string; p_operation: string; p_status?: string;
          p_duration_ms?: number; p_correlation_id?: string; p_span_id?: string; p_metadata?: Json;
        };
        Returns: undefined;
      };
      dispatch_webhooks: { Args: { p_org: string; p_event: string; p_payload?: Json }; Returns: number };
      apply_market_template: { Args: { p_org: string; p_key: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
