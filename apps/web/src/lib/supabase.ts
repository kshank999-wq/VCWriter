import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Two clients, deliberately distinct.
 *
 * `serverClient()` acts as the signed-in visitor and is bound by row level
 * security. `adminClient()` uses the service role, bypasses RLS, and is the
 * only way to write orders, licenses and release rows — spec §12.1: commerce
 * and download authorisation stay server-side.
 */

export const serverClient = () => {
  const cookieStore = cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refresh path handles rotation instead.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // See above.
        }
      },
    },
  });
};

let cachedAdmin: SupabaseClient | null = null;

/** Service-role client. Never import this from a client component. */
export const adminClient = (): SupabaseClient => {
  if (!cachedAdmin) {
    cachedAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedAdmin;
};

export const currentUser = async () => {
  const { data } = await serverClient().auth.getUser();
  return data.user ?? null;
};
