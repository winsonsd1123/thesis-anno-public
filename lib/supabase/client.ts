import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Check if we are in the browser context
  const isBrowser = typeof window !== "undefined";

  // Use the proxy URL on the client to avoid GFW blocking issues
  // On the server (SSR), use the direct URL for performance/reliability
  const supabaseUrl = isBrowser
    ? `${window.location.origin}/api/supabase`
    : process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
