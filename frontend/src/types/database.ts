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
          public_full_name_consent: boolean;
          public_full_name_consent_at: string | null;
          public_full_name_consent_version: string | null;
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
          public_full_name_consent?: boolean;
          public_full_name_consent_at?: string | null;
          public_full_name_consent_version?: string | null;
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
          public_full_name_consent?: boolean;
          public_full_name_consent_at?: string | null;
          public_full_name_consent_version?: string | null;
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
      week1_bingo_boards: {
        Row: {
          student_id: string;
          board_order: Json;
          completed: Json;
          version: number;
          created_at: string;
          updated_at: string;
          id: string;
          retired_at: string | null;
        };
        Insert: {
          student_id: string;
          board_order: Json;
          completed?: Json;
          version?: number;
          created_at?: string;
          updated_at?: string;
          id?: string;
          retired_at?: string | null;
        };
        Update: {
          student_id?: string;
          board_order?: Json;
          completed?: Json;
          version?: number;
          created_at?: string;
          updated_at?: string;
          id?: string;
          retired_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'week1_bingo_boards_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      week1_bingo_claims: {
        Row: {
          id: string;
          reference: string;
          student_id: string;
          board_snapshot: Json;
          completed_snapshot: Json;
          winning_line: Json;
          challenges: Json;
          status: string;
          created_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          round_id: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          student_id: string;
          board_snapshot: Json;
          completed_snapshot: Json;
          winning_line: Json;
          challenges: Json;
          status?: string;
          created_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          round_id: string;
        };
        Update: {
          id?: string;
          reference?: string;
          student_id?: string;
          board_snapshot?: Json;
          completed_snapshot?: Json;
          winning_line?: Json;
          challenges?: Json;
          status?: string;
          created_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          round_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'week1_bingo_claims_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'week1_bingo_claims_round_id_student_id_fkey';
            columns: ['round_id', 'student_id'];
            isOneToOne: false;
            referencedRelation: 'week1_bingo_boards';
            referencedColumns: ['id', 'student_id'];
          },
        ];
      };
      week1_datasets: {
        Row: {
          student_id: string;
          title: string;
          url: string;
          topic: string;
          description: string;
          column1: string;
          column2: string;
          column3: string;
          question: string;
          status: string;
          created_at: string;
          updated_at: string;
          submitted_at: string | null;
          version: number;
          id: string;
        };
        Insert: {
          student_id: string;
          title: string;
          url: string;
          topic: string;
          description: string;
          column1: string;
          column2: string;
          column3: string;
          question: string;
          status: string;
          created_at?: string;
          updated_at?: string;
          submitted_at?: string | null;
          version?: number;
          id?: string;
        };
        Update: {
          student_id?: string;
          title?: string;
          url?: string;
          topic?: string;
          description?: string;
          column1?: string;
          column2?: string;
          column3?: string;
          question?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          submitted_at?: string | null;
          version?: number;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'week1_datasets_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      week1_session: {
        Row: {
          id: number;
          topics: Json;
          version: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          topics: Json;
          version?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          topics?: Json;
          version?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'week1_session_updated_by_fkey';
            columns: ['updated_by'];
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
      academy_leaderboard: { Args: { p_weekly?: boolean }; Returns: Json };
      academy_notifications: { Args: Record<string, never>; Returns: Json };
      admin_award_history: { Args: { p_student_id?: string }; Returns: Json };
      admin_award_points: {
        Args: {
          p_student_id: string;
          p_points: number;
          p_reason: string;
          p_idempotency_key: string;
        };
        Returns: string;
      };
      admin_award_students: { Args: Record<string, never>; Returns: Json };
      claim_submission_request: { Args: { p_student_id: string }; Returns: undefined };
      complete_owner_approved_hussein_team_transition: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      complete_registration: { Args: { p_consent_version: string }; Returns: undefined };
      correct_registered_student_name: {
        Args: { p_student_id: string; p_full_name: string };
        Returns: undefined;
      };
      create_draft_rubric: { Args: { p_activity_id: string; p_criteria: Json }; Returns: string };
      current_academy_is_admin: { Args: Record<string, never>; Returns: boolean };
      current_academy_role: { Args: Record<string, never>; Returns: string | null };
      current_user_can_complete_hussein_team_transition: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      current_user_has_initial_admin_promotion: { Args: Record<string, never>; Returns: boolean };
      finalize_notebook: {
        Args: { p_submission_id: string; p_sha256: string };
        Returns: undefined;
      };
      promote_initial_academy_admin: { Args: Record<string, never>; Returns: undefined };
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
      set_public_full_name_consent: { Args: { p_consented: boolean }; Returns: undefined };
      week1_claim_bingo: { Args: { p_round_id?: string }; Returns: undefined };
      week1_mark_bingo: {
        Args: { p_challenge: number; p_completed: boolean; p_version: number; p_round_id?: string };
        Returns: undefined;
      };
      week1_play_again: { Args: { p_round_id: string }; Returns: undefined };
      week1_review_bingo: {
        Args: { p_id: string; p_status: string; p_reason: string };
        Returns: undefined;
      };
      week1_save_dataset: {
        Args: { p_data: Json; p_version: number; p_attempt_id?: string };
        Returns: string;
      };
      week1_save_session: { Args: { p_topics: Json; p_version: number }; Returns: undefined };
      week1_start_bingo: { Args: Record<string, never>; Returns: undefined };
      week1_start_dataset_attempt: { Args: { p_previous_id?: string }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
