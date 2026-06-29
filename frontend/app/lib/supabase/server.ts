import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function readEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
}

export function getSupabase(): SupabaseClient {
  const url = readEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
  const key = readEnv([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ]);

  if (!url || !key) {
    throw new Error(
      "Missing Supabase config. Set SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_URL plus NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  client ??= createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}
