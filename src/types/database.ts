// supabase/migrations 기준으로 작성한 타입.
// 스키마를 바꾸면 `pnpm db:types`(로그인된 터미널)로 다시 생성하거나 함께 수정한다.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type InviteStatus = "open" | "used" | "revoked";
export type MemberRole = "host" | "member";
export type MemberStatus = "pending" | "active";
export type MediaType = "photo" | "video";

export type Database = {
  public: {
    Tables: {
      sessions: Table<
        { id: string; name: string; host_user_id: string; host_last_seen: string; created_at: string },
        { id?: string; name: string; host_user_id: string; host_last_seen?: string; created_at?: string }
      >;
      invites: Table<
        {
          id: string;
          session_id: string;
          token_hash: string;
          memo: string | null;
          status: InviteStatus;
          created_at: string;
          expires_at: string;
          used_at: string | null;
        },
        {
          id?: string;
          session_id: string;
          token_hash: string;
          memo?: string | null;
          status?: InviteStatus;
          created_at?: string;
          expires_at?: string;
          used_at?: string | null;
        }
      >;
      members: Table<
        {
          id: string;
          session_id: string;
          user_id: string;
          invite_id: string | null;
          nickname: string;
          role: MemberRole;
          status: MemberStatus;
          joined_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          session_id: string;
          user_id: string;
          invite_id?: string | null;
          nickname: string;
          role?: MemberRole;
          status?: MemberStatus;
          joined_at?: string | null;
          created_at?: string;
        }
      >;
      missions: Table<
        { session_id: string; log_date: string; body: string; updated_at: string },
        { session_id: string; log_date: string; body: string; updated_at?: string }
      >;
      capture_tickets: Table<
        {
          id: string;
          member_id: string;
          slot_start: string;
          post_id: string;
          issued_at: string;
          expires_at: string;
          used: boolean;
        },
        {
          id?: string;
          member_id: string;
          slot_start: string;
          post_id: string;
          issued_at?: string;
          expires_at?: string;
          used?: boolean;
        }
      >;
      posts: Table<
        {
          id: string;
          session_id: string;
          member_id: string;
          slot_start: string;
          log_date: string;
          media_type: MediaType;
          media_path: string;
          thumb_path: string;
          mime_type: string;
          duration_ms: number | null;
          caption: string | null;
          created_at: string;
        },
        {
          id: string;
          session_id: string;
          member_id: string;
          slot_start: string;
          log_date: string;
          media_type: MediaType;
          media_path: string;
          thumb_path: string;
          mime_type: string;
          duration_ms?: number | null;
          caption?: string | null;
          created_at?: string;
        }
      >;
      comments: Table<
        {
          id: string;
          post_id: string;
          member_id: string;
          body: string | null;
          deleted_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          post_id: string;
          member_id: string;
          body?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        }
      >;
      transfer_codes: Table<
        { code_hash: string; from_user_id: string; expires_at: string; used_at: string | null },
        { code_hash: string; from_user_id: string; expires_at?: string; used_at?: string | null }
      >;
      push_subscriptions: Table<
        {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          quiet_start: number;
          quiet_end: number;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          quiet_start?: number;
          quiet_end?: number;
          created_at?: string;
        }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_active_member: { Args: { p_session_id: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
