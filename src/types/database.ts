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
        Insert: {
          role_id: string;
          permission_id: string;
          created_at?: string;
          updated_at?: string;
        };
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
        Insert: { organization_id: string } & Partial<
          Database["public"]["Tables"]["customers"]["Row"]
        >;
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
        Insert: { organization_id: string; name: string } & Partial<
          Database["public"]["Tables"]["leads"]["Row"]
        >;
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
        Insert: { organization_id: string; name: string } & Partial<
          Database["public"]["Tables"]["pipelines"]["Row"]
        >;
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
        Insert: { organization_id: string; pipeline_id: string; name: string } & Partial<
          Database["public"]["Tables"]["pipeline_stages"]["Row"]
        >;
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
        Insert: {
          organization_id: string;
          pipeline_id: string;
          stage_id: string;
          title: string;
        } & Partial<Database["public"]["Tables"]["deals"]["Row"]>;
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
        Insert: { organization_id: string; event_type: string; title: string } & Partial<
          Database["public"]["Tables"]["customer_timeline"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["customer_timeline"]["Row"]>;
        Relationships: [];
      };
      modules: {
        Row: Timestamps & {
          id: string;
          key: string;
          name: string;
          description: string;
          category: string;
          is_core: boolean;
          icon: string | null;
          position: number;
        };
        Insert: { key: string; name: string } & Partial<
          Database["public"]["Tables"]["modules"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["modules"]["Row"]>;
        Relationships: [];
      };
      organization_modules: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          module_id: string;
          enabled: boolean;
          source: string;
          activated_at: string;
        };
        Insert: { organization_id: string; module_id: string } & Partial<
          Database["public"]["Tables"]["organization_modules"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["organization_modules"]["Row"]>;
        Relationships: [];
      };
      module_configs: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          module_id: string;
          config: Json;
          schema_version: number;
          updated_by: string | null;
          validated_at: string | null;
        };
        Insert: { organization_id: string; module_id: string } & Partial<
          Database["public"]["Tables"]["module_configs"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["module_configs"]["Row"]>;
        Relationships: [];
      };
      jobs: {
        Row: Timestamps & {
          id: string;
          organization_id: string | null;
          type: string;
          payload: Json;
          status: "queued" | "running" | "succeeded" | "failed" | "dead";
          priority: number;
          attempts: number;
          max_attempts: number;
          available_at: string;
          locked_at: string | null;
          locked_by: string | null;
          lease_expires_at: string | null;
          worker_version: string | null;
          last_error: string | null;
          result: Json | null;
          trace_id: string | null;
          correlation_id: string | null;
          payload_version: number;
          idempotency_key: string | null;
        };
        Insert: { type: string } & Partial<Database["public"]["Tables"]["jobs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["jobs"]["Row"]>;
        Relationships: [];
      };
      plan_limits: {
        Row: Timestamps & {
          id: string;
          plan_id: string;
          resource: string;
          limit_value: number;
          period: "month" | "total";
        };
        Insert: { plan_id: string; resource: string } & Partial<
          Database["public"]["Tables"]["plan_limits"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["plan_limits"]["Row"]>;
        Relationships: [];
      };
      quota_usage: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          resource: string;
          period_key: string;
          used: number;
        };
        Insert: { organization_id: string; resource: string } & Partial<
          Database["public"]["Tables"]["quota_usage"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["quota_usage"]["Row"]>;
        Relationships: [];
      };
      webhooks: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          url: string;
          events: string[];
          secret: string | null;
          enabled: boolean;
          deleted_at: string | null;
        };
        Insert: { organization_id: string; url: string } & Partial<
          Database["public"]["Tables"]["webhooks"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["webhooks"]["Row"]>;
        Relationships: [];
      };
      api_scopes: {
        Row: Timestamps & { key: string; description: string };
        Insert: { key: string; description: string } & Partial<
          Database["public"]["Tables"]["api_scopes"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["api_scopes"]["Row"]>;
        Relationships: [];
      };
      api_keys: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes: string[];
          expires_at: string | null;
          last_used_at: string | null;
          created_by: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
        };
        Insert: { organization_id: string; name: string; key_prefix: string; key_hash: string } & Partial<
          Database["public"]["Tables"]["api_keys"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["api_keys"]["Row"]>;
        Relationships: [];
      };
      api_request_logs: {
        Row: {
          id: string;
          organization_id: string;
          api_key_id: string | null;
          method: string | null;
          path: string | null;
          response_status: number | null;
          duration_ms: number | null;
          request_id: string | null;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: { organization_id: string } & Partial<
          Database["public"]["Tables"]["api_request_logs"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["api_request_logs"]["Row"]>;
        Relationships: [];
      };
      operation_traces: {
        Row: {
          id: string;
          organization_id: string | null;
          trace_id: string;
          span_id: string | null;
          correlation_id: string | null;
          actor_id: string | null;
          operation: string;
          status: "success" | "error";
          duration_ms: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: { trace_id: string; operation: string } & Partial<
          Database["public"]["Tables"]["operation_traces"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["operation_traces"]["Row"]>;
        Relationships: [];
      };
      market_templates: {
        Row: Timestamps & {
          id: string;
          key: string;
          version: number;
          name: string;
          description: string;
          definition: Json;
          is_active: boolean;
          published_at: string | null;
          position: number;
        };
        Insert: { key: string; name: string } & Partial<
          Database["public"]["Tables"]["market_templates"]["Row"]
        >;
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
          id: string;
          organization_id: string;
          name: string;
          payload: Json;
          payload_version: number;
          status: "queued" | "processing" | "done" | "failed";
          attempts: number;
          trace_id: string | null;
          correlation_id: string | null;
          occurred_at: string;
          processed_at: string | null;
        };
        Insert: { organization_id: string; name: string } & Partial<
          Database["public"]["Tables"]["domain_events"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["domain_events"]["Row"]>;
        Relationships: [];
      };
      whatsapp_accounts: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          provider: "meta" | "evolution";
          waba_id: string | null;
          business_id: string | null;
          name: string | null;
          status: "connected" | "disconnected" | "error" | "pending";
          webhook_verify_token: string | null;
          connected_at: string | null;
          deleted_at: string | null;
        };
        Insert: { organization_id: string } & Partial<
          Database["public"]["Tables"]["whatsapp_accounts"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["whatsapp_accounts"]["Row"]>;
        Relationships: [];
      };
      whatsapp_credentials: {
        Row: Timestamps & {
          account_id: string;
          organization_id: string;
          access_token: string | null;
          app_secret: string | null;
          rotated_at: string | null;
        };
        Insert: { account_id: string; organization_id: string } & Partial<
          Database["public"]["Tables"]["whatsapp_credentials"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["whatsapp_credentials"]["Row"]>;
        Relationships: [];
      };
      whatsapp_phone_numbers: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          account_id: string;
          phone_number_id: string;
          display_phone_number: string | null;
          verified_name: string | null;
          quality_rating: string | null;
          status: "active" | "inactive" | "flagged" | "pending";
          is_default: boolean;
        };
        Insert: { organization_id: string; account_id: string; phone_number_id: string } & Partial<
          Database["public"]["Tables"]["whatsapp_phone_numbers"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["whatsapp_phone_numbers"]["Row"]>;
        Relationships: [];
      };
      whatsapp_templates: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          account_id: string | null;
          external_id: string | null;
          name: string;
          language: string;
          category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
          status: "pending" | "approved" | "rejected" | "paused" | "disabled";
          components: Json;
          rejected_reason: string | null;
          deleted_at: string | null;
        };
        Insert: { organization_id: string; name: string } & Partial<
          Database["public"]["Tables"]["whatsapp_templates"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["whatsapp_templates"]["Row"]>;
        Relationships: [];
      };
      whatsapp_media: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          external_media_id: string | null;
          direction: "inbound" | "outbound";
          mime_type: string | null;
          filename: string | null;
          size_bytes: number | null;
          sha256: string | null;
          storage_path: string | null;
          status: "pending" | "stored" | "failed";
        };
        Insert: { organization_id: string; direction: "inbound" | "outbound" } & Partial<
          Database["public"]["Tables"]["whatsapp_media"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["whatsapp_media"]["Row"]>;
        Relationships: [];
      };
      conversations: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          account_id: string | null;
          phone_number_id: string | null;
          contact_wa_id: string;
          contact_name: string | null;
          customer_id: string | null;
          status: "open" | "pending" | "closed";
          assigned_to: string | null;
          unread_count: number;
          last_message_at: string | null;
          last_message_preview: string | null;
          last_inbound_at: string | null;
          last_outbound_at: string | null;
          window_expires_at: string | null;
          tags: string[];
          deleted_at: string | null;
        };
        Insert: { organization_id: string; contact_wa_id: string } & Partial<
          Database["public"]["Tables"]["conversations"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["conversations"]["Row"]>;
        Relationships: [];
      };
      conversation_insights: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          conversation_id: string;
          intent: "sale" | "support" | "billing" | "post_sale" | "other";
          temperature: "hot" | "warm" | "cold";
          urgency: "high" | "medium" | "low";
          sentiment: "positive" | "neutral" | "negative";
          summary: string;
          next_best_action: string;
          suggested_reply: string | null;
          reasons: string[];
          source_last_message_at: string | null;
          model: string | null;
          tokens_in: number;
          tokens_out: number;
          generated_at: string;
        };
        Insert: {
          organization_id: string;
          conversation_id: string;
          intent: "sale" | "support" | "billing" | "post_sale" | "other";
          temperature: "hot" | "warm" | "cold";
          urgency: "high" | "medium" | "low";
          sentiment: "positive" | "neutral" | "negative";
          summary: string;
          next_best_action: string;
        } & Partial<Database["public"]["Tables"]["conversation_insights"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["conversation_insights"]["Row"]>;
        Relationships: [];
      };
      messages: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          conversation_id: string;
          direction: "inbound" | "outbound";
          wa_message_id: string | null;
          type:
            | "text"
            | "image"
            | "document"
            | "audio"
            | "video"
            | "sticker"
            | "template"
            | "location"
            | "contacts"
            | "interactive"
            | "reaction"
            | "system";
          body: string | null;
          media_id: string | null;
          template_id: string | null;
          status: "pending" | "sent" | "delivered" | "read" | "failed" | "received";
          sender: string | null;
          sent_by: string | null;
          payload: Json;
          error: Json | null;
          payload_version: number;
        };
        Insert: {
          organization_id: string;
          conversation_id: string;
          direction: "inbound" | "outbound";
        } & Partial<Database["public"]["Tables"]["messages"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
        Relationships: [];
      };
      message_status_events: {
        Row: {
          id: string;
          organization_id: string;
          message_id: string;
          status: "sent" | "delivered" | "read" | "failed";
          occurred_at: string;
          raw: Json;
          created_at: string;
        };
        Insert: { organization_id: string; message_id: string; status: string } & Partial<
          Database["public"]["Tables"]["message_status_events"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["message_status_events"]["Row"]>;
        Relationships: [];
      };
      whatsapp_webhook_events: {
        Row: {
          id: string;
          organization_id: string | null;
          provider: string;
          event_type: string | null;
          external_id: string | null;
          payload: Json;
          status: "received" | "processed" | "failed" | "ignored";
          error: string | null;
          received_at: string;
          processed_at: string | null;
        };
        Insert: { provider?: string } & Partial<
          Database["public"]["Tables"]["whatsapp_webhook_events"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["whatsapp_webhook_events"]["Row"]>;
        Relationships: [];
      };
      conversation_notes: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          conversation_id: string;
          author_id: string | null;
          body: string;
        };
        Insert: { organization_id: string; conversation_id: string; body: string } & Partial<
          Database["public"]["Tables"]["conversation_notes"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["conversation_notes"]["Row"]>;
        Relationships: [];
      };
      quick_replies: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          shortcut: string;
          title: string;
          body: string;
          created_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          organization_id: string;
          shortcut: string;
          title: string;
          body: string;
        } & Partial<Database["public"]["Tables"]["quick_replies"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["quick_replies"]["Row"]>;
        Relationships: [];
      };
      automations: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          status: "draft" | "active" | "paused";
          trigger_type: string;
          trigger_config: Json;
          current_version: number;
          created_by: string | null;
          deleted_at: string | null;
        };
        Insert: { organization_id: string; name: string; trigger_type: string } & Partial<
          Database["public"]["Tables"]["automations"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["automations"]["Row"]>;
        Relationships: [];
      };
      automation_versions: {
        Row: {
          id: string;
          organization_id: string;
          automation_id: string;
          version: number;
          graph: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: { organization_id: string; automation_id: string; version: number } & Partial<
          Database["public"]["Tables"]["automation_versions"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["automation_versions"]["Row"]>;
        Relationships: [];
      };
      automation_nodes: {
        Row: {
          id: string;
          organization_id: string;
          automation_id: string;
          version: number;
          node_key: string;
          type: "trigger" | "condition" | "delay" | "action" | "branch";
          config: Json;
          position: Json;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          automation_id: string;
          version: number;
          node_key: string;
          type: string;
        } & Partial<Database["public"]["Tables"]["automation_nodes"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["automation_nodes"]["Row"]>;
        Relationships: [];
      };
      automation_edges: {
        Row: {
          id: string;
          organization_id: string;
          automation_id: string;
          version: number;
          from_node: string;
          to_node: string;
          branch: "yes" | "no" | null;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          automation_id: string;
          version: number;
          from_node: string;
          to_node: string;
        } & Partial<Database["public"]["Tables"]["automation_edges"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["automation_edges"]["Row"]>;
        Relationships: [];
      };
      automation_runs: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          automation_id: string;
          version: number;
          trigger_event: string | null;
          context: Json;
          status: "queued" | "running" | "succeeded" | "failed" | "paused" | "canceled";
          current_node: string | null;
          idempotency_key: string | null;
          error: string | null;
          started_at: string | null;
          finished_at: string | null;
        };
        Insert: { organization_id: string; automation_id: string; version: number } & Partial<
          Database["public"]["Tables"]["automation_runs"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["automation_runs"]["Row"]>;
        Relationships: [];
      };
      automation_run_steps: {
        Row: {
          id: string;
          organization_id: string;
          run_id: string;
          node_key: string;
          type: string;
          status: "ok" | "failed" | "skipped" | "waiting";
          input: Json;
          output: Json;
          error: string | null;
          occurred_at: string;
        };
        Insert: {
          organization_id: string;
          run_id: string;
          node_key: string;
          type: string;
          status: string;
        } & Partial<Database["public"]["Tables"]["automation_run_steps"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["automation_run_steps"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      automation_save: {
        Args: {
          p_org: string;
          p_id: string | null;
          p_name: string;
          p_description: string | null;
          p_trigger_type: string;
          p_trigger_config: Json;
          p_graph: Json;
        };
        Returns: Json;
      };
      automation_set_status: {
        Args: { p_org: string; p_id: string; p_status: string };
        Returns: undefined;
      };
      automation_duplicate: {
        Args: { p_org: string; p_id: string };
        Returns: string;
      };
      automation_delete: {
        Args: { p_org: string; p_id: string };
        Returns: undefined;
      };
      automation_start_run: {
        Args: {
          p_org: string;
          p_automation_id: string;
          p_trigger_event: string | null;
          p_context?: Json;
          p_idempotency?: string | null;
        };
        Returns: string;
      };
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
          p_org: string | null;
          p_type: string;
          p_payload?: Json;
          p_available_at?: string;
          p_priority?: number;
          p_max_attempts?: number;
          p_trace_id?: string;
          p_correlation_id?: string;
          p_idempotency_key?: string;
          p_payload_version?: number;
        };
        Returns: string;
      };
      try_consume_quota: {
        Args: { p_org: string; p_resource: string; p_amount?: number };
        Returns: boolean;
      };
      claim_idempotency: { Args: { p_org: string; p_key: string }; Returns: boolean };
      publish_event: {
        Args: {
          p_org: string;
          p_name: string;
          p_payload?: Json;
          p_payload_version?: number;
          p_trace_id?: string;
        };
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
      check_quota: {
        Args: { p_org: string; p_resource: string; p_amount?: number };
        Returns: boolean;
      };
      consume_quota: {
        Args: { p_org: string; p_resource: string; p_amount?: number };
        Returns: undefined;
      };
      write_trace: {
        Args: {
          p_org: string | null;
          p_trace_id: string;
          p_operation: string;
          p_status?: string;
          p_duration_ms?: number;
          p_correlation_id?: string;
          p_span_id?: string;
          p_metadata?: Json;
        };
        Returns: undefined;
      };
      dispatch_webhooks: {
        Args: { p_org: string; p_event: string; p_payload?: Json };
        Returns: number;
      };
      api_key_create: {
        Args: { p_org: string; p_name: string; p_scopes: string[]; p_expires_at?: string | null };
        Returns: Json;
      };
      api_key_revoke: { Args: { p_org: string; p_id: string }; Returns: undefined };
      verify_api_key: {
        Args: { p_key: string; p_method?: string | null; p_path?: string | null; p_request_id?: string | null };
        Returns: Json;
      };
      apply_market_template: { Args: { p_org: string; p_key: string }; Returns: undefined };
      wa_send_message: {
        Args: {
          p_org: string;
          p_conversation: string;
          p_type?: string;
          p_body?: string | null;
          p_template_id?: string | null;
          p_payload?: Json;
        };
        Returns: string;
      };
      wa_upsert_conversation_insight: {
        Args: {
          p_conversation: string;
          p_intent: string;
          p_temperature: string;
          p_urgency: string;
          p_sentiment: string;
          p_summary: string;
          p_next_best_action: string;
          p_suggested_reply: string | null;
          p_reasons: string[];
          p_source_last_message_at: string | null;
          p_model: string;
          p_tokens_in: number;
          p_tokens_out: number;
        };
        Returns: string;
      };
      wa_apply_status: {
        Args: {
          p_org: string;
          p_wa_message_id: string;
          p_status: string;
          p_occurred_at?: string;
          p_raw?: Json;
        };
        Returns: string | null;
      };
      wa_ingest_inbound: {
        Args: {
          p_org: string;
          p_phone_number_id: string;
          p_contact_wa_id: string;
          p_contact_name?: string | null;
          p_wa_message_id: string;
          p_type?: string;
          p_body?: string | null;
          p_payload?: Json;
        };
        Returns: string;
      };
      assign_conversation: {
        Args: { p_org: string; p_conversation: string; p_assignee: string | null };
        Returns: undefined;
      };
      mark_conversation_read: {
        Args: { p_org: string; p_conversation: string };
        Returns: undefined;
      };
      inbox_counters: { Args: { p_org: string }; Returns: Json };
      wa_send_context: { Args: { p_message_id: string }; Returns: Json };
      wa_mark_sent: {
        Args: { p_org: string; p_message_id: string; p_wa_message_id: string };
        Returns: undefined;
      };
      wa_mark_failed: {
        Args: { p_org: string; p_message_id: string; p_error: Json };
        Returns: undefined;
      };
      wa_store_connection: {
        Args: {
          p_org: string;
          p_provider: string;
          p_waba_id: string | null;
          p_business_id: string | null;
          p_name: string | null;
          p_phone_number_id: string;
          p_display: string | null;
          p_verified_name: string | null;
          p_access_token: string;
          p_app_secret?: string | null;
          p_verify_token?: string | null;
        };
        Returns: Json;
      };
      wa_resolve_phone: { Args: { p_phone_number_id: string }; Returns: Json };
      wa_log_webhook: {
        Args: {
          p_org: string | null;
          p_provider: string;
          p_event_type: string;
          p_external_id: string | null;
          p_payload?: Json;
        };
        Returns: undefined;
      };
      wa_set_conversation_status: {
        Args: { p_org: string; p_conversation: string; p_status: string };
        Returns: undefined;
      };
      wa_set_conversation_tags: {
        Args: { p_org: string; p_conversation: string; p_tags: string[] };
        Returns: undefined;
      };
      wa_send_media: {
        Args: {
          p_org: string;
          p_conversation: string;
          p_type: string;
          p_storage_path: string;
          p_mime: string;
          p_size: number;
          p_filename?: string | null;
          p_caption?: string | null;
        };
        Returns: string;
      };
      wa_register_inbound_media: {
        Args: {
          p_org: string;
          p_message_id: string;
          p_external_media_id: string;
          p_mime: string;
          p_filename?: string | null;
        };
        Returns: string;
      };
      wa_media_stored: {
        Args: {
          p_media_id: string;
          p_storage_path: string;
          p_sha256?: string | null;
          p_size?: number | null;
        };
        Returns: undefined;
      };
      wa_media_download_context: { Args: { p_media_id: string }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
