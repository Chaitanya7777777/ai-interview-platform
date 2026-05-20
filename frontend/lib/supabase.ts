"use client";

/**
 * lib/supabase.ts
 * ---------------
 * Supabase browser client — lazy singleton.
 *
 * CRITICAL: This file must NOT call createBrowserClient() at module level.
 *
 * During Next.js production builds (Vercel prerender), the module graph is
 * statically traversed and module-level code is executed in Node.js, which
 * has no window, document, or localStorage. createBrowserClient() internally
 * accesses these browser APIs to initialise its storage adapter, causing:
 *
 *   Error occurred prerendering page "/login"
 *   ReferenceError: window is not defined  (or localStorage, document)
 *
 * The fix: export a getter function, not an eagerly-evaluated constant.
 * The client is only constructed on the first actual call from within a
 * React component or event handler (always in the browser, never during SSR).
 *
 * Local dev did not catch this because `next dev` does not prerender
 * client component trees — it only bundles them. `next build` (used by
 * Vercel) runs a full static generation pass that exercises the import graph.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Module-level variable — holds the singleton once created.
// Declared here (not initialised) so no browser API is touched at import time.
let _client: SupabaseClient | undefined;

/**
 * Returns the shared Supabase browser client, creating it on first call.
 *
 * Safe to call from anywhere in client components, hooks, and services.
 * Must NOT be called at module level or inside server components.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Check your .env.local (dev) or Vercel environment variables (production)."
    );
  }

  _client = createBrowserClient(url, key);
  return _client;
}

/**
 * Convenience re-export of the shared client.
 *
 * Usage:
 *   import { supabase } from "@/lib/supabase";
 *   const { data } = await supabase.auth.signIn(...);
 *
 * This is a getter — it returns the lazy singleton.
 * Importing this file does NOT instantiate the client.
 */
export const supabase = {
  get auth() {
    return getSupabaseBrowserClient().auth;
  },
  get from() {
    return getSupabaseBrowserClient().from.bind(getSupabaseBrowserClient());
  },
  get storage() {
    return getSupabaseBrowserClient().storage;
  },
  get realtime() {
    return getSupabaseBrowserClient().realtime;
  },
  get functions() {
    return getSupabaseBrowserClient().functions;
  },
  get channel() {
    return getSupabaseBrowserClient().channel.bind(getSupabaseBrowserClient());
  },
} as const;