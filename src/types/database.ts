// Auto-gerado via: supabase gen types typescript --project-id lodetzmtsymvnjffmvat
// Atualizar apos migrations: use o MCP do Supabase (generate_typescript_types) ou
// pnpm supabase gen types typescript --project-id lodetzmtsymvnjffmvat > src/types/database.ts

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          category: Database["public"]["Enums"]["audit_category"]
          created_at: string
          description: string
          id: string
          ip_address: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          category?: Database["public"]["Enums"]["audit_category"]
          created_at?: string
          description: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          category?: Database["public"]["Enums"]["audit_category"]
          created_at?: string
          description?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_responses: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          responses: Json
          student_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          responses?: Json
          student_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          responses?: Json
          student_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnese_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_templates: {
        Row: {
          category: string
          created_at: string
          field_key: string
          field_type: string
          id: string
          is_active: boolean
          label: string
          options: Json | null
          required: boolean
          sort_order: number
          tenant_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          field_key: string
          field_type?: string
          id?: string
          is_active?: boolean
          label: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          tenant_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          is_active?: boolean
          label?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attended_at: string
          created_at: string
          id: string
          notes: string | null
          student_id: string
          tenant_id: string
          workout_plan_id: string | null
        }
        Insert: {
          attended_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          student_id: string
          tenant_id: string
          workout_plan_id?: string | null
        }
        Update: {
          attended_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          student_id?: string
          tenant_id?: string
          workout_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_combo_items: {
        Row: {
          combo_id: string
          exercise_id: string
          id: string
          notes: string | null
          sort_order: number
        }
        Insert: {
          combo_id: string
          exercise_id: string
          id?: string
          notes?: string | null
          sort_order?: number
        }
        Update: {
          combo_id?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "exercise_combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_combo_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_combos: {
        Row: {
          combo_type: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          combo_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          combo_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_combos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_combos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          count_type: string
          created_at: string
          created_by: string | null
          default_duration_secs: number | null
          default_reps: string | null
          default_sets: number | null
          id: string
          instructions: string | null
          is_global: boolean
          load_type: string
          muscle_group: string
          name: string
          secondary_muscles: string[]
          tenant_id: string | null
          updated_at: string
          video_path: string | null
          video_url: string | null
        }
        Insert: {
          count_type?: string
          created_at?: string
          created_by?: string | null
          default_duration_secs?: number | null
          default_reps?: string | null
          default_sets?: number | null
          id?: string
          instructions?: string | null
          is_global?: boolean
          load_type?: string
          muscle_group: string
          name: string
          secondary_muscles?: string[]
          tenant_id?: string | null
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
        }
        Update: {
          count_type?: string
          created_at?: string
          created_by?: string | null
          default_duration_secs?: number | null
          default_reps?: string | null
          default_sets?: number | null
          id?: string
          instructions?: string | null
          is_global?: boolean
          load_type?: string
          muscle_group?: string
          name?: string
          secondary_muscles?: string[]
          tenant_id?: string | null
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_workout_items: {
        Row: {
          combo_group_id: string | null
          combo_type: string | null
          count_type: string
          created_at: string
          display_order: number
          duration_secs: number | null
          exercise_id: string
          extra_workout_id: string
          id: string
          load: string | null
          notes: string | null
          reps: string | null
          rest_seconds: number | null
          sets: number | null
          tenant_id: string
        }
        Insert: {
          combo_group_id?: string | null
          combo_type?: string | null
          count_type?: string
          created_at?: string
          display_order?: number
          duration_secs?: number | null
          exercise_id: string
          extra_workout_id: string
          id?: string
          load?: string | null
          notes?: string | null
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          tenant_id: string
        }
        Update: {
          combo_group_id?: string | null
          combo_type?: string | null
          count_type?: string
          created_at?: string
          display_order?: number
          duration_secs?: number | null
          exercise_id?: string
          extra_workout_id?: string
          id?: string
          load?: string | null
          notes?: string | null
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_workout_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_workout_items_extra_workout_id_fkey"
            columns: ["extra_workout_id"]
            isOneToOne: false
            referencedRelation: "extra_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_workout_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_workouts: {
        Row: {
          category: Database["public"]["Enums"]["extra_workout_category"]
          created_at: string
          description: string | null
          id: string
          is_template: boolean
          name: string
          student_id: string | null
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["extra_workout_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean
          name: string
          student_id?: string | null
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["extra_workout_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean
          name?: string
          student_id?: string | null
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_workouts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_workouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_plans: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          plan_name: string
          status: Database["public"]["Enums"]["financial_plan_status"]
          student_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          plan_name: string
          status?: Database["public"]["Enums"]["financial_plan_status"]
          student_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          plan_name?: string
          status?: Database["public"]["Enums"]["financial_plan_status"]
          student_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      physical_assessments: {
        Row: {
          arm: number | null
          assessed_at: string
          body_fat: number | null
          chest: number | null
          created_at: string
          height: number | null
          hip: number | null
          id: string
          notes: string | null
          student_id: string
          tenant_id: string
          thigh: number | null
          waist: number | null
          weight: number | null
        }
        Insert: {
          arm?: number | null
          assessed_at?: string
          body_fat?: number | null
          chest?: number | null
          created_at?: string
          height?: number | null
          hip?: number | null
          id?: string
          notes?: string | null
          student_id: string
          tenant_id: string
          thigh?: number | null
          waist?: number | null
          weight?: number | null
        }
        Update: {
          arm?: number | null
          assessed_at?: string
          body_fat?: number | null
          chest?: number | null
          created_at?: string
          height?: number | null
          hip?: number | null
          id?: string
          notes?: string | null
          student_id?: string
          tenant_id?: string
          thigh?: number | null
          waist?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "physical_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physical_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          abacatepay_product_id: string | null
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_students: number
          name: string
          price_brl: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          abacatepay_product_id?: string | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_students?: number
          name: string
          price_brl?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          abacatepay_product_id?: string | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_students?: number
          name?: string
          price_brl?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          must_change_password: boolean
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["profile_status"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_progress: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          photo_urls: string[]
          recorded_at: string
          student_id: string
          tenant_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          photo_urls?: string[]
          recorded_at?: string
          student_id: string
          tenant_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          photo_urls?: string[]
          recorded_at?: string
          student_id?: string
          tenant_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          email: string | null
          full_name: string
          goal: string | null
          id: string
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["student_status"]
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          goal?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          goal?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          abacatepay_checkout_id: string | null
          abacatepay_subscription_id: string | null
          cancelled_at: string | null
          created_at: string
          id: string
          method: string | null
          plan_id: string | null
          plan_slug: string
          receipt_url: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          abacatepay_checkout_id?: string | null
          abacatepay_subscription_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          method?: string | null
          plan_id?: string | null
          plan_slug: string
          receipt_url?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          abacatepay_checkout_id?: string | null
          abacatepay_subscription_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          method?: string | null
          plan_id?: string | null
          plan_slug?: string
          receipt_url?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_modules: {
        Row: {
          available: boolean
          category: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          category: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_modules: {
        Row: {
          enabled: boolean
          enabled_at: string
          id: string
          module_id: string
          tenant_id: string
        }
        Insert: {
          enabled?: boolean
          enabled_at?: string
          id?: string
          module_id: string
          tenant_id: string
        }
        Update: {
          enabled?: boolean
          enabled_at?: string
          id?: string
          module_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "system_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          abacatepay_customer_id: string | null
          app_name: string | null
          business_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          logo_url: string | null
          max_students: number
          notes: string | null
          plan: Database["public"]["Enums"]["tenant_plan"]
          primary_color: string | null
          slug: string | null
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
        }
        Insert: {
          abacatepay_customer_id?: string | null
          app_name?: string | null
          business_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          max_students?: number
          notes?: string | null
          plan?: Database["public"]["Enums"]["tenant_plan"]
          primary_color?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Update: {
          abacatepay_customer_id?: string | null
          app_name?: string | null
          business_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          max_students?: number
          notes?: string | null
          plan?: Database["public"]["Enums"]["tenant_plan"]
          primary_color?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event: string
          id: string
          payload: Json | null
          processed_at: string
        }
        Insert: {
          event: string
          id: string
          payload?: Json | null
          processed_at?: string
        }
        Update: {
          event?: string
          id?: string
          payload?: Json | null
          processed_at?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string
          id: string
          load: string | null
          name: string
          notes: string | null
          reps: string | null
          rest_seconds: number | null
          sets: number | null
          sort_order: number
          tenant_id: string
          workout_plan_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          load?: string | null
          name: string
          notes?: string | null
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          sort_order?: number
          tenant_id: string
          workout_plan_id: string
        }
        Update: {
          created_at?: string
          id?: string
          load?: string | null
          name?: string
          notes?: string | null
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          sort_order?: number
          tenant_id?: string
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_feedbacks: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          student_id: string
          tenant_id: string
          workout_plan_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          student_id: string
          tenant_id: string
          workout_plan_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          student_id?: string
          tenant_id?: string
          workout_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_feedbacks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_feedbacks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_feedbacks_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_items: {
        Row: {
          combo_group_id: string | null
          combo_type: string | null
          count_type: string
          created_at: string
          display_order: number
          duration_secs: number | null
          exercise_id: string
          id: string
          load: string | null
          notes: string | null
          reps: string | null
          rest_seconds: number | null
          routine_id: string
          sets: number | null
          tenant_id: string
        }
        Insert: {
          combo_group_id?: string | null
          combo_type?: string | null
          count_type?: string
          created_at?: string
          display_order?: number
          duration_secs?: number | null
          exercise_id: string
          id?: string
          load?: string | null
          notes?: string | null
          reps?: string | null
          rest_seconds?: number | null
          routine_id: string
          sets?: number | null
          tenant_id: string
        }
        Update: {
          combo_group_id?: string | null
          combo_type?: string | null
          count_type?: string
          created_at?: string
          display_order?: number
          duration_secs?: number | null
          exercise_id?: string
          id?: string
          load?: string | null
          notes?: string | null
          reps?: string | null
          rest_seconds?: number | null
          routine_id?: string
          sets?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_items_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "workout_routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          goal: string | null
          id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["workout_plan_status"]
          student_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          goal?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["workout_plan_status"]
          student_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          goal?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["workout_plan_status"]
          student_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_routines: {
        Row: {
          created_at: string
          day_of_week: number | null
          display_order: number
          id: string
          name: string
          notes: string | null
          tenant_id: string
          updated_at: string
          workout_plan_id: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          display_order?: number
          id?: string
          name: string
          notes?: string | null
          tenant_id: string
          updated_at?: string
          workout_plan_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          display_order?: number
          id?: string
          name?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_routines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_routines_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_tenant_slug: { Args: { p_name: string }; Returns: string }
      get_admin_last_sign_in: { Args: { p_user_id: string }; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_my_tenant_id: { Args: never; Returns: string }
      get_tenant_plan_usage: {
        Args: { p_tenant_id: string }
        Returns: {
          can_add: boolean
          current_count: number
          max_students: number
          plan: string
          plan_name: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "global_admin" | "personal" | "student"
      audit_category: "auth" | "tenant" | "user" | "system"
      extra_workout_category:
        | "aquecimento"
        | "hiit"
        | "mobilidade"
        | "cardio"
        | "desafio"
        | "forca"
        | "outros"
      financial_plan_status: "pending" | "paid" | "overdue" | "cancelled"
      profile_status: "active" | "inactive" | "suspended"
      student_status: "active" | "inactive"
      tenant_plan: "free" | "pro" | "premium"
      tenant_status: "active" | "inactive" | "suspended"
      workout_plan_status: "active" | "inactive"
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
      app_role: ["global_admin", "personal", "student"],
      audit_category: ["auth", "tenant", "user", "system"],
      extra_workout_category: [
        "aquecimento",
        "hiit",
        "mobilidade",
        "cardio",
        "desafio",
        "forca",
        "outros",
      ],
      financial_plan_status: ["pending", "paid", "overdue", "cancelled"],
      profile_status: ["active", "inactive", "suspended"],
      student_status: ["active", "inactive"],
      tenant_plan: ["free", "pro", "premium"],
      tenant_status: ["active", "inactive", "suspended"],
      workout_plan_status: ["active", "inactive"],
    },
  },
} as const

// Re-exports para compatibilidade com imports existentes
export type AppRole       = Database["public"]["Enums"]["app_role"]
export type ProfileStatus = Database["public"]["Enums"]["profile_status"]
export type audit_category = Database["public"]["Enums"]["audit_category"]
export type ExtraWorkoutCategory = Database["public"]["Enums"]["extra_workout_category"]
