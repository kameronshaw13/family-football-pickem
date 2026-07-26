import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient<any> | null = null;

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server environment variables.");
  if (!adminClient) {
    adminClient = createClient<any>(url, key, { auth: { persistSession: false } });
  }
  return adminClient;
}
