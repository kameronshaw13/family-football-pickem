import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vhfjxxpqmsjarathmdes.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_7onj6DiOIsCYK9OO3N8wSA_RFTaB8wC";

const REMEMBER_KEY = "football_pickem_remember_me";
let browserClient: SupabaseClient | null = null;

const universalStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    const remember = window.sessionStorage.getItem(REMEMBER_KEY) !== "0";
    if (remember) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    }
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  }
};

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

export function getUniversalSupabase() {
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: universalStorage
      }
    });
  }
  return browserClient;
}
