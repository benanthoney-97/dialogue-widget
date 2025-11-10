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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_map: {
        Row: {
          agent_id: string
          agent_name: string | null
          auth: string | null
          author: string | null
          client_id: number | null
          created_at: string | null
          description: string | null
          key: string
          pdf_path: string | null
          region: string | null
          talk_label: string | null
          url: string | null
          work_label: string | null
        }
        Insert: {
          agent_id: string
          agent_name?: string | null
          auth?: string | null
          author?: string | null
          client_id?: number | null
          created_at?: string | null
          description?: string | null
          key: string
          pdf_path?: string | null
          region?: string | null
          talk_label?: string | null
          url?: string | null
          work_label?: string | null
        }
        Update: {
          agent_id?: string
          agent_name?: string | null
          auth?: string | null
          author?: string | null
          client_id?: number | null
          created_at?: string | null
          description?: string | null
          key?: string
          pdf_path?: string | null
          region?: string | null
          talk_label?: string | null
          url?: string | null
          work_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_map_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_documents: {
        Row: {
          id: string
          agent_id: string
          file_name: string
          storage_path: string | null
          public_url: string | null
          mime_type: string | null
          file_size: number | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          file_name: string
          storage_path?: string | null
          public_url?: string | null
          mime_type?: string | null
          file_size?: number | null
          source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          file_name?: string
          storage_path?: string | null
          public_url?: string | null
          mime_type?: string | null
          file_size?: number | null
          source?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_map"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      client_agents: {
        Row: {
          agent_id: string
          client_id: number
          created_at: string
        }
        Insert: {
          agent_id: string
          client_id: number
          created_at?: string
        }
        Update: {
          agent_id?: string
          client_id?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agents: Json | null
          created_at: string | null
          default_agent_id: string | null
          display_name: string | null
          id: number
          name: string
        }
        Insert: {
          agents?: Json | null
          created_at?: string | null
          default_agent_id?: string | null
          display_name?: string | null
          id?: number
          name: string
        }
        Update: {
          agents?: Json | null
          created_at?: string | null
          default_agent_id?: string | null
          display_name?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      dialogues: {
        Row: {
          agent_id: string | null
          body: Json | null
          call_duration_secs: number | null
          call_summary_title: string | null
          client_id: number | null
          content_gaps: Json | null
          conversation_id: string | null
          escalation_details: string | null
          escalation_status: boolean | null
          event_timestamp: number | null
          id: number
          main_language: string | null
          main_topics: Json | null
          questions: Json | null
          received_at: string | null
          resolved_status: boolean | null
          signature: string | null
          status: string | null
          transcript: Json | null
          transcript_summary: string | null
          type: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          agent_id?: string | null
          body?: Json | null
          call_duration_secs?: number | null
          call_summary_title?: string | null
          client_id?: number | null
          content_gaps?: Json | null
          conversation_id?: string | null
          escalation_details?: string | null
          escalation_status?: boolean | null
          event_timestamp?: number | null
          id?: number
          main_language?: string | null
          main_topics?: Json | null
          questions?: Json | null
          received_at?: string | null
          resolved_status?: boolean | null
          signature?: string | null
          status?: string | null
          transcript?: Json | null
          transcript_summary?: string | null
          type?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          agent_id?: string | null
          body?: Json | null
          call_duration_secs?: number | null
          call_summary_title?: string | null
          client_id?: number | null
          content_gaps?: Json | null
          conversation_id?: string | null
          escalation_details?: string | null
          escalation_status?: boolean | null
          event_timestamp?: number | null
          id?: number
          main_language?: string | null
          main_topics?: Json | null
          questions?: Json | null
          received_at?: string | null
          resolved_status?: boolean | null
          signature?: string | null
          status?: string | null
          transcript?: Json | null
          transcript_summary?: string | null
          type?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "dialogues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_map: {
        Row: {
          agent_id: string
          background: string
          border: string
          created_at: string
          key: string
          text_color: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          background: string
          border: string
          created_at?: string
          key: string
          text_color: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          background?: string
          border?: string
          created_at?: string
          key?: string
          text_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_map_agent_fk"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agent_map"
            referencedColumns: ["agent_id"]
          },
        ]
      }
    }
    Views: {
      dialogues_count_by_client: {
        Row: {
          client_id: number | null
          dialogues_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dialogues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
