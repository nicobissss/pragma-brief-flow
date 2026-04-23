export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_plan_tasks: {
        Row: {
          action_url: string | null
          assignee: string
          assignee_user_id: string | null
          blocked_reason: string | null
          category: string
          checklist: Json | null
          client_offering_id: string
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string | null
          depends_on_task_ids: Json | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          order_index: number | null
          related_asset_id: string | null
          related_platform_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          action_url?: string | null
          assignee: string
          assignee_user_id?: string | null
          blocked_reason?: string | null
          category: string
          checklist?: Json | null
          client_offering_id: string
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string | null
          depends_on_task_ids?: Json | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          order_index?: number | null
          related_asset_id?: string | null
          related_platform_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          action_url?: string | null
          assignee?: string
          assignee_user_id?: string | null
          blocked_reason?: string | null
          category?: string
          checklist?: Json | null
          client_offering_id?: string
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string | null
          depends_on_task_ids?: Json | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          order_index?: number | null
          related_asset_id?: string | null
          related_platform_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_tasks_client_offering_id_fkey"
            columns: ["client_offering_id"]
            isOneToOne: false
            referencedRelation: "client_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_tasks_related_asset_id_fkey"
            columns: ["related_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_tasks_related_platform_id_fkey"
            columns: ["related_platform_id"]
            isOneToOne: false
            referencedRelation: "supported_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      asset_section_comments: {
        Row: {
          asset_id: string
          client_id: string
          comment_text: string
          created_at: string
          id: string
          section_name: string
          version_number: number
        }
        Insert: {
          asset_id: string
          client_id: string
          comment_text: string
          created_at?: string
          id?: string
          section_name: string
          version_number?: number
        }
        Update: {
          asset_id?: string
          client_id?: string
          comment_text?: string
          created_at?: string
          id?: string
          section_name?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_section_comments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_section_comments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_name: string
          asset_title: string | null
          asset_type: Database["public"]["Enums"]["asset_type"]
          assigned_to: string | null
          campaign_id: string | null
          client_comment: string | null
          client_id: string
          content: Json | null
          context_used: Json | null
          correction_prompt: string | null
          created_at: string
          due_date: string | null
          file_url: string | null
          id: string
          incorporated: boolean | null
          preview_url: string | null
          production_status: string | null
          status: Database["public"]["Enums"]["asset_status"]
          strategic_note: string | null
          strategic_note_approved: boolean | null
          version: number
        }
        Insert: {
          asset_name: string
          asset_title?: string | null
          asset_type: Database["public"]["Enums"]["asset_type"]
          assigned_to?: string | null
          campaign_id?: string | null
          client_comment?: string | null
          client_id: string
          content?: Json | null
          context_used?: Json | null
          correction_prompt?: string | null
          created_at?: string
          due_date?: string | null
          file_url?: string | null
          id?: string
          incorporated?: boolean | null
          preview_url?: string | null
          production_status?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          strategic_note?: string | null
          strategic_note_approved?: boolean | null
          version?: number
        }
        Update: {
          asset_name?: string
          asset_title?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type"]
          assigned_to?: string | null
          campaign_id?: string | null
          client_comment?: string | null
          client_id?: string
          content?: Json | null
          context_used?: Json | null
          correction_prompt?: string | null
          created_at?: string
          due_date?: string | null
          file_url?: string | null
          id?: string
          incorporated?: boolean | null
          preview_url?: string | null
          production_status?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          strategic_note?: string | null
          strategic_note_approved?: boolean | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_questions: {
        Row: {
          created_at: string
          field_key: string
          id: string
          is_active: boolean
          is_required: boolean
          options: Json | null
          order_index: number
          placeholder: string | null
          question_text: string
          question_type: Database["public"]["Enums"]["briefing_question_type"]
          step: number
          vertical: Database["public"]["Enums"]["briefing_vertical"]
        }
        Insert: {
          created_at?: string
          field_key: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          options?: Json | null
          order_index?: number
          placeholder?: string | null
          question_text: string
          question_type?: Database["public"]["Enums"]["briefing_question_type"]
          step: number
          vertical?: Database["public"]["Enums"]["briefing_vertical"]
        }
        Update: {
          created_at?: string
          field_key?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          options?: Json | null
          order_index?: number
          placeholder?: string | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["briefing_question_type"]
          step?: number
          vertical?: Database["public"]["Enums"]["briefing_vertical"]
        }
        Relationships: []
      }
      briefing_submissions: {
        Row: {
          answers: Json
          client_id: string
          created_at: string
          id: string
        }
        Insert: {
          answers?: Json
          client_id: string
          created_at?: string
          id?: string
        }
        Update: {
          answers?: Json
          client_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_materials: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          material_label: string | null
          material_ref: string
          material_type: string
          material_url: string | null
          selected: boolean
          updated_at: string
          usage_hint: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          material_label?: string | null
          material_ref: string
          material_type: string
          material_url?: string | null
          selected?: boolean
          updated_at?: string
          usage_hint?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          material_label?: string | null
          material_ref?: string
          material_type?: string
          material_url?: string | null
          selected?: boolean
          updated_at?: string
          usage_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_materials_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brief_updated_at: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          key_message: string | null
          last_notified_at: string | null
          name: string
          objective: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          target_audience: string | null
          timeline: string | null
          updated_at: string
        }
        Insert: {
          brief_updated_at?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          key_message?: string | null
          last_notified_at?: string | null
          name: string
          objective?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_audience?: string | null
          timeline?: string | null
          updated_at?: string
        }
        Update: {
          brief_updated_at?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          key_message?: string | null
          last_notified_at?: string | null
          name?: string
          objective?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_audience?: string | null
          timeline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_asset_requests: {
        Row: {
          client_id: string
          created_at: string
          id: string
          pragma_notified: boolean
          requested_items: Json
          status: Database["public"]["Enums"]["asset_request_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          pragma_notified?: boolean
          requested_items?: Json
          status?: Database["public"]["Enums"]["asset_request_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          pragma_notified?: boolean
          requested_items?: Json
          status?: Database["public"]["Enums"]["asset_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_asset_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_competitor_analyses: {
        Row: {
          ai_summary: string | null
          analyzed_at: string | null
          client_id: string
          competitor_ig_handle: string | null
          competitor_name: string | null
          competitor_url: string | null
          created_at: string
          error: string | null
          hooks: Json | null
          id: string
          positioning_gaps: Json | null
          pricing_observed: Json | null
          raw_data: Json | null
          status: string
          treatments: Json | null
        }
        Insert: {
          ai_summary?: string | null
          analyzed_at?: string | null
          client_id: string
          competitor_ig_handle?: string | null
          competitor_name?: string | null
          competitor_url?: string | null
          created_at?: string
          error?: string | null
          hooks?: Json | null
          id?: string
          positioning_gaps?: Json | null
          pricing_observed?: Json | null
          raw_data?: Json | null
          status?: string
          treatments?: Json | null
        }
        Update: {
          ai_summary?: string | null
          analyzed_at?: string | null
          client_id?: string
          competitor_ig_handle?: string | null
          competitor_name?: string | null
          competitor_url?: string | null
          created_at?: string
          error?: string | null
          hooks?: Json | null
          id?: string
          positioning_gaps?: Json | null
          pricing_observed?: Json | null
          raw_data?: Json | null
          status?: string
          treatments?: Json | null
        }
        Relationships: []
      }
      client_context_snapshots: {
        Row: {
          client_id: string | null
          context_data: Json
          created_at: string | null
          generation_id: string | null
          id: string
          snapshot_type: string | null
          tokens_used: number | null
        }
        Insert: {
          client_id?: string | null
          context_data?: Json
          created_at?: string | null
          generation_id?: string | null
          id?: string
          snapshot_type?: string | null
          tokens_used?: number | null
        }
        Update: {
          client_id?: string | null
          context_data?: Json
          created_at?: string | null
          generation_id?: string | null
          id?: string
          snapshot_type?: string | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_context_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_context_snapshots_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "tool_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          author: string | null
          client_id: string | null
          created_at: string | null
          id: string
          note: string
        }
        Insert: {
          author?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          note: string
        }
        Update: {
          author?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_offerings: {
        Row: {
          accepted_at: string | null
          actual_outcomes: Json | null
          client_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          custom_deliverables: Json | null
          custom_name: string | null
          custom_price_eur: number | null
          id: string
          notes: string | null
          offering_template_id: string
          proposed_at: string | null
          recommendation_reasons: Json | null
          recommendation_score: number | null
          started_at: string | null
          status: string
          was_recommended: boolean | null
        }
        Insert: {
          accepted_at?: string | null
          actual_outcomes?: Json | null
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_deliverables?: Json | null
          custom_name?: string | null
          custom_price_eur?: number | null
          id?: string
          notes?: string | null
          offering_template_id: string
          proposed_at?: string | null
          recommendation_reasons?: Json | null
          recommendation_score?: number | null
          started_at?: string | null
          status?: string
          was_recommended?: boolean | null
        }
        Update: {
          accepted_at?: string | null
          actual_outcomes?: Json | null
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_deliverables?: Json | null
          custom_name?: string | null
          custom_price_eur?: number | null
          id?: string
          notes?: string | null
          offering_template_id?: string
          proposed_at?: string | null
          recommendation_reasons?: Json | null
          recommendation_score?: number | null
          started_at?: string | null
          status?: string
          was_recommended?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "client_offerings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_offerings_offering_template_id_fkey"
            columns: ["offering_template_id"]
            isOneToOne: false
            referencedRelation: "offering_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_platforms: {
        Row: {
          access_notes: string | null
          account_identifier: string | null
          client_id: string
          created_at: string | null
          has_access: boolean | null
          id: string
          integration_status: string | null
          list_size: number | null
          monthly_volume: number | null
          notes: string | null
          plan_tier: string | null
          platform_id: string
          updated_at: string | null
        }
        Insert: {
          access_notes?: string | null
          account_identifier?: string | null
          client_id: string
          created_at?: string | null
          has_access?: boolean | null
          id?: string
          integration_status?: string | null
          list_size?: number | null
          monthly_volume?: number | null
          notes?: string | null
          plan_tier?: string | null
          platform_id: string
          updated_at?: string | null
        }
        Update: {
          access_notes?: string | null
          account_identifier?: string | null
          client_id?: string
          created_at?: string | null
          has_access?: boolean | null
          id?: string
          integration_status?: string | null
          list_size?: number | null
          monthly_volume?: number | null
          notes?: string | null
          plan_tier?: string | null
          platform_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_platforms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "supported_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      client_winning_patterns: {
        Row: {
          asset_type: string | null
          client_id: string
          created_at: string
          extracted_patterns: Json | null
          id: string
          performance_metric: string | null
          source_content: string | null
          source_label: string | null
        }
        Insert: {
          asset_type?: string | null
          client_id: string
          created_at?: string
          extracted_patterns?: Json | null
          id?: string
          performance_metric?: string | null
          source_content?: string | null
          source_label?: string | null
        }
        Update: {
          asset_type?: string | null
          client_id?: string
          created_at?: string
          extracted_patterns?: Json | null
          id?: string
          performance_metric?: string | null
          source_content?: string | null
          source_label?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          activated_tools: Json | null
          city: string | null
          company_name: string
          created_at: string
          email: string
          id: string
          market: Database["public"]["Enums"]["market"]
          max_revision_rounds: number | null
          name: string
          pipeline_status: string | null
          project_plan: Json | null
          project_plan_shared: boolean | null
          prospect_id: string | null
          status: Database["public"]["Enums"]["client_status"]
          sub_niche: string
          user_id: string | null
          vertical: string
          website_url: string | null
        }
        Insert: {
          activated_tools?: Json | null
          city?: string | null
          company_name: string
          created_at?: string
          email: string
          id?: string
          market: Database["public"]["Enums"]["market"]
          max_revision_rounds?: number | null
          name: string
          pipeline_status?: string | null
          project_plan?: Json | null
          project_plan_shared?: boolean | null
          prospect_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          sub_niche: string
          user_id?: string | null
          vertical: string
          website_url?: string | null
        }
        Update: {
          activated_tools?: Json | null
          city?: string | null
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          market?: Database["public"]["Enums"]["market"]
          max_revision_rounds?: number | null
          name?: string
          pipeline_status?: string | null
          project_plan?: Json | null
          project_plan_shared?: boolean | null
          prospect_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          sub_niche?: string
          user_id?: string | null
          vertical?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_url: string
          filename: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_url: string
          filename: string
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_url?: string
          filename?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      email_log: {
        Row: {
          client_id: string | null
          created_at: string | null
          error: string | null
          id: string
          status: string | null
          subject: string | null
          to_email: string
          type: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          status?: string | null
          subject?: string | null
          to_email: string
          type: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          status?: string | null
          subject?: string | null
          to_email?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          id: string
          is_active: boolean | null
          subject: string
          type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body_html: string
          id?: string
          is_active?: boolean | null
          subject: string
          type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string
          id?: string
          is_active?: boolean | null
          subject?: string
          type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
        }
        Relationships: []
      }
      kickoff_briefs: {
        Row: {
          audio_file_url: string | null
          client_id: string
          client_materials: Json | null
          client_rules: Json | null
          context_completeness_score: number | null
          created_at: string
          generated_prompts: Json | null
          id: string
          pragma_approved: boolean | null
          preferred_tone: string | null
          suggested_questions: Json | null
          suggested_services: Json | null
          suggested_services_approved: boolean | null
          transcript_quality: string | null
          transcript_status:
            | Database["public"]["Enums"]["transcript_status"]
            | null
          transcript_text: string | null
          voice_reference: string | null
        }
        Insert: {
          audio_file_url?: string | null
          client_id: string
          client_materials?: Json | null
          client_rules?: Json | null
          context_completeness_score?: number | null
          created_at?: string
          generated_prompts?: Json | null
          id?: string
          pragma_approved?: boolean | null
          preferred_tone?: string | null
          suggested_questions?: Json | null
          suggested_services?: Json | null
          suggested_services_approved?: boolean | null
          transcript_quality?: string | null
          transcript_status?:
            | Database["public"]["Enums"]["transcript_status"]
            | null
          transcript_text?: string | null
          voice_reference?: string | null
        }
        Update: {
          audio_file_url?: string | null
          client_id?: string
          client_materials?: Json | null
          client_rules?: Json | null
          context_completeness_score?: number | null
          created_at?: string
          generated_prompts?: Json | null
          id?: string
          pragma_approved?: boolean | null
          preferred_tone?: string | null
          suggested_questions?: Json | null
          suggested_services?: Json | null
          suggested_services_approved?: boolean | null
          transcript_quality?: string | null
          transcript_status?:
            | Database["public"]["Enums"]["transcript_status"]
            | null
          transcript_text?: string | null
          voice_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kickoff_briefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      kickoff_question_templates: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          order_index: number
          question_text: string
          sub_niche: string | null
          updated_at: string
          vertical: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          question_text: string
          sub_niche?: string | null
          updated_at?: string
          vertical: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          question_text?: string
          sub_niche?: string | null
          updated_at?: string
          vertical?: string
        }
        Relationships: []
      }
      kickoff_questions: {
        Row: {
          category: string
          client_id: string
          created_at: string
          id: string
          is_checked: boolean
          order_index: number
          question_text: string
          sub_niche: string | null
          vertical: string | null
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string
          id?: string
          is_checked?: boolean
          order_index?: number
          question_text: string
          sub_niche?: string | null
          vertical?: string | null
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          id?: string
          is_checked?: boolean
          order_index?: number
          question_text?: string
          sub_niche?: string | null
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kickoff_questions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          id: string
          updated_at: string
        }
        Insert: {
          category: string
          content?: string
          id?: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      offering_templates: {
        Row: {
          applicable_sub_niches: Json | null
          applicable_verticals: Json | null
          category: string
          code: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          deliverables: Json
          description: string | null
          expected_outcomes: Json | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          monthly_fee_eur: number | null
          monthly_hours_estimate: number | null
          name: string
          one_shot_fee_eur: number | null
          optional_platforms: Json | null
          recommendation_rules: Json | null
          recommended_platforms: Json | null
          required_platforms: Json | null
          setup_fee_eur: number | null
          setup_hours_estimate: number | null
          short_name: string
          sort_order: number | null
          task_templates: Json | null
          tier: number
          updated_at: string | null
          use_cases: string[] | null
          value_proposition: string | null
        }
        Insert: {
          applicable_sub_niches?: Json | null
          applicable_verticals?: Json | null
          category: string
          code: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deliverables: Json
          description?: string | null
          expected_outcomes?: Json | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          monthly_fee_eur?: number | null
          monthly_hours_estimate?: number | null
          name: string
          one_shot_fee_eur?: number | null
          optional_platforms?: Json | null
          recommendation_rules?: Json | null
          recommended_platforms?: Json | null
          required_platforms?: Json | null
          setup_fee_eur?: number | null
          setup_hours_estimate?: number | null
          short_name: string
          sort_order?: number | null
          task_templates?: Json | null
          tier: number
          updated_at?: string | null
          use_cases?: string[] | null
          value_proposition?: string | null
        }
        Update: {
          applicable_sub_niches?: Json | null
          applicable_verticals?: Json | null
          category?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deliverables?: Json
          description?: string | null
          expected_outcomes?: Json | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          monthly_fee_eur?: number | null
          monthly_hours_estimate?: number | null
          name?: string
          one_shot_fee_eur?: number | null
          optional_platforms?: Json | null
          recommendation_rules?: Json | null
          recommended_platforms?: Json | null
          required_platforms?: Json | null
          setup_fee_eur?: number | null
          setup_hours_estimate?: number | null
          short_name?: string
          sort_order?: number | null
          task_templates?: Json | null
          tier?: number
          updated_at?: string | null
          use_cases?: string[] | null
          value_proposition?: string | null
        }
        Relationships: []
      }
      pragma_rules: {
        Row: {
          applies_to_vertical: string | null
          category: string
          content: string
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          applies_to_vertical?: string | null
          category: string
          content: string
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          applies_to_vertical?: string | null
          category?: string
          content?: string
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          client_notes: string | null
          created_at: string
          full_proposal_content: Json | null
          id: string
          pragma_notes: string | null
          pricing: Json | null
          prospect_id: string
          recommended_flow: string | null
          recommended_offering_code: string | null
          recommended_tools: Json | null
          shared_at: string | null
          shared_with_client: boolean | null
          timeline: string | null
        }
        Insert: {
          client_notes?: string | null
          created_at?: string
          full_proposal_content?: Json | null
          id?: string
          pragma_notes?: string | null
          pricing?: Json | null
          prospect_id: string
          recommended_flow?: string | null
          recommended_offering_code?: string | null
          recommended_tools?: Json | null
          shared_at?: string | null
          shared_with_client?: boolean | null
          timeline?: string | null
        }
        Update: {
          client_notes?: string | null
          created_at?: string
          full_proposal_content?: Json | null
          id?: string
          pragma_notes?: string | null
          pricing?: Json | null
          prospect_id?: string
          recommended_flow?: string | null
          recommended_offering_code?: string | null
          recommended_tools?: Json | null
          shared_at?: string | null
          shared_with_client?: boolean | null
          timeline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          briefing_answers: Json
          call_date: string | null
          call_notes: string | null
          call_platform: string | null
          call_scheduled_at: string | null
          call_status: Database["public"]["Enums"]["call_status"]
          company_name: string
          created_at: string
          email: string
          follow_up_date: string | null
          id: string
          market: Database["public"]["Enums"]["market"]
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["prospect_status"]
          sub_niche: string
          vertical: string
        }
        Insert: {
          briefing_answers?: Json
          call_date?: string | null
          call_notes?: string | null
          call_platform?: string | null
          call_scheduled_at?: string | null
          call_status?: Database["public"]["Enums"]["call_status"]
          company_name: string
          created_at?: string
          email: string
          follow_up_date?: string | null
          id?: string
          market: Database["public"]["Enums"]["market"]
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          sub_niche: string
          vertical: string
        }
        Update: {
          briefing_answers?: Json
          call_date?: string | null
          call_notes?: string | null
          call_platform?: string | null
          call_scheduled_at?: string | null
          call_status?: Database["public"]["Enums"]["call_status"]
          company_name?: string
          created_at?: string
          email?: string
          follow_up_date?: string | null
          id?: string
          market?: Database["public"]["Enums"]["market"]
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          sub_niche?: string
          vertical?: string
        }
        Relationships: []
      }
      revision_rounds: {
        Row: {
          asset_id: string
          comment: string | null
          created_at: string
          id: string
          requested_by: Database["public"]["Enums"]["revision_requested_by"]
          round_number: number
        }
        Insert: {
          asset_id: string
          comment?: string | null
          created_at?: string
          id?: string
          requested_by: Database["public"]["Enums"]["revision_requested_by"]
          round_number: number
        }
        Update: {
          asset_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          requested_by?: Database["public"]["Enums"]["revision_requested_by"]
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "revision_rounds_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      slotty_workspace_requests: {
        Row: {
          brand_assets: Json | null
          client_email: string
          client_id: string | null
          client_name: string
          created_at: string | null
          error: string | null
          id: string
          processed_at: string | null
          status: string | null
          workspace_config: Json
          workspace_id: string | null
        }
        Insert: {
          brand_assets?: Json | null
          client_email: string
          client_id?: string | null
          client_name: string
          created_at?: string | null
          error?: string | null
          id?: string
          processed_at?: string | null
          status?: string | null
          workspace_config?: Json
          workspace_id?: string | null
        }
        Update: {
          brand_assets?: Json | null
          client_email?: string
          client_id?: string | null
          client_name?: string
          created_at?: string | null
          error?: string | null
          id?: string
          processed_at?: string | null
          status?: string | null
          workspace_config?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slotty_workspace_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      supported_platforms: {
        Row: {
          category: string
          icon: string | null
          id: string
          integration_type: string | null
          name: string
          notes: string | null
          sort_order: number | null
        }
        Insert: {
          category: string
          icon?: string | null
          id: string
          integration_type?: string | null
          name: string
          notes?: string | null
          sort_order?: number | null
        }
        Update: {
          category?: string
          icon?: string | null
          id?: string
          integration_type?: string | null
          name?: string
          notes?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tool_generations: {
        Row: {
          client_id: string | null
          content_ready_at: string | null
          context_score_at_generation: number | null
          created_at: string | null
          id: string
          prompt: Json | null
          sent_at: string | null
          status: string | null
          tool_name: string
        }
        Insert: {
          client_id?: string | null
          content_ready_at?: string | null
          context_score_at_generation?: number | null
          created_at?: string | null
          id?: string
          prompt?: Json | null
          sent_at?: string | null
          status?: string | null
          tool_name: string
        }
        Update: {
          client_id?: string | null
          content_ready_at?: string | null
          context_score_at_generation?: number | null
          created_at?: string | null
          id?: string
          prompt?: Json | null
          sent_at?: string | null
          status?: string | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_generations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_results: {
        Row: {
          client_id: string | null
          created_at: string | null
          event_type: string
          generation_id: string | null
          id: string
          metadata: Json | null
          payload: Json
          status: string | null
          tool_name: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          event_type: string
          generation_id?: string | null
          id?: string
          metadata?: Json | null
          payload?: Json
          status?: string | null
          tool_name: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          event_type?: string
          generation_id?: string | null
          id?: string
          metadata?: Json | null
          payload?: Json
          status?: string | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_results_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_results_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "tool_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vertical_pattern_suggestions: {
        Row: {
          approved_as_default: boolean
          approved_at: string | null
          client_count: number
          created_at: string
          example_client_ids: string[] | null
          id: string
          rule_text: string
          sub_niche: string | null
          updated_at: string
          vertical: string
        }
        Insert: {
          approved_as_default?: boolean
          approved_at?: string | null
          client_count?: number
          created_at?: string
          example_client_ids?: string[] | null
          id?: string
          rule_text: string
          sub_niche?: string | null
          updated_at?: string
          vertical: string
        }
        Update: {
          approved_as_default?: boolean
          approved_at?: string | null
          client_count?: number
          created_at?: string
          example_client_ids?: string[] | null
          id?: string
          rule_text?: string
          sub_niche?: string | null
          updated_at?: string
          vertical?: string
        }
        Relationships: []
      }
      webhook_log: {
        Row: {
          created_at: string | null
          direction: string
          error: string | null
          event_type: string | null
          id: string
          payload: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          direction: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_client_action_plan: {
        Row: {
          action_url: string | null
          assignee: string | null
          assignee_user_id: string | null
          blocked_reason: string | null
          category: string | null
          checklist: Json | null
          client_id: string | null
          client_offering_id: string | null
          company_name: string | null
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string | null
          depends_on_task_ids: Json | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string | null
          offering_code: string | null
          offering_name: string | null
          offering_status: string | null
          order_index: number | null
          progress_weight: number | null
          related_asset_id: string | null
          related_platform_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_tasks_client_offering_id_fkey"
            columns: ["client_offering_id"]
            isOneToOne: false
            referencedRelation: "client_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_tasks_related_asset_id_fkey"
            columns: ["related_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_tasks_related_platform_id_fkey"
            columns: ["related_platform_id"]
            isOneToOne: false
            referencedRelation: "supported_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_offerings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      clone_kickoff_questions_for_client: {
        Args: {
          p_client_id: string
          p_replace?: boolean
          p_sub_niche?: string
          p_vertical: string
        }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_tasks_for_offering: {
        Args: { p_client_offering_id: string }
        Returns: {
          action_url: string | null
          assignee: string
          assignee_user_id: string | null
          blocked_reason: string | null
          category: string
          checklist: Json | null
          client_offering_id: string
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string | null
          depends_on_task_ids: Json | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          order_index: number | null
          related_asset_id: string | null
          related_platform_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "action_plan_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "pragma_admin" | "client"
      asset_request_status: "pending" | "partial" | "complete"
      asset_status: "pending_review" | "change_requested" | "approved"
      asset_type: "landing_page" | "email_flow" | "social_post" | "blog_article"
      briefing_question_type:
        | "text"
        | "select"
        | "multiselect"
        | "number"
        | "url"
        | "boolean"
      briefing_vertical: "all" | "salud" | "elearning" | "deporte"
      call_status:
        | "not_scheduled"
        | "scheduled"
        | "done_positive"
        | "done_negative"
        | "no_show"
      campaign_status: "draft" | "active" | "completed"
      client_status: "active" | "paused" | "churned"
      market: "es" | "it" | "ar"
      prospect_status:
        | "new"
        | "proposal_ready"
        | "call_scheduled"
        | "accepted"
        | "rejected"
        | "archived"
      revision_requested_by: "client" | "pragma"
      transcript_status: "pending" | "processing" | "ready"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["pragma_admin", "client"],
      asset_request_status: ["pending", "partial", "complete"],
      asset_status: ["pending_review", "change_requested", "approved"],
      asset_type: ["landing_page", "email_flow", "social_post", "blog_article"],
      briefing_question_type: [
        "text",
        "select",
        "multiselect",
        "number",
        "url",
        "boolean",
      ],
      briefing_vertical: ["all", "salud", "elearning", "deporte"],
      call_status: [
        "not_scheduled",
        "scheduled",
        "done_positive",
        "done_negative",
        "no_show",
      ],
      campaign_status: ["draft", "active", "completed"],
      client_status: ["active", "paused", "churned"],
      market: ["es", "it", "ar"],
      prospect_status: [
        "new",
        "proposal_ready",
        "call_scheduled",
        "accepted",
        "rejected",
        "archived",
      ],
      revision_requested_by: ["client", "pragma"],
      transcript_status: ["pending", "processing", "ready"],
    },
  },
} as const
