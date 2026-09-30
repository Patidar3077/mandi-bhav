// Generated from the Supabase schema (supabase/migrations). Regenerate after schema changes.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_insights: {
        Row: { commodity: string; created_at: string; district: string; factors: Json; id: number; insight_date: string; language: string; market: string; summary: string };
        Insert: { commodity: string; created_at?: string; district: string; factors?: Json; id?: never; insight_date: string; language: string; market?: string; summary: string };
        Update: { commodity?: string; created_at?: string; district?: string; factors?: Json; id?: never; insight_date?: string; language?: string; market?: string; summary?: string };
        Relationships: [];
      };
      chat_messages: {
        Row: { content: string; conversation_id: string; created_at: string; id: number; role: string; user_id: string };
        Insert: { content: string; conversation_id: string; created_at?: string; id?: never; role: string; user_id: string };
        Update: { content?: string; conversation_id?: string; created_at?: string; id?: never; role?: string; user_id?: string };
        Relationships: [];
      };
      commodities: {
        Row: { aliases: string[]; data_name: string; is_quick_pick: boolean; name_en: string; name_hi: string | null; name_mr: string | null };
        Insert: { aliases?: string[]; data_name: string; is_quick_pick?: boolean; name_en: string; name_hi?: string | null; name_mr?: string | null };
        Update: { aliases?: string[]; data_name?: string; is_quick_pick?: boolean; name_en?: string; name_hi?: string | null; name_mr?: string | null };
        Relationships: [];
      };
      district_neighbours: {
        Row: { district: string; neighbour: string };
        Insert: { district: string; neighbour: string };
        Update: { district?: string; neighbour?: string };
        Relationships: [];
      };
      login_code_sends: {
        Row: { email: string; id: number; ip: string | null; sent_at: string };
        Insert: { email: string; id?: never; ip?: string | null; sent_at?: string };
        Update: { email?: string; id?: never; ip?: string | null; sent_at?: string };
        Relationships: [];
      };
      markets: {
        Row: { district: string; id: number; market: string; state: string };
        Insert: { district: string; id?: never; market: string; state?: string };
        Update: { district?: string; id?: never; market?: string; state?: string };
        Relationships: [];
      };
      predictions: {
        Row: { commodity: string; confidence: string; created_at: string; district: string | null; horizon: string; id: number; made_on: string; market: string | null; method_version: string; predicted_high: number; predicted_low: number; predicted_mid: number; target_date: string };
        Insert: { commodity: string; confidence: string; created_at?: string; district?: string | null; horizon: string; id?: never; made_on: string; market?: string | null; method_version: string; predicted_high: number; predicted_low: number; predicted_mid: number; target_date: string };
        Update: { commodity?: string; confidence?: string; created_at?: string; district?: string | null; horizon?: string; id?: never; made_on?: string; market?: string | null; method_version?: string; predicted_high?: number; predicted_low?: number; predicted_mid?: number; target_date?: string };
        Relationships: [];
      };
      prices: {
        Row: { arrival_date: string; commodity: string; district: string; fetched_at: string; grade: string; id: number; market: string; max_price: number | null; min_price: number | null; modal_price: number; source: string; state: string; variety: string };
        Insert: { arrival_date: string; commodity: string; district: string; fetched_at?: string; grade?: string; id?: never; market: string; max_price?: number | null; min_price?: number | null; modal_price: number; source?: string; state: string; variety?: string };
        Update: { arrival_date?: string; commodity?: string; district?: string; fetched_at?: string; grade?: string; id?: never; market?: string; max_price?: number | null; min_price?: number | null; modal_price?: number; source?: string; state?: string; variety?: string };
        Relationships: [];
      };
      profiles: {
        Row: { created_at: string; district: string; email: string | null; id: string; language: string; name: string | null; onboarded: boolean; phone: string | null; plan: string; preferred_market: string | null; trial_ends_at: string };
        Insert: { created_at?: string; district?: string; email?: string | null; id: string; language?: string; name?: string | null; onboarded?: boolean; phone?: string | null; plan?: string; preferred_market?: string | null; trial_ends_at?: string };
        Update: { created_at?: string; district?: string; email?: string | null; id?: string; language?: string; name?: string | null; onboarded?: boolean; phone?: string | null; plan?: string; preferred_market?: string | null; trial_ends_at?: string };
        Relationships: [];
      };
      searches: {
        Row: { commodity: string; created_at: string; district: string; id: number; market: string | null; search_date: string; user_id: string };
        Insert: { commodity: string; created_at?: string; district: string; id?: never; market?: string | null; search_date?: string; user_id: string };
        Update: { commodity?: string; created_at?: string; district?: string; id?: never; market?: string | null; search_date?: string; user_id?: string };
        Relationships: [];
      };
      sync_runs: {
        Row: { apify_run_id: string | null; cost_usd: number; error: string | null; filter_key: string | null; filters: Json; finished_at: string | null; id: number; rows_saved: number; started_at: string; status: string; type: string };
        Insert: { apify_run_id?: string | null; cost_usd?: number; error?: string | null; filter_key?: string | null; filters?: Json; finished_at?: string | null; id?: never; rows_saved?: number; started_at?: string; status?: string; type: string };
        Update: { apify_run_id?: string | null; cost_usd?: number; error?: string | null; filter_key?: string | null; filters?: Json; finished_at?: string | null; id?: never; rows_saved?: number; started_at?: string; status?: string; type?: string };
        Relationships: [];
      };
      visitors: {
        Row: { created_at: string; district: string; id: string; ip: string | null; language: string; last_seen_at: string; name: string; preferred_market: string | null };
        Insert: { created_at?: string; district?: string; id?: string; ip?: string | null; language?: string; last_seen_at?: string; name: string; preferred_market?: string | null };
        Update: { created_at?: string; district?: string; id?: string; ip?: string | null; language?: string; last_seen_at?: string; name?: string; preferred_market?: string | null };
        Relationships: [];
      };
      usage_daily: {
        Row: { chats_used: number; searches_used: number; usage_date: string; user_id: string };
        Insert: { chats_used?: number; searches_used?: number; usage_date: string; user_id: string };
        Update: { chats_used?: number; searches_used?: number; usage_date?: string; user_id?: string };
        Relationships: [];
      };
    };
    Views: {
      price_commodities: {
        Row: { commodity: string | null };
        Relationships: [];
      };
    };
    Functions: {
      consume_usage: {
        Args: { p_kind: string; p_limit: number; p_user: string };
        Returns: { allowed: boolean; used: number }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
