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
      access_control: {
        Row: {
          access_level: string
          allowed_areas: string[] | null
          created_at: string
          effective_date: string
          employee_id: string
          expiry_date: string | null
          id: string
          ip_override: boolean
          is_active: boolean
          office_id: string
          time_restrictions: Json | null
          updated_at: string
        }
        Insert: {
          access_level: string
          allowed_areas?: string[] | null
          created_at?: string
          effective_date?: string
          employee_id: string
          expiry_date?: string | null
          id?: string
          ip_override?: boolean
          is_active?: boolean
          office_id: string
          time_restrictions?: Json | null
          updated_at?: string
        }
        Update: {
          access_level?: string
          allowed_areas?: string[] | null
          created_at?: string
          effective_date?: string
          employee_id?: string
          expiry_date?: string | null
          id?: string
          ip_override?: boolean
          is_active?: boolean
          office_id?: string
          time_restrictions?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_control_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_control_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      access_logs: {
        Row: {
          access_method: string | null
          access_type: string
          created_at: string
          denial_reason: string | null
          employee_id: string | null
          id: string
          ip_address: string | null
          location_data: Json | null
          office_id: string
          success: boolean
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          access_method?: string | null
          access_type: string
          created_at?: string
          denial_reason?: string | null
          employee_id?: string | null
          id?: string
          ip_address?: string | null
          location_data?: Json | null
          office_id: string
          success?: boolean
          timestamp?: string
          user_agent?: string | null
        }
        Update: {
          access_method?: string | null
          access_type?: string
          created_at?: string
          denial_reason?: string | null
          employee_id?: string | null
          id?: string
          ip_address?: string | null
          location_data?: Json | null
          office_id?: string
          success?: boolean
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attendance_time_zone: string | null
          attendance_time_zone_id: string | null
          attendance_time_zone_name: string | null
          auto_checked_out_at: string | null
          auto_checkout_email_sent_at: string | null
          break_duration: string | null
          break_start_at: string | null
          break_total_minutes: number
          check_in_at: string | null
          check_in_ip: string | null
          check_in_local_time: string | null
          check_in_location: Json | null
          check_in_uk_time: string | null
          check_out_at: string | null
          check_out_ip: string | null
          check_out_local_time: string | null
          check_out_location: Json | null
          check_out_uk_time: string | null
          checkout_reminder_sent_at: string | null
          created_at: string
          date: string
          employee_id: string
          expected_check_out_at: string | null
          id: string
          in_time: string | null
          is_late: boolean
          last_verified_at: string | null
          last_verified_ip: string | null
          last_verified_location: Json | null
          late_minutes: number
          notes: string | null
          out_time: string | null
          scheduled_end_time: string | null
          scheduled_start_time: string | null
          status: string
          total_work_minutes: number | null
        }
        Insert: {
          attendance_time_zone?: string | null
          attendance_time_zone_id?: string | null
          attendance_time_zone_name?: string | null
          auto_checked_out_at?: string | null
          auto_checkout_email_sent_at?: string | null
          break_duration?: string | null
          break_start_at?: string | null
          break_total_minutes?: number
          check_in_at?: string | null
          check_in_ip?: string | null
          check_in_local_time?: string | null
          check_in_location?: Json | null
          check_in_uk_time?: string | null
          check_out_at?: string | null
          check_out_ip?: string | null
          check_out_local_time?: string | null
          check_out_location?: Json | null
          check_out_uk_time?: string | null
          checkout_reminder_sent_at?: string | null
          created_at?: string
          date: string
          employee_id: string
          expected_check_out_at?: string | null
          id?: string
          in_time?: string | null
          is_late?: boolean
          last_verified_at?: string | null
          last_verified_ip?: string | null
          last_verified_location?: Json | null
          late_minutes?: number
          notes?: string | null
          out_time?: string | null
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          status: string
          total_work_minutes?: number | null
        }
        Update: {
          attendance_time_zone?: string | null
          attendance_time_zone_id?: string | null
          attendance_time_zone_name?: string | null
          auto_checked_out_at?: string | null
          auto_checkout_email_sent_at?: string | null
          break_duration?: string | null
          break_start_at?: string | null
          break_total_minutes?: number
          check_in_at?: string | null
          check_in_ip?: string | null
          check_in_local_time?: string | null
          check_in_location?: Json | null
          check_in_uk_time?: string | null
          check_out_at?: string | null
          check_out_ip?: string | null
          check_out_local_time?: string | null
          check_out_location?: Json | null
          check_out_uk_time?: string | null
          checkout_reminder_sent_at?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          expected_check_out_at?: string | null
          id?: string
          in_time?: string | null
          is_late?: boolean
          last_verified_at?: string | null
          last_verified_ip?: string | null
          last_verified_location?: Json | null
          late_minutes?: number
          notes?: string | null
          out_time?: string | null
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          status?: string
          total_work_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_attendance_time_zone_id_fkey"
            columns: ["attendance_time_zone_id"]
            isOneToOne: false
            referencedRelation: "attendance_time_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_overtime_requests: {
        Row: {
          attendance_id: string
          created_at: string
          date: string
          employee_id: string
          id: string
          reason: string
          requested_at: string
          response_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendance_id: string
          created_at?: string
          date: string
          employee_id: string
          id?: string
          reason?: string
          requested_at?: string
          response_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attendance_id?: string
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          reason?: string
          requested_at?: string
          response_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_overtime_requests_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_overtime_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_time_zones: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          time_zone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          time_zone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          time_zone?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          actor_email: string | null
          actor_name: string | null
          actor_user_id: string | null
          category: string
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          message: string
          metadata: Json
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          category?: string
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          message: string
          metadata?: Json
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          category?: string
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          message?: string
          metadata?: Json
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      channel_members: {
        Row: {
          channel_id: string
          joined_at: string
          last_read_at: string
          muted: boolean
          role: string
          starred: boolean
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: string
          starred?: boolean
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: string
          starred?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          kind: string
          last_message_at: string | null
          name: string | null
          posting_policy: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind: string
          last_message_at?: string | null
          name?: string | null
          posting_policy?: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind?: string
          last_message_at?: string | null
          name?: string | null
          posting_policy?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
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
          break_duration: string | null
          created_at: string | null
          end_time: string
          id: string
          is_active: boolean | null
          schedule_name: string
          shift_type: string
          start_time: string
          updated_at: string | null
          work_days: string[] | null
        }
        Insert: {
          break_duration?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          schedule_name: string
          shift_type: string
          start_time: string
          updated_at?: string | null
          work_days?: string[] | null
        }
        Update: {
          break_duration?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          schedule_name?: string
          shift_type?: string
          start_time?: string
          updated_at?: string | null
          work_days?: string[] | null
        }
        Relationships: []
      }
      duty_schedules: {
        Row: {
          break_duration: string | null
          created_at: string
          effective_date: string
          employee_id: string
          end_time: string
          expiry_date: string | null
          id: string
          is_active: boolean
          office_id: string
          schedule_name: string
          shift_type: string
          start_time: string
          updated_at: string
          work_days: string[] | null
        }
        Insert: {
          break_duration?: string | null
          created_at?: string
          effective_date?: string
          employee_id: string
          end_time: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          office_id: string
          schedule_name: string
          shift_type: string
          start_time: string
          updated_at?: string
          work_days?: string[] | null
        }
        Update: {
          break_duration?: string | null
          created_at?: string
          effective_date?: string
          employee_id?: string
          end_time?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          office_id?: string
          schedule_name?: string
          shift_type?: string
          start_time?: string
          updated_at?: string
          work_days?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "duty_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_schedules_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      early_checkout_requests: {
        Row: {
          created_at: string | null
          date: string
          employee_id: string
          id: string
          reason: string
          requested_checkout_time: string
          response_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          date: string
          employee_id: string
          id?: string
          reason: string
          requested_checkout_time: string
          response_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          date?: string
          employee_id?: string
          id?: string
          reason?: string
          requested_checkout_time?: string
          response_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
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
      email_outbox: {
        Row: {
          attempts: number
          body: string
          created_at: string
          id: string
          last_error: string | null
          provider: string
          recipient_email: string
          recipient_user_id: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          id?: string
          last_error?: string | null
          provider?: string
          recipient_email: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          id?: string
          last_error?: string | null
          provider?: string
          recipient_email?: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_reporting_lines: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          manager_employee_id: string
          relationship_label: string
          report_employee_id: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          manager_employee_id: string
          relationship_label?: string
          report_employee_id: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          manager_employee_id?: string
          relationship_label?: string
          report_employee_id?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_reporting_lines_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_reporting_lines_report_employee_id_fkey"
            columns: ["report_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_reporting_lines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "employee_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_team_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          is_active: boolean
          role_label: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          is_active?: boolean
          role_label?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          is_active?: boolean
          role_label?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_team_memberships_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "employee_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_teams: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          office_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          office_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          office_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_teams_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          created_at: string
          custom_work_end_time: string | null
          custom_work_start_time: string | null
          department_id: string | null
          designation: string | null
          duty_schedule_template_id: string | null
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
          work_location: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          custom_work_end_time?: string | null
          custom_work_start_time?: string | null
          department_id?: string | null
          designation?: string | null
          duty_schedule_template_id?: string | null
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
          work_location?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          custom_work_end_time?: string | null
          custom_work_start_time?: string | null
          department_id?: string | null
          designation?: string | null
          duty_schedule_template_id?: string | null
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
          work_location?: string | null
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
            foreignKeyName: "employees_duty_schedule_template_id_fkey"
            columns: ["duty_schedule_template_id"]
            isOneToOne: false
            referencedRelation: "duty_schedule_templates"
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
      flowmath_access_overrides: {
        Row: {
          allowed: boolean
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          allowed: boolean
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flowmath_access_overrides_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      flowmath_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_cash: boolean
          is_system: boolean
          name: string
          normal_balance: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_cash?: boolean
          is_system?: boolean
          name: string
          normal_balance: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_cash?: boolean
          is_system?: boolean
          name?: string
          normal_balance?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flowmath_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "flowmath_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      flowmath_counterparties: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          opening_balance: number
          phone: string | null
          tax_number: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          opening_balance?: number
          phone?: string | null
          tax_number?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number
          phone?: string | null
          tax_number?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      flowmath_document_lines: {
        Row: {
          amount: number | null
          created_at: string
          credit_account_id: string
          debit_account_id: string
          description: string
          document_id: string
          id: string
          line_no: number
          quantity: number
          unit_amount: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          credit_account_id: string
          debit_account_id: string
          description: string
          document_id: string
          id?: string
          line_no?: number
          quantity?: number
          unit_amount?: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          credit_account_id?: string
          debit_account_id?: string
          description?: string
          document_id?: string
          id?: string
          line_no?: number
          quantity?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "flowmath_document_lines_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "flowmath_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flowmath_document_lines_debit_account_id_fkey"
            columns: ["debit_account_id"]
            isOneToOne: false
            referencedRelation: "flowmath_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flowmath_document_lines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "flowmath_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      flowmath_documents: {
        Row: {
          counterparty_id: string | null
          created_at: string
          created_by: string | null
          document_date: string
          document_no: string
          document_type: string
          due_date: string | null
          id: string
          journal_entry_id: string | null
          memo: string | null
          paid_at: string | null
          posted_at: string | null
          posted_by: string | null
          status: string
          total_amount: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          counterparty_id?: string | null
          created_at?: string
          created_by?: string | null
          document_date?: string
          document_no: string
          document_type: string
          due_date?: string | null
          id?: string
          journal_entry_id?: string | null
          memo?: string | null
          paid_at?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          counterparty_id?: string | null
          created_at?: string
          created_by?: string | null
          document_date?: string
          document_no?: string
          document_type?: string
          due_date?: string | null
          id?: string
          journal_entry_id?: string | null
          memo?: string | null
          paid_at?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flowmath_documents_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "flowmath_counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flowmath_documents_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "flowmath_journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      flowmath_journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          entry_no: string
          id: string
          memo: string | null
          posted_at: string | null
          posted_by: string | null
          source_id: string | null
          source_type: string
          status: string
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_no: string
          id?: string
          memo?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_no?: string
          id?: string
          memo?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: []
      }
      flowmath_journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
          line_no: number
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
          line_no?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
          line_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "flowmath_journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "flowmath_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flowmath_journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "flowmath_journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      flowmath_payroll_items: {
        Row: {
          absent_days: number
          absent_equivalents: number
          allowances: number
          attendance_deduction: number
          attendance_details: Json | null
          base_salary: number
          created_at: string
          deductions: number
          employee_id: string
          half_days: number
          id: string
          late_days: number
          leave_days: number
          net_salary: number
          notes: string | null
          payroll_run_id: string
          present_days: number
          salary_id: string | null
          total_work_minutes: number
          updated_at: string
        }
        Insert: {
          absent_days?: number
          absent_equivalents?: number
          allowances?: number
          attendance_deduction?: number
          attendance_details?: Json | null
          base_salary?: number
          created_at?: string
          deductions?: number
          employee_id: string
          half_days?: number
          id?: string
          late_days?: number
          leave_days?: number
          net_salary?: number
          notes?: string | null
          payroll_run_id: string
          present_days?: number
          salary_id?: string | null
          total_work_minutes?: number
          updated_at?: string
        }
        Update: {
          absent_days?: number
          absent_equivalents?: number
          allowances?: number
          attendance_deduction?: number
          attendance_details?: Json | null
          base_salary?: number
          created_at?: string
          deductions?: number
          employee_id?: string
          half_days?: number
          id?: string
          late_days?: number
          leave_days?: number
          net_salary?: number
          notes?: string | null
          payroll_run_id?: string
          present_days?: number
          salary_id?: string | null
          total_work_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flowmath_payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flowmath_payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "flowmath_payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flowmath_payroll_items_salary_id_fkey"
            columns: ["salary_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      flowmath_payroll_runs: {
        Row: {
          allowance_amount: number
          created_at: string
          created_by: string | null
          deduction_amount: number
          gross_amount: number
          id: string
          journal_entry_id: string | null
          net_amount: number
          paid_at: string | null
          paid_by: string | null
          payment_journal_entry_id: string | null
          period_end: string
          period_start: string
          posted_at: string | null
          posted_by: string | null
          run_no: string
          status: string
          updated_at: string
        }
        Insert: {
          allowance_amount?: number
          created_at?: string
          created_by?: string | null
          deduction_amount?: number
          gross_amount?: number
          id?: string
          journal_entry_id?: string | null
          net_amount?: number
          paid_at?: string | null
          paid_by?: string | null
          payment_journal_entry_id?: string | null
          period_end: string
          period_start: string
          posted_at?: string | null
          posted_by?: string | null
          run_no: string
          status?: string
          updated_at?: string
        }
        Update: {
          allowance_amount?: number
          created_at?: string
          created_by?: string | null
          deduction_amount?: number
          gross_amount?: number
          id?: string
          journal_entry_id?: string | null
          net_amount?: number
          paid_at?: string | null
          paid_by?: string | null
          payment_journal_entry_id?: string | null
          period_end?: string
          period_start?: string
          posted_at?: string | null
          posted_by?: string | null
          run_no?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flowmath_payroll_runs_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "flowmath_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flowmath_payroll_runs_payment_journal_entry_id_fkey"
            columns: ["payment_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "flowmath_journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      flowmath_settings: {
        Row: {
          base_currency: string
          created_at: string
          currency_symbol: string
          fiscal_year_start_month: number
          id: string
          tax_label: string
          timezone: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          currency_symbol?: string
          fiscal_year_start_month?: number
          id?: string
          tax_label?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          currency_symbol?: string
          fiscal_year_start_month?: number
          id?: string
          tax_label?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      managepay_access_overrides: {
        Row: {
          allowed: boolean
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          allowed: boolean
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "managepay_access_overrides_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      managepay_clients: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      managepay_companies: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          logo_has_dark_bg: boolean
          logo_url: string | null
          name: string
          payment_base_url: string | null
          phone: string | null
          stripe_account_id: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
          logo_has_dark_bg?: boolean
          logo_url?: string | null
          name: string
          payment_base_url?: string | null
          phone?: string | null
          stripe_account_id?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          logo_has_dark_bg?: boolean
          logo_url?: string | null
          name?: string
          payment_base_url?: string | null
          phone?: string | null
          stripe_account_id?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      managepay_employee_company_access: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "managepay_employee_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "managepay_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managepay_employee_company_access_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      managepay_invoice_services: {
        Row: {
          created_at: string
          created_by: string | null
          default_rate: number
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_rate?: number
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_rate?: number
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      managepay_invoices: {
        Row: {
          amount_in_cents: number
          client_email: string
          client_id: string | null
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          metadata: Json
          paid_at: string | null
          seller_id: string
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_in_cents: number
          client_email: string
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          metadata?: Json
          paid_at?: string | null
          seller_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_in_cents?: number
          client_email?: string
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          metadata?: Json
          paid_at?: string | null
          seller_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "managepay_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "managepay_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      managepay_terminal_transactions: {
        Row: {
          amount_in_cents: number
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          fee_in_cents: number
          id: string
          metadata: Json
          payment_method: string
          provider_reference: string | null
          status: string
          total_in_cents: number
          user_id: string
        }
        Insert: {
          amount_in_cents: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          fee_in_cents?: number
          id?: string
          metadata?: Json
          payment_method: string
          provider_reference?: string | null
          status?: string
          total_in_cents: number
          user_id: string
        }
        Update: {
          amount_in_cents?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          fee_in_cents?: number
          id?: string
          metadata?: Json
          payment_method?: string
          provider_reference?: string | null
          status?: string
          total_in_cents?: number
          user_id?: string
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          channel_id: string
          created_at: string
          file_name: string
          id: string
          message_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploader_id: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          file_name: string
          id?: string
          message_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploader_id?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          channel_id: string
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_kind: string
          body: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          last_reply_at: string | null
          mentions: string[]
          metadata: Json
          parent_id: string | null
          reactions: Json
          reply_count: number
          search: unknown
          user_id: string | null
        }
        Insert: {
          author_kind?: string
          body?: string
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          last_reply_at?: string | null
          mentions?: string[]
          metadata?: Json
          parent_id?: string | null
          reactions?: Json
          reply_count?: number
          search?: unknown
          user_id?: string | null
        }
        Update: {
          author_kind?: string
          body?: string
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          last_reply_at?: string | null
          mentions?: string[]
          metadata?: Json
          parent_id?: string | null
          reactions?: Json
          reply_count?: number
          search?: unknown
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          subscription: Json
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          subscription: Json
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          subscription?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      office_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          is_active: boolean
          office_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          is_active?: boolean
          office_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          is_active?: boolean
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_departments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_settings: {
        Row: {
          allowed_ip_ranges: string[] | null
          break_duration: string | null
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
          break_duration?: string | null
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
          break_duration?: string | null
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
      project_members: {
        Row: {
          added_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_at?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          added_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_statuses: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          position: number
          project_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          position: number
          project_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_statuses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string
          lead_id: string | null
          name: string
          task_seq: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key: string
          lead_id?: string | null
          name: string
          task_seq?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string
          lead_id?: string | null
          name?: string
          task_seq?: number
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
      task_activity: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json
          id: number
          kind: string
          project_id: string
          task_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: never
          kind: string
          project_id: string
          task_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: never
          kind?: string
          project_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          project_id: string
          size_bytes: number | null
          storage_path: string
          task_id: string
          uploader_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          project_id: string
          size_bytes?: number | null
          storage_path: string
          task_id: string
          uploader_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          size_bytes?: number | null
          storage_path?: string
          task_id?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          mentions: string[]
          project_id: string
          task_id: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          project_id: string
          task_id: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          project_id?: string
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          label_id: string
          project_id: string
          task_id: string
        }
        Insert: {
          label_id: string
          project_id: string
          task_id: string
        }
        Update: {
          label_id?: string
          project_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_labels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_labels_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          number: number
          parent_id: string | null
          position: number
          priority: string
          project_id: string
          reporter_id: string | null
          status_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          number: number
          parent_id?: string | null
          position?: number
          priority?: string
          project_id: string
          reporter_id?: string | null
          status_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          number?: number
          parent_id?: string | null
          position?: number
          priority?: string
          project_id?: string
          reporter_id?: string | null
          status_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "project_statuses"
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
      work_chat_messages: {
        Row: {
          attachments: Json
          content: string
          created_at: string | null
          id: string
          is_edited: boolean | null
          mentions: string[] | null
          parent_id: string | null
          reactions: Json
          room_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attachments?: Json
          content: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          mentions?: string[] | null
          parent_id?: string | null
          reactions?: Json
          room_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          mentions?: string[] | null
          parent_id?: string | null
          reactions?: Json
          room_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_chat_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "work_chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      work_chat_rooms: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          team_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          team_id: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          team_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_chat_rooms_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "work_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      work_notifications: {
        Row: {
          action_url: string | null
          actor_id: string | null
          body: string | null
          channel_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message_id: string | null
          metadata: Json
          office_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          actor_id?: string | null
          body?: string | null
          channel_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message_id?: string | null
          metadata?: Json
          office_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          actor_id?: string | null
          body?: string | null
          channel_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message_id?: string | null
          metadata?: Json
          office_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_notifications_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      work_project_members: {
        Row: {
          id: string
          joined_at: string | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "work_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_projects: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "work_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      work_task_attachments: {
        Row: {
          created_at: string
          id: string
          name: string
          path: string
          size: number
          task_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          path: string
          size?: number
          task_id: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          path?: string
          size?: number
          task_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "work_task_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "work_tasks_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      work_task_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_edited: boolean | null
          mentions: string[] | null
          parent_id: string | null
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          mentions?: string[] | null
          parent_id?: string | null
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          mentions?: string[] | null
          parent_id?: string | null
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_task_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "work_task_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "work_tasks_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tasks_v2: {
        Row: {
          actual_hours: number | null
          assignee_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          is_completed: boolean | null
          parent_id: string | null
          position: number | null
          priority: string
          project_id: string
          reporter_id: string | null
          start_date: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_completed?: boolean | null
          parent_id?: string | null
          position?: number | null
          priority?: string
          project_id: string
          reporter_id?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_completed?: boolean | null
          parent_id?: string | null
          position?: number | null
          priority?: string
          project_id?: string
          reporter_id?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_tasks_v2_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_task_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_v2_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_tasks_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_v2_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "work_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_team_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "work_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      work_teams: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      work_task_subtasks: {
        Row: {
          actual_hours: number | null
          assignee_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string | null
          is_completed: boolean | null
          parent_id: string | null
          position: number | null
          priority: string | null
          project_id: string | null
          reporter_id: string | null
          start_date: string | null
          status: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string | null
          is_completed?: boolean | null
          parent_id?: string | null
          position?: number | null
          priority?: string | null
          project_id?: string | null
          reporter_id?: string | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string | null
          is_completed?: boolean | null
          parent_id?: string | null
          position?: number | null
          priority?: string | null
          project_id?: string | null
          reporter_id?: string | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_tasks_v2_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_task_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_v2_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_tasks_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_v2_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "work_projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      attendance_location_check_passes: {
        Args: {
          _employee_id: string
          _is_update: boolean
          _previous_verified_at: string
          _verified_at: string
          _verified_ip: string
          _verified_location: Json
        }
        Returns: boolean
      }
      attendance_location_check_reason: {
        Args: {
          _employee_id: string
          _is_update: boolean
          _previous_verified_at: string
          _verified_at: string
          _verified_ip: string
          _verified_location: Json
        }
        Returns: string
      }
      attendance_process_due_events: { Args: never; Returns: number }
      attendance_reviewer_user_ids: {
        Args: { _employee_id: string }
        Returns: {
          user_id: string
        }[]
      }
      auto_checkout_attendance: {
        Args: { _attendance_id: string; _checkout_at?: string }
        Returns: boolean
      }
      browse_channels: {
        Args: never
        Returns: {
          id: string
          is_member: boolean
          member_count: number
          name: string
          topic: string
        }[]
      }
      can_access_flowmath: { Args: { _user_id: string }; Returns: boolean }
      can_access_managepay: { Args: { _user_id: string }; Returns: boolean }
      can_edit_project: { Args: { _project_id: string }; Returns: boolean }
      can_manage_employee: {
        Args: { _manager_user_id: string; _target_employee_id: string }
        Returns: boolean
      }
      can_post_flowmath: { Args: { _user_id: string }; Returns: boolean }
      can_post_in_channel: {
        Args: { _channel_id: string; _user_id?: string }
        Returns: boolean
      }
      can_read_channel: {
        Args: { _channel_id: string; _user_id?: string }
        Returns: boolean
      }
      can_view_project: { Args: { _project_id: string }; Returns: boolean }
      chat_path_channel: { Args: { _name: string }; Returns: string }
      count_working_days: {
        Args: { _period_end: string; _period_start: string }
        Returns: number
      }
      create_flowmath_payroll_run: {
        Args: { _period_end: string; _period_start: string }
        Returns: {
          allowance_amount: number
          created_at: string
          created_by: string | null
          deduction_amount: number
          gross_amount: number
          id: string
          journal_entry_id: string | null
          net_amount: number
          paid_at: string | null
          paid_by: string | null
          payment_journal_entry_id: string | null
          period_end: string
          period_start: string
          posted_at: string | null
          posted_by: string | null
          run_no: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "flowmath_payroll_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_flowmath_payroll_run: {
        Args: { _payroll_run_id: string }
        Returns: boolean
      }
      evaluate_attendance_status: {
        Args: {
          _break_total_minutes?: number
          _date: string
          _employee_id: string
          _in_time: string
          _out_time: string
          _total_work_minutes: number
        }
        Returns: {
          evaluated_is_late: boolean
          evaluated_late_minutes: number
          evaluated_scheduled_end: string
          evaluated_scheduled_start: string
          evaluated_status: string
        }[]
      }
      flowmath_assert_balanced: {
        Args: { _journal_entry_id: string }
        Returns: undefined
      }
      flowmath_next_number: { Args: { _prefix: string }; Returns: string }
      geo_distance_meters: {
        Args: { _lat1: number; _lat2: number; _lng1: number; _lng2: number }
        Returns: number
      }
      get_channel_profiles: {
        Args: { _channel_id: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
        }[]
      }
      get_directory: {
        Args: never
        Returns: {
          avatar_url: string
          designation: string
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_employee_break_minutes: {
        Args: { _date: string; _employee_id: string }
        Returns: number
      }
      get_employee_checkin_time: {
        Args: { _date: string; _employee_id: string }
        Returns: string
      }
      get_employee_checkout_time: {
        Args: { _date: string; _employee_id: string }
        Returns: string
      }
      get_hierarchy_admin_snapshot: { Args: never; Returns: Json }
      get_managed_employee_ids: {
        Args: { _manager_user_id: string }
        Returns: {
          depth: number
          employee_id: string
        }[]
      }
      get_managepay_public_invoice: {
        Args: { _invoice_ref: string }
        Returns: {
          amount_in_cents: number
          client_email: string
          created_at: string
          currency: string
          description: string
          due_date: string
          id: string
          invoice_number: string
          metadata: Json
          status: string
          updated_at: string
        }[]
      }
      get_me: { Args: never; Returns: Json }
      get_my_channels: {
        Args: never
        Returns: {
          dm_user_ids: string[]
          id: string
          is_default: boolean
          kind: string
          last_message_at: string
          mention_count: number
          muted: boolean
          name: string
          posting_policy: string
          role: string
          starred: boolean
          topic: string
          unread_count: number
        }[]
      }
      get_my_manageable_attendance_employees: {
        Args: never
        Returns: {
          department_id: string
          department_name: string
          depth: number
          designation: string
          email: string
          employee_id: string
          full_name: string
          id: string
          office_id: string
          office_name: string
          user_id: string
        }[]
      }
      get_my_projects: {
        Args: never
        Returns: {
          archived_at: string
          color: string
          description: string
          done_count: number
          id: string
          key: string
          lead_id: string
          member_count: number
          my_open_count: number
          my_role: string
          name: string
          open_count: number
          updated_at: string
        }[]
      }
      get_my_tasks: {
        Args: never
        Returns: {
          due_date: string
          id: string
          number: number
          parent_id: string
          priority: string
          project_color: string
          project_id: string
          project_key: string
          project_name: string
          status_category: string
          status_id: string
          status_name: string
          title: string
          updated_at: string
        }[]
      }
      get_or_create_dm: { Args: { _user_ids: string[] }; Returns: string }
      get_project_tasks: {
        Args: { project_uuid: string; status_filter?: string }
        Returns: {
          assignee_id: string
          assignee_name: string
          comment_count: number
          created_at: string
          description: string
          due_date: string
          id: string
          priority: string
          status: string
          subtask_count: number
          tags: string[]
          title: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_teams: {
        Args: { user_uuid: string }
        Returns: {
          avatar_url: string
          description: string
          member_count: number
          name: string
          role: string
          team_id: string
        }[]
      }
      get_work_chat_messages: {
        Args: { limit_count?: number; room_uuid: string }
        Returns: {
          attachments: Json
          content: string
          created_at: string
          id: string
          is_edited: boolean
          mentions: string[]
          parent_content: string
          parent_id: string
          parent_user_full_name: string
          reactions: Json
          room_id: string
          updated_at: string
          user_avatar_url: string
          user_full_name: string
          user_id: string
        }[]
      }
      get_work_team_member_designations: {
        Args: { _team_id: string }
        Returns: {
          designation: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_internal_edge_function: {
        Args: { _function_name: string; _payload?: Json }
        Returns: number
      }
      ip_matches_any_range: {
        Args: { _ip: string; _ranges: string[] }
        Returns: boolean
      }
      is_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_admin_or_team_lead_for_employee: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel_id: string; _user_id?: string }
        Returns: boolean
      }
      is_channel_owner: {
        Args: { _channel_id: string; _user_id?: string }
        Returns: boolean
      }
      is_manager: { Args: { _user_id?: string }; Returns: boolean }
      is_project_lead: { Args: { _project_id: string }; Returns: boolean }
      is_team_lead: { Args: { _user_id: string }; Returns: boolean }
      is_team_lead_for_employee: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_lead_for_office: {
        Args: { _office_id: string; _user_id: string }
        Returns: boolean
      }
      list_managepay_access_candidates: {
        Args: never
        Returns: {
          allowed_company_ids: string[]
          department_name: string
          effective_access: boolean
          employee_code: string
          employee_id: string
          full_name: string
          override_allowed: boolean
          user_id: string
        }[]
      }
      managepay_invoice_company_id: {
        Args: { _metadata: Json }
        Returns: string
      }
      managepay_user_can_use_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      manages_employee: {
        Args: { _employee_id: string; _user_id?: string }
        Returns: boolean
      }
      mark_channel_read: { Args: { _channel_id: string }; Returns: undefined }
      mark_flowmath_payroll_paid: {
        Args: { _payment_date?: string; _payroll_run_id: string }
        Returns: {
          allowance_amount: number
          created_at: string
          created_by: string | null
          deduction_amount: number
          gross_amount: number
          id: string
          journal_entry_id: string | null
          net_amount: number
          paid_at: string | null
          paid_by: string | null
          payment_journal_entry_id: string | null
          period_end: string
          period_start: string
          posted_at: string | null
          posted_by: string | null
          run_no: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "flowmath_payroll_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_flowmath_document: {
        Args: { _document_id: string }
        Returns: {
          counterparty_id: string | null
          created_at: string
          created_by: string | null
          document_date: string
          document_no: string
          document_type: string
          due_date: string | null
          id: string
          journal_entry_id: string | null
          memo: string | null
          paid_at: string | null
          posted_at: string | null
          posted_by: string | null
          status: string
          total_amount: number
          updated_at: string
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "flowmath_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_flowmath_journal_entry: {
        Args: { _journal_entry_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          entry_date: string
          entry_no: string
          id: string
          memo: string | null
          posted_at: string | null
          posted_by: string | null
          source_id: string | null
          source_type: string
          status: string
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "flowmath_journal_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_flowmath_payroll_run: {
        Args: { _payroll_run_id: string }
        Returns: {
          allowance_amount: number
          created_at: string
          created_by: string | null
          deduction_amount: number
          gross_amount: number
          id: string
          journal_entry_id: string | null
          net_amount: number
          paid_at: string | null
          paid_by: string | null
          payment_journal_entry_id: string | null
          period_end: string
          period_start: string
          posted_at: string | null
          posted_by: string | null
          run_no: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "flowmath_payroll_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      project_path_project: { Args: { _name: string }; Returns: string }
      project_role: {
        Args: { _project_id: string; _user_id?: string }
        Returns: string
      }
      rebalance_status_column: {
        Args: { _status_id: string }
        Returns: undefined
      }
      refresh_flowmath_payroll_totals: {
        Args: { _payroll_run_id: string }
        Returns: {
          allowance_amount: number
          created_at: string
          created_by: string | null
          deduction_amount: number
          gross_amount: number
          id: string
          journal_entry_id: string | null
          net_amount: number
          paid_at: string | null
          paid_by: string | null
          payment_journal_entry_id: string | null
          period_end: string
          period_start: string
          posted_at: string | null
          posted_by: string | null
          run_no: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "flowmath_payroll_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_manager_role: {
        Args: { _employee_id: string }
        Returns: undefined
      }
      request_ip_address: { Args: never; Returns: string }
      same_office: {
        Args: { _user_a: string; _user_b: string }
        Returns: boolean
      }
      search_messages: {
        Args: { _limit?: number; _query: string }
        Returns: {
          body: string
          channel_id: string
          channel_kind: string
          channel_name: string
          created_at: string
          id: string
          parent_id: string
          user_id: string
        }[]
      }
      set_managepay_employee_company_access: {
        Args: { _company_ids: string[]; _employee_id: string }
        Returns: undefined
      }
      set_work_chat_message_reactions: {
        Args: { message_uuid: string; next_reactions: Json }
        Returns: {
          attachments: Json
          content: string
          created_at: string | null
          id: string
          is_edited: boolean | null
          mentions: string[] | null
          parent_id: string | null
          reactions: Json
          room_id: string
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "work_chat_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_overtime_request: {
        Args: { _attendance_id: string; _reason?: string }
        Returns: {
          attendance_id: string
          created_at: string
          date: string
          employee_id: string
          id: string
          reason: string
          requested_at: string
          response_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_overtime_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unpost_flowmath_manual_journal_entry: {
        Args: { _journal_entry_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          entry_date: string
          entry_no: string
          id: string
          memo: string | null
          posted_at: string | null
          posted_by: string | null
          source_id: string | null
          source_type: string
          status: string
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "flowmath_journal_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      work_can_manage_tasks: {
        Args: { _team_id: string; _user_id?: string }
        Returns: boolean
      }
      work_can_manage_team: {
        Args: { _team_id: string; _user_id?: string }
        Returns: boolean
      }
      work_is_team_member: {
        Args: { _team_id: string; _user_id?: string }
        Returns: boolean
      }
      work_project_team_id: { Args: { _project_id: string }; Returns: string }
      work_room_team_id: { Args: { _room_id: string }; Returns: string }
      work_task_team_id: { Args: { _task_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "employee" | "manager"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "employee", "manager"],
      user_status: ["active", "inactive", "locked"],
    },
  },
} as const
