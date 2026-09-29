import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

let admin: SupabaseClient<Database> | null = null;

/** Service-role client for server-side writes (prices, usage, chat). Bypasses RLS. */
export function adminClient() {
  admin ??= createClient<Database>(serverEnv.supabaseUrl(), serverEnv.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
