import { createClient } from "@supabase/supabase-js";

const env = import.meta.env as Record<string, string | undefined>;
const supabaseUrl =
  env.VITE_SUPABASE_URL ??
  env.NEXT_PUBLIC_SUPABASE_URL ??
  env.SUPABASE_URL ??
  undefined;

const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  env.SUPABASE_ANON_KEY ??
  undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("http")
);

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
