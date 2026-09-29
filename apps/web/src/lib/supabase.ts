import { cookies, headers } from 'next/headers';
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

/**
 * The token an app sent, where one did (addendum 27 §2).
 *
 * **A browser proves who it is with a cookie and an app cannot.** The
 * `/api/notes` routes were written so *another developer's app should not need
 * this project's RLS in its head* (addendum 09 §3) and then only ever read a
 * cookie, which no native app has — the same shape of fault as a bridge that
 * answers `ok([])`: a door built for a caller that could not open it.
 *
 * It is read **here rather than in the notes routes** because *who is calling*
 * must have one answer: a second reader would drift, and the phone will want
 * more of the site than the four routes it starts with.
 *
 * A browser sends no `Authorization` header unless it is asked to, so nothing
 * that worked yesterday reads differently today.
 */
const bearerToken = (): string | null => {
  try {
    const said = headers().get('authorization') ?? '';
    const [scheme, token] = said.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  } catch {
    // `headers()` is unavailable where there is no request, which is where
    // there is no app either.
    return null;
  }
};

export const serverClient = () => {
  // An app's token, which stands in for the cookie and is bound by exactly the
  // same row-level security — it *is* that person's session, not a way past it.
  const token = bearerToken();
  if (token) {
    return createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }

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
