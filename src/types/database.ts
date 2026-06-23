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
      app_versions: {
        Row: {
          current_version: string
          current_version_code: number
          force_update: boolean
          min_version_code: number
          platform: string
          release_notes: string | null
          store_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          current_version: string
          current_version_code: number
          force_update?: boolean
          min_version_code: number
          platform: string
          release_notes?: string | null
          store_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          current_version?: string
          current_version_code?: number
          force_update?: boolean
          min_version_code?: number
          platform?: string
          release_notes?: string | null
          store_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          bmi: number | null
          bmr: number | null
          body_fat: number | null
          chest: number | null
          created_at: string
          height: number | null
          hip: number | null
          id: string
          notes: string | null
          sex: string | null
          student_id: string
          tenant_id: string
          thigh: number | null
          waist: number | null
          weight: number | null
        }
        Insert: {
          arm?: number | null
          assessed_at?: string
          bmi?: number | null
          bmr?: number | null
          body_fat?: number | null
          chest?: number | null
          created_at?: string
          height?: number | null
          hip?: number | null
          id?: string
          notes?: string | null
          sex?: string | null
          student_id: string
          tenant_id: string
          thigh?: number | null
          waist?: number | null
          weight?: number | null
        }
        Update: {
          arm?: number | null
          assessed_at?: string
          bmi?: number | null
          bmr?: number | null
          body_fat?: number | null
          chest?: number | null
          created_at?: string
          height?: number | null
          hip?: number | null
          id?: string
          notes?: string | null
          sex?: string | null
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
      shared_files: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          student_id: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          student_id?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          student_id?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_files_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_plan_assignments: {
        Row: {
          assigned_at: string
          id: string
          plan_id: string
          status: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          plan_id: string
          status?: string
          student_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          plan_id?: string
          status?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_assignments_tenant_id_fkey"
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
          cadence: string | null
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
          cadence?: string | null
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
          cadence?: string | null
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
          student_id: string | null
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
          student_id?: string | null
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
          student_id?: string | null
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
      workout_session_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          feedback: string | null
          id: string
          load_used: string | null
          reps_done: string | null
          session_id: string
          sets_done: number | null
          workout_item_id: string | null
        }
        Insert: {
          created_at?: string
          exercise_id: string
          feedback?: string | null
          id?: string
          load_used?: string | null
          reps_done?: string | null
          session_id: string
          sets_done?: number | null
          workout_item_id?: string | null
        }
        Update: {
          created_at?: string
          exercise_id?: string
          feedback?: string | null
          id?: string
          load_used?: string | null
          reps_done?: string | null
          session_id?: string
          sets_done?: number | null
          workout_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_session_exercises_workout_item_id_fkey"
            columns: ["workout_item_id"]
            isOneToOne: false
            referencedRelation: "workout_items"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          finished_at: string | null
          id: string
          intensity: string | null
          notes: string | null
          started_at: string
          student_id: string
          tenant_id: string
          workout_plan_id: string | null
          workout_routine_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          intensity?: string | null
          notes?: string | null
          started_at?: string
          student_id: string
          tenant_id: string
          workout_plan_id?: string | null
          workout_routine_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          intensity?: string | null
          notes?: string | null
          started_at?: string
          student_id?: string
          tenant_id?: string
          workout_plan_id?: string | null
          workout_routine_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_routine_id_fkey"
            columns: ["workout_routine_id"]
            isOneToOne: false
            referencedRelation: "workout_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_events: {
        Row: {
          id: string
          tenant_id: string
          type: string
          title: string
          event_date: string
          start_time: string | null
          end_time: string | null
          student_id: string | null
          student_name: string | null
          location: string | null
          meeting_url: string | null
          amount: number | null
          description: string | null
          status: string
          origin: string
          rejection_reason: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          type: string
          title: string
          event_date: string
          start_time?: string | null
          end_time?: string | null
          student_id?: string | null
          student_name?: string | null
          location?: string | null
          meeting_url?: string | null
          amount?: number | null
          description?: string | null
          status?: string
          origin?: string
          rejection_reason?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          type?: string
          title?: string
          event_date?: string
          start_time?: string | null
          end_time?: string | null
          student_id?: string | null
          student_name?: string | null
          location?: string | null
          meeting_url?: string | null
          amount?: number | null
          description?: string | null
          status?: string
          origin?: string
          rejection_reason?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      food_items: {
        Row: {
          id: string
          tenant_id: string | null
          name: string
          category: string | null
          portion_grams: number
          calories: number
          protein_g: number
          carbs_g: number
          fat_g: number
          fiber_g: number
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          name: string
          category?: string | null
          portion_grams: number
          calories: number
          protein_g: number
          carbs_g: number
          fat_g: number
          fiber_g?: number
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          name?: string
          category?: string | null
          portion_grams?: number
          calories?: number
          protein_g?: number
          carbs_g?: number
          fat_g?: number
          fiber_g?: number
          created_at?: string
        }
        Relationships: []
      }
      gamification_events: {
        Row: {
          id: string
          tenant_id: string
          student_id: string
          event_type: string
          points: number
          reference_id: string | null
          reference_type: string | null
          month: number
          year: number
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          student_id: string
          event_type: string
          points: number
          reference_id?: string | null
          reference_type?: string | null
          month: number
          year: number
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          student_id?: string
          event_type?: string
          points?: number
          reference_id?: string | null
          reference_type?: string | null
          month?: number
          year?: number
          created_at?: string
        }
        Relationships: []
      }
      gamification_settings: {
        Row: {
          id: string
          is_active: boolean
          workout_points: number
          extra_workout_points: number
          challenge_points: number
          bonus_points: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          workout_points?: number
          extra_workout_points?: number
          challenge_points?: number
          bonus_points?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          is_active?: boolean
          workout_points?: number
          extra_workout_points?: number
          challenge_points?: number
          bonus_points?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meal_plan_foods: {
        Row: {
          id: string
          meal_id: string
          tenant_id: string | null
          food_item_id: string
          quantity: number
          calories: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          meal_id: string
          tenant_id?: string | null
          food_item_id: string
          quantity: number
          calories?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          meal_id?: string
          tenant_id?: string | null
          food_item_id?: string
          quantity?: number
          calories?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      meal_plan_meals: {
        Row: {
          id: string
          meal_plan_id: string
          tenant_id: string | null
          name: string
          meal_type: string
          suggested_time: string | null
          sort_order: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          meal_plan_id: string
          tenant_id?: string | null
          name: string
          meal_type: string
          suggested_time?: string | null
          sort_order?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          meal_plan_id?: string
          tenant_id?: string | null
          name?: string
          meal_type?: string
          suggested_time?: string | null
          sort_order?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          id: string
          tenant_id: string
          name: string
          goal: string | null
          status: string
          daily_calories: number | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          goal?: string | null
          status?: string
          daily_calories?: number | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          goal?: string | null
          status?: string
          daily_calories?: number | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_points: {
        Row: {
          id: string
          student_id: string
          tenant_id: string
          month: number
          year: number
          total_points: number
          workouts_completed: number
          exercises_completed: number
          load_increases: number
          active_minutes: number
          weekly_bonuses: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          tenant_id: string
          month: number
          year: number
          total_points?: number
          workouts_completed?: number
          exercises_completed?: number
          load_increases?: number
          active_minutes?: number
          weekly_bonuses?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          tenant_id?: string
          month?: number
          year?: number
          total_points?: number
          workouts_completed?: number
          exercises_completed?: number
          load_increases?: number
          active_minutes?: number
          weekly_bonuses?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_ranking_snapshots: {
        Row: {
          id: string
          tenant_id: string
          month: number
          year: number
          champion_id: string | null
          rankings: Json
          closed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          month: number
          year: number
          champion_id?: string | null
          rankings?: Json
          closed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          month?: number
          year?: number
          champion_id?: string | null
          rankings?: Json
          closed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      student_badges: {
        Row: {
          id: string
          student_id: string
          badge_type: string
          month: number
          year: number
          earned_at: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          badge_type: string
          month: number
          year: number
          earned_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          badge_type?: string
          month?: number
          year?: number
          earned_at?: string
          created_at?: string
        }
        Relationships: []
      }
      student_meal_plan_assignments: {
        Row: {
          id: string
          student_id: string
          meal_plan_id: string
          tenant_id: string | null
          status: string
          assigned_at: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          meal_plan_id: string
          tenant_id?: string | null
          status?: string
          assigned_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          meal_plan_id?: string
          tenant_id?: string | null
          status?: string
          assigned_at?: string
          created_at?: string
        }
        Relationships: []
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
