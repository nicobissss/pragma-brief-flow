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
          asset_type: Database["public"]["Enums"]["asset_type"]
          campaign_id: string | null
          client_comment: string | null
          client_id: string
          content: Json | null
          correction_prompt: string | null
          created_at: string
          file_url: string | null
          id: string
          status: Database["public"]["Enums"]["asset_status"]
          version: number
        }
        Insert: {
          asset_name: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          campaign_id?: string | null
          client_comment?: string | null
          client_id: string
          content?: Json | null
          correction_prompt?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["asset_status"]
          version?: number
        }
        Update: {
          asset_name?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          campaign_id?: string | null
          client_comment?: string | null
          client_id?: string
          content?: Json | null
          correction_prompt?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["asset_status"]
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
      campaigns: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          key_message: string | null
          name: string
          objective: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          target_audience: string | null
          timeline: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          key_message?: string | null
          name: string
          objective?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_audience?: string | null
          timeline?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          key_message?: string | null
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
      clients: {
        Row: {
          company_name: string
          created_at: string
          email: string
          id: string
          market: Database["public"]["Enums"]["market"]
          name: string
          prospect_id: string | null
          status: Database["public"]["Enums"]["client_status"]
          sub_niche: string
          user_id: string | null
          vertical: string
        }
        Insert: {
          company_name: string
          created_at?: string
          email: string
          id?: string
          market: Database["public"]["Enums"]["market"]
          name: string
          prospect_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          sub_niche: string
          user_id?: string | null
          vertical: string
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          market?: Database["public"]["Enums"]["market"]
          name?: string
          prospect_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          sub_niche?: string
          user_id?: string | null
          vertical?: string
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
      kickoff_briefs: {
        Row: {
          audio_file_url: string | null
          client_id: string
          client_materials: Json | null
          created_at: string
          generated_prompts: Json | null
          id: string
          pragma_approved: boolean | null
          suggested_questions: Json | null
          transcript_status:
            | Database["public"]["Enums"]["transcript_status"]
            | null
          transcript_text: string | null
        }
        Insert: {
          audio_file_url?: string | null
          client_id: string
          client_materials?: Json | null
          created_at?: string
          generated_prompts?: Json | null
          id?: string
          pragma_approved?: boolean | null
          suggested_questions?: Json | null
          transcript_status?:
            | Database["public"]["Enums"]["transcript_status"]
            | null
          transcript_text?: string | null
        }
        Update: {
          audio_file_url?: string | null
          client_id?: string
          client_materials?: Json | null
          created_at?: string
          generated_prompts?: Json | null
          id?: string
          pragma_approved?: boolean | null
          suggested_questions?: Json | null
          transcript_status?:
            | Database["public"]["Enums"]["transcript_status"]
            | null
          transcript_text?: string | null
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
      proposals: {
        Row: {
          created_at: string
          full_proposal_content: Json | null
          id: string
          pitch_suggestions: string | null
          pragma_notes: string | null
          pricing: Json | null
          prospect_id: string
          recommended_flow: string | null
          recommended_tools: Json | null
          timeline: string | null
        }
        Insert: {
          created_at?: string
          full_proposal_content?: Json | null
          id?: string
          pitch_suggestions?: string | null
          pragma_notes?: string | null
          pricing?: Json | null
          prospect_id: string
          recommended_flow?: string | null
          recommended_tools?: Json | null
          timeline?: string | null
        }
        Update: {
          created_at?: string
          full_proposal_content?: Json | null
          id?: string
          pitch_suggestions?: string | null
          pragma_notes?: string | null
          pricing?: Json | null
          prospect_id?: string
          recommended_flow?: string | null
          recommended_tools?: Json | null
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
          call_notes: string | null
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
          call_notes?: string | null
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
          call_notes?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      app_role: "pragma_admin" | "client"
      asset_status: "pending_review" | "change_requested" | "approved"
      asset_type: "landing_page" | "email_flow" | "social_post" | "blog_article"
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
      asset_status: ["pending_review", "change_requested", "approved"],
      asset_type: ["landing_page", "email_flow", "social_post", "blog_article"],
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
