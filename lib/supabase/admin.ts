import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

let admin: SupabaseClient<Database> | null = null;

/**
 * Server-side database client. It uses the public anon key plus the private `x-app-secret` header;
 * RLS allows reads and writes only when that header matches (see migration 0005). Browsers never get the secret.
 */
export function adminClient() {
  admin ??= createClient<Database>(serverEnv.supabaseUrl(), serverEnv.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-app-secret": serverEnv.appDbSecret() } },
  });
  return admin;
}
