// Generated from the migration catalog by npm run db:types. Do not edit.
// PostgreSQL tables, relationships and RPC catalog; verify live local schema with check:database-types:local.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: {
    Tables: {
      academy_weeks: {
        Row: {
          id: string;
          week_number: number;
          kind: string;
          title_ar: string;
          title_en: string;
          description_ar: string;
          description_en: string;
          status: string;
        };
        Insert: {
          id?: string;
          week_number: number;
          kind: string;
          title_ar: string;
          title_en: string;
          description_ar?: string;
          description_en?: string;
          status?: string;
        };
        Update: {
          id?: string;
          week_number?: number;
          kind?: string;
          title_ar?: string;
          title_en?: string;
          description_ar?: string;
          description_en?: string;
          status?: string;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          week_id: string;
          title_ar: string;
          title_en: string;
          instructions_ar: string;
          instructions_en: string;
          max_score: number;
          due_at: string | null;
          status: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          week_id: string;
          title_ar: string;
          title_en: string;
          instructions_ar?: string;
          instructions_en?: string;
          max_score: number;
          due_at?: string | null;
          status?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          week_id?: string;
          title_ar?: string;
          title_en?: string;
          instructions_ar?: string;
          instructions_en?: string;
          max_score?: number;
          due_at?: string | null;
          status?: string;
          published_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'activities_week_id_fkey';
            columns: ['week_id'];
            isOneToOne: false;
            referencedRelation: 'academy_weeks';
            referencedColumns: ['id'];
          },
        ];
      };
      announcements: {
        Row: {
          id: string;
          title_ar: string;
          title_en: string;
          body_ar: string;
          body_en: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title_ar: string;
          title_en: string;
          body_ar: string;
          body_en: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title_ar?: string;
          title_en?: string;
          body_ar?: string;
          body_en?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      grade_criterion_scores: {
        Row: {
          grade_id: string;
          rubric_id: string;
          criterion_id: string;
          points: number;
        };
        Insert: {
          grade_id: string;
          rubric_id: string;
          criterion_id: string;
          points: number;
        };
        Update: {
          grade_id?: string;
          rubric_id?: string;
          criterion_id?: string;
          points?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'grade_criterion_scores_grade_id_rubric_id_fkey';
            columns: ['grade_id', 'rubric_id'];
            isOneToOne: false;
            referencedRelation: 'grades';
            referencedColumns: ['id', 'rubric_id'];
          },
          {
            foreignKeyName: 'grade_criterion_scores_rubric_id_criterion_id_fkey';
            columns: ['rubric_id', 'criterion_id'];
            isOneToOne: false;
            referencedRelation: 'rubric_criteria';
            referencedColumns: ['rubric_id', 'id'];
          },
        ];
      };
      grades: {
        Row: {
          id: string;
          submission_id: string;
          rubric_id: string;
          reviewer_id: string;
          revision: number;
          feedback: string;
          status: string;
          created_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          submission_id: string;
          rubric_id: string;
          reviewer_id: string;
          revision: number;
          feedback?: string;
          status: string;
          created_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          submission_id?: string;
          rubric_id?: string;
          reviewer_id?: string;
          revision?: number;
          feedback?: string;
          status?: string;
          created_at?: string;
          published_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'grades_reviewer_id_fkey';
            columns: ['reviewer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'grades_rubric_id_fkey';
            columns: ['rubric_id'];
            isOneToOne: false;
            referencedRelation: 'rubrics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'grades_submission_id_fkey';
            columns: ['submission_id'];
            isOneToOne: false;
            referencedRelation: 'submissions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'grades_submission_id_rubric_id_fkey';
            columns: ['submission_id', 'rubric_id'];
            isOneToOne: false;
            referencedRelation: 'submissions';
            referencedColumns: ['id', 'rubric_id'];
          },
        ];
      };
      notification_receipts: {
        Row: {
          user_id: string;
          event_key: string;
          read_at: string;
        };
        Insert: {
          user_id: string;
          event_key: string;
          read_at?: string;
        };
        Update: {
          user_id?: string;
          event_key?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_receipts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          whatsapp: string | null;
          major: string | null;
          academic_year: number | null;
          python_experience: string | null;
          university_id: string | null;
          locale: string;
          consent_version: string | null;
          consent_at: string | null;
          registered_at: string | null;
          created_at: string;
          updated_at: string;
          university: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          whatsapp?: string | null;
          major?: string | null;
          academic_year?: number | null;
          python_experience?: string | null;
          university_id?: string | null;
          locale?: string;
          consent_version?: string | null;
          consent_at?: string | null;
          registered_at?: string | null;
          created_at?: string;
          updated_at?: string;
          university?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          whatsapp?: string | null;
          major?: string | null;
          academic_year?: number | null;
          python_experience?: string | null;
          university_id?: string | null;
          locale?: string;
          consent_version?: string | null;
          consent_at?: string | null;
          registered_at?: string | null;
          created_at?: string;
          updated_at?: string;
          university?: string | null;
        };
        Relationships: [];
      };
      rubric_criteria: {
        Row: {
          id: string;
          rubric_id: string;
          label_ar: string;
          label_en: string;
          max_points: number;
          sort_order: number;
        };
        Insert: {
          id?: string;
          rubric_id: string;
          label_ar: string;
          label_en: string;
          max_points: number;
          sort_order: number;
        };
        Update: {
          id?: string;
          rubric_id?: string;
          label_ar?: string;
          label_en?: string;
          max_points?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'rubric_criteria_rubric_id_fkey';
            columns: ['rubric_id'];
            isOneToOne: false;
            referencedRelation: 'rubrics';
            referencedColumns: ['id'];
          },
        ];
      };
      rubrics: {
        Row: {
          id: string;
          activity_id: string;
          version: number;
          status: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          version: number;
          status?: string;
        };
        Update: {
          id?: string;
          activity_id?: string;
          version?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rubrics_activity_id_fkey';
            columns: ['activity_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id'];
          },
        ];
      };
      submissions: {
        Row: {
          id: string;
          student_id: string;
          activity_id: string;
          rubric_id: string;
          attempt: number;
          object_path: string | null;
          status: string;
          submitted_at: string | null;
          created_at: string;
          notebook_sha256: string | null;
          notebook_bytes: number | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          activity_id: string;
          rubric_id: string;
          attempt?: number;
          object_path?: never;
          status?: string;
          submitted_at?: string | null;
          created_at?: string;
          notebook_sha256?: string | null;
          notebook_bytes?: number | null;
        };
        Update: {
          id?: string;
          student_id?: string;
          activity_id?: string;
          rubric_id?: string;
          attempt?: number;
          object_path?: never;
          status?: string;
          submitted_at?: string | null;
          created_at?: string;
          notebook_sha256?: string | null;
          notebook_bytes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'submissions_activity_id_fkey';
            columns: ['activity_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_rubric_id_activity_id_fkey';
            columns: ['rubric_id', 'activity_id'];
            isOneToOne: false;
            referencedRelation: 'rubrics';
            referencedColumns: ['id', 'activity_id'];
          },
          {
            foreignKeyName: 'submissions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      academy_capabilities: { Args: Record<string, never>; Returns: Json };
      academy_leaderboard: { Args: Record<string, never>; Returns: Json };
      academy_notifications: { Args: Record<string, never>; Returns: Json };
      claim_submission_request: { Args: { p_student_id: string }; Returns: undefined };
      complete_registration: { Args: { p_consent_version: string }; Returns: undefined };
      create_draft_rubric: { Args: { p_activity_id: string; p_criteria: Json }; Returns: string };
      current_academy_role: { Args: Record<string, never>; Returns: string | null };
      finalize_notebook: {
        Args: { p_submission_id: string; p_sha256: string };
        Returns: undefined;
      };
      read_notification: { Args: { p_event_key?: string }; Returns: undefined };
      request_resubmission: { Args: { p_submission_id: string }; Returns: undefined };
      reserve_notebook: {
        Args: {
          p_student_id: string;
          p_activity_id: string;
          p_request_id: string;
          p_sha256: string;
          p_bytes: number;
        };
        Returns: Json;
      };
      save_draft_rubric: { Args: { p_rubric_id: string; p_criteria: Json }; Returns: undefined };
      save_grade: {
        Args: {
          p_submission_id: string;
          p_scores: Json;
          p_feedback: string;
          p_publish: boolean;
          p_expected_revision: number;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
