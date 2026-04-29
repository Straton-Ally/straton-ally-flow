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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          break_duration: string | null
          break_start_at: string | null
          break_total_minutes: number
          check_in_at: string | null
          check_in_ip: string | null
          check_in_location: Json | null
          check_out_at: string | null
          check_out_ip: string | null
          check_out_location: Json | null
          created_at: string
          date: string
          employee_id: string
          id: string
          in_time: string | null
          last_verified_at: string | null
          last_verified_ip: string | null
          last_verified_location: Json | null
          notes: string | null
          out_time: string | null
          status: string
          total_work_minutes: number | null
        }
        Insert: {
          break_duration?: string | null
          break_start_at?: string | null
          break_total_minutes?: number
          check_in_at?: string | null
          check_in_ip?: string | null
          check_in_location?: Json | null
          check_out_at?: string | null
          check_out_ip?: string | null
          check_out_location?: Json | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          in_time?: string | null
          last_verified_at?: string | null
          last_verified_ip?: string | null
          last_verified_location?: Json | null
          notes?: string | null
          out_time?: string | null
          status: string
          total_work_minutes?: number | null
        }
        Update: {
          break_duration?: string | null
          break_start_at?: string | null
          break_total_minutes?: number
          check_in_at?: string | null
          check_in_ip?: string | null
          check_in_location?: Json | null
          check_out_at?: string | null
          check_out_ip?: string | null
          check_out_location?: Json | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          in_time?: string | null
          last_verified_at?: string | null
          last_verified_ip?: string | null
          last_verified_location?: Json | null
          notes?: string | null
          out_time?: string | null
          status?: string
          total_work_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      duty_schedule_templates: {
        Row: {
          id: string
          schedule_name: string
          shift_type: 'regular' | 'rotating' | 'flexible' | 'night'
          start_time: string
          end_time: string
          work_days: string[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          schedule_name: string
          shift_type: 'regular' | 'rotating' | 'flexible' | 'night'
          start_time: string
          end_time: string
          work_days?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          schedule_name?: string
          shift_type?: 'regular' | 'rotating' | 'flexible' | 'night'
          start_time?: string
          end_time?: string
          work_days?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      early_checkout_requests: {
        Row: {
          id: string
          employee_id: string
          date: string
          reason: string
          requested_checkout_time: string
          status: 'pending' | 'approved' | 'declined'
          reviewed_at: string | null
          reviewed_by: string | null
          response_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          date: string
          reason: string
          requested_checkout_time: string
          status?: 'pending' | 'approved' | 'declined'
          reviewed_at?: string | null
          reviewed_by?: string | null
          response_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          date?: string
          reason?: string
          requested_checkout_time?: string
          status?: 'pending' | 'approved' | 'declined'
          reviewed_at?: string | null
          reviewed_by?: string | null
          response_notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "early_checkout_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          created_at: string
          department_id: string | null
          designation: string | null
          duty_schedule_template_id: string | null
          custom_work_start_time: string | null
          custom_work_end_time: string | null
          emergency_contact: string | null
          employee_id: string
          gender: string | null
          id: string
          is_team_lead: boolean
          joining_date: string
          office_id: string | null
          phone: string | null
          updated_at: string
          user_id: string
          work_location: 'remote' | 'on_site' | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          department_id?: string | null
          designation?: string | null
          duty_schedule_template_id?: string | null
          custom_work_start_time?: string | null
          custom_work_end_time?: string | null
          emergency_contact?: string | null
          employee_id: string
          gender?: string | null
          id?: string
          is_team_lead?: boolean
          joining_date: string
          office_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          work_location?: 'remote' | 'on_site' | null
        }
        Update: {
          address?: string | null
          created_at?: string
          department_id?: string | null
          designation?: string | null
          duty_schedule_template_id?: string | null
          custom_work_start_time?: string | null
          custom_work_end_time?: string | null
          emergency_contact?: string | null
          employee_id?: string
          gender?: string | null
          id?: string
          is_team_lead?: boolean
          joining_date?: string
          office_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          work_location?: 'remote' | 'on_site' | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          address: string
          city: string
          country: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          country: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      office_settings: {
        Row: {
          allowed_ip_ranges: string[] | null
          break_duration: unknown
          created_at: string
          geo_fencing_enabled: boolean
          id: string
          latitude: number | null
          longitude: number | null
          office_id: string
          radius_meters: number | null
          require_ip_whitelist: boolean
          timezone: string
          updated_at: string
          work_days: string[] | null
          work_end_time: string
          work_start_time: string
        }
        Insert: {
          allowed_ip_ranges?: string[] | null
          break_duration?: unknown
          created_at?: string
          geo_fencing_enabled?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          office_id: string
          radius_meters?: number | null
          require_ip_whitelist?: boolean
          timezone?: string
          updated_at?: string
          work_days?: string[] | null
          work_end_time?: string
          work_start_time?: string
        }
        Update: {
          allowed_ip_ranges?: string[] | null
          break_duration?: unknown
          created_at?: string
          geo_fencing_enabled?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          office_id?: string
          radius_meters?: number | null
          require_ip_whitelist?: boolean
          timezone?: string
          updated_at?: string
          work_days?: string[] | null
          work_end_time?: string
          work_start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          id: string
          ip_address: string | null
          login_at: string
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          login_at?: string
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          login_at?: string
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      salaries: {
        Row: {
          amount: number
          created_at: string
          effective_date: string
          employee_id: string
          id: string
          is_current: boolean
          salary_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          effective_date: string
          employee_id: string
          id?: string
          is_current?: boolean
          salary_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          effective_date?: string
          employee_id?: string
          id?: string
          is_current?: boolean
          salary_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "salaries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_channel_members: {
        Row: {
          channel_id: string
          created_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "work_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      work_channels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_private: boolean
          name: string
          office_id: string | null
          parent_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          name: string
          office_id?: string | null
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          name?: string
          office_id?: string | null
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_channels_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_channels_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      work_messages: {
        Row: {
          attachments: Json | null
          channel_id: string
          content: string | null
          created_at: string
          id: string
          is_edited: boolean | null
          mentions: string[]
          parent_id: string | null
          reactions: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          channel_id: string
          content?: string | null
          created_at?: string
          id?: string
          is_edited?: boolean | null
          mentions?: string[]
          parent_id?: string | null
          reactions?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          channel_id?: string
          content?: string | null
          created_at?: string
          id?: string
          is_edited?: boolean | null
          mentions?: string[]
          parent_id?: string | null
          reactions?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "work_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      work_notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          channel_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message_id: string | null
          office_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          channel_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message_id?: string | null
          office_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          channel_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message_id?: string | null
          office_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_notifications_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "work_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "work_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_notifications_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tasks: {
        Row: {
          assignee_id: string | null
          channel_id: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          tags: string[] | null
          time_spent: number | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          channel_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          tags?: string[] | null
          time_spent?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          channel_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          tags?: string[] | null
          time_spent?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "work_channels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_channel_profiles: {
        Args: { _channel_id: string }
        Returns: {
          id: string
          full_name: string
          email: string
          avatar_url: string | null
        }[]
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
    }
    Enums: {
      app_role: "admin" | "employee"
      user_status: "active" | "inactive" | "locked"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "employee"],
      user_status: ["active", "inactive", "locked"],
    },
  },
} as const
