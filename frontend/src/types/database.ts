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
          week_id: string | null;
          title_ar: string;
          title_en: string;
          instructions_ar: string;
          instructions_en: string;
          max_score: number;
          due_at: string | null;
          status: string;
          published_at: string | null;
          assignment_mode: boolean;
          publish_at: string | null;
          submission_type: string;
          reference_links: string;
          phases: Json;
          accepting: boolean;
          archived: boolean;
          sort_order: number;
          version: number;
        };
        Insert: {
          id?: string;
          week_id?: string | null;
          title_ar: string;
          title_en: string;
          instructions_ar?: string;
          instructions_en?: string;
          max_score: number;
          due_at?: string | null;
          status?: string;
          published_at?: string | null;
          assignment_mode?: boolean;
          publish_at?: string | null;
          submission_type?: string;
          reference_links?: string;
          phases?: Json;
          accepting?: boolean;
          archived?: boolean;
          sort_order?: number;
          version?: number;
        };
        Update: {
          id?: string;
          week_id?: string | null;
          title_ar?: string;
          title_en?: string;
          instructions_ar?: string;
          instructions_en?: string;
          max_score?: number;
          due_at?: string | null;
          status?: string;
          published_at?: string | null;
          assignment_mode?: boolean;
          publish_at?: string | null;
          submission_type?: string;
          reference_links?: string;
          phases?: Json;
          accepting?: boolean;
          archived?: boolean;
          sort_order?: number;
          version?: number;
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
          version: number;
        };
        Insert: {
          id?: string;
          title_ar: string;
          title_en: string;
          body_ar: string;
          body_en: string;
          status?: string;
          created_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          title_ar?: string;
          title_en?: string;
          body_ar?: string;
          body_en?: string;
          status?: string;
          created_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      form_drafts: {
        Row: {
          owner_id: string;
          form_key: string;
          base_version: string;
          payload: Json;
          revision: number;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          form_key: string;
          base_version: string;
          payload?: Json;
          revision?: number;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          form_key?: string;
          base_version?: string;
          payload?: Json;
          revision?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'form_drafts_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
          rubric_id: string | null;
          reviewer_id: string;
          revision: number;
          feedback: string;
          status: string;
          created_at: string;
          published_at: string | null;
          awarded_points: number | null;
        };
        Insert: {
          id?: string;
          submission_id: string;
          rubric_id?: string | null;
          reviewer_id: string;
          revision: number;
          feedback?: string;
          status: string;
          created_at?: string;
          published_at?: string | null;
          awarded_points?: number | null;
        };
        Update: {
          id?: string;
          submission_id?: string;
          rubric_id?: string | null;
          reviewer_id?: string;
          revision?: number;
          feedback?: string;
          status?: string;
          created_at?: string;
          published_at?: string | null;
          awarded_points?: number | null;
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
      point_awards: {
        Row: {
          student_id: string;
          source_key: string;
          points: number;
          period_start: string;
          submission_id: string | null;
          dataset_attempt_id: string | null;
          reviewed_by: string;
          reviewed_at: string;
          scoring_week: number | null;
        };
        Insert: {
          student_id: string;
          source_key: string;
          points: number;
          period_start: string;
          submission_id?: string | null;
          dataset_attempt_id?: string | null;
          reviewed_by: string;
          reviewed_at?: string;
          scoring_week?: number | null;
        };
        Update: {
          student_id?: string;
          source_key?: string;
          points?: number;
          period_start?: string;
          submission_id?: string | null;
          dataset_attempt_id?: string | null;
          reviewed_by?: string;
          reviewed_at?: string;
          scoring_week?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'point_awards_dataset_attempt_id_fkey';
            columns: ['dataset_attempt_id'];
            isOneToOne: false;
            referencedRelation: 'week1_datasets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'point_awards_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'point_awards_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'point_awards_submission_id_fkey';
            columns: ['submission_id'];
            isOneToOne: false;
            referencedRelation: 'submissions';
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
          leaderboard_alias: string | null;
          public_full_name_consent: boolean;
          public_full_name_consent_at: string | null;
          leaderboard_name: string | null;
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
          leaderboard_alias?: string | null;
          public_full_name_consent?: boolean;
          public_full_name_consent_at?: string | null;
          leaderboard_name?: never;
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
          leaderboard_alias?: string | null;
          public_full_name_consent?: boolean;
          public_full_name_consent_at?: string | null;
          leaderboard_name?: never;
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
      session_public_content: {
        Row: {
          week_number: number;
          published: boolean;
          topics: Json;
        };
        Insert: {
          week_number: number;
          published?: boolean;
          topics?: Json;
        };
        Update: {
          week_number?: number;
          published?: boolean;
          topics?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'session_public_content_week_number_fkey';
            columns: ['week_number'];
            isOneToOne: true;
            referencedRelation: 'week1_session';
            referencedColumns: ['id'];
          },
        ];
      };
      submissions: {
        Row: {
          id: string;
          student_id: string;
          activity_id: string;
          rubric_id: string | null;
          attempt: number;
          object_path: string | null;
          status: string;
          submitted_at: string | null;
          created_at: string;
          notebook_sha256: string | null;
          notebook_bytes: number | null;
          assignment_submission: boolean;
          link_url: string | null;
          attachment_path: string | null;
          file_name: string | null;
          file_mime: string | null;
          file_bytes: number | null;
          phase_snapshot: Json | null;
          max_eligible_points: number | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          activity_id: string;
          rubric_id?: string | null;
          attempt?: number;
          object_path?: never;
          status?: string;
          submitted_at?: string | null;
          created_at?: string;
          notebook_sha256?: string | null;
          notebook_bytes?: number | null;
          assignment_submission?: boolean;
          link_url?: string | null;
          attachment_path?: string | null;
          file_name?: string | null;
          file_mime?: string | null;
          file_bytes?: number | null;
          phase_snapshot?: Json | null;
          max_eligible_points?: number | null;
        };
        Update: {
          id?: string;
          student_id?: string;
          activity_id?: string;
          rubric_id?: string | null;
          attempt?: number;
          object_path?: never;
          status?: string;
          submitted_at?: string | null;
          created_at?: string;
          notebook_sha256?: string | null;
          notebook_bytes?: number | null;
          assignment_submission?: boolean;
          link_url?: string | null;
          attachment_path?: string | null;
          file_name?: string | null;
          file_mime?: string | null;
          file_bytes?: number | null;
          phase_snapshot?: Json | null;
          max_eligible_points?: number | null;
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
      academy_rankings: { Args: { p_view?: string; p_week?: number }; Returns: Json };
      admin_award_points: {
        Args: { p_student: string; p_amount: number; p_reason: string; p_idempotency_key: string };
        Returns: string;
      };
      admin_point_award_history: {
        Args: { p_student?: string };
        Returns: {
          id: string;
          actor_name: string;
          student_id: string;
          student_name: string;
          amount: number;
          reason: string;
          created_at: string;
        }[];
      };
      admin_search_students: {
        Args: { p_query?: string };
        Returns: { student_id: string; full_name: string; points: number }[];
      };
      approve_dataset_participation: { Args: { p_attempt: string }; Returns: undefined };
      claim_submission_request: { Args: { p_student_id: string }; Returns: undefined };
      complete_registration: { Args: { p_consent_version: string }; Returns: undefined };
      create_draft_rubric: { Args: { p_activity_id: string; p_criteria: Json }; Returns: string };
      current_academy_is_admin: { Args: Record<string, never>; Returns: boolean };
      current_academy_role: { Args: Record<string, never>; Returns: string | null };
      finalize_assignment: { Args: { p_submission: string }; Returns: undefined };
      finalize_notebook: {
        Args: { p_submission_id: string; p_sha256: string };
        Returns: undefined;
      };
      move_assignment: {
        Args: { p_id: string; p_direction: number; p_version: number };
        Returns: undefined;
      };
      open_form_draft: { Args: { p_owner: string; p_form: string; p_base: string }; Returns: Json };
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
      review_assignment: {
        Args: { p_submission: string; p_points: number; p_feedback: string; p_revision: number };
        Returns: string;
      };
      save_assignment: {
        Args: { p_data: Json; p_version: number; p_id?: string; p_request?: string };
        Returns: string;
      };
      save_draft_rubric: {
        Args: { p_rubric_id: string; p_criteria: Json; p_snapshot?: Json };
        Returns: undefined;
      };
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
      save_session_content: {
        Args: { p_week: number; p_topics: Json; p_published: boolean; p_version: number };
        Returns: undefined;
      };
      set_public_full_name_consent: { Args: { p_consented: boolean }; Returns: undefined };
      submit_assignment: {
        Args: { p_activity: string; p_request: string; p_link?: string; p_file?: Json };
        Returns: string;
      };
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
      write_form_draft: {
        Args: {
          p_owner: string;
          p_form: string;
          p_base: string;
          p_payload: Json;
          p_revision: number;
        };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
