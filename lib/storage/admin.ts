// lib/storage/admin.ts
//
// The service_role Storage client. Server-only.
//
// service_role bypasses RLS, so this module must never be imported from a client
// component. `import 'server-only'` turns that mistake into a build error rather
// than a leaked key in the browser bundle.

import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Lazily constructed so a missing env var fails on first use with a clear
 * message, instead of throwing at import time and taking down every route that
 * happens to share a bundle with this file.
 */
export function storageAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
