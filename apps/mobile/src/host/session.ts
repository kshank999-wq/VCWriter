import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Being signed in, on a phone (addendum 27 §3).
 *
 * **A password, and no magic link at all.** Addendum 09 §14 found out the hard
 * way that a link is bound to the browser that asked for it, so a phone's mail
 * app could not complete one; a native app cannot even try, having no browser
 * to come back to. So the app signs in with an email and a password — the
 * thing built for the web phone two days ago, needed here for the same reason
 * one layer further out — and *Email me a link* is **absent rather than
 * offered and broken**.
 *
 * The session lives in the device's own storage and refreshes itself, which is
 * why a writer signs in once and then never again: a notebook that asked for a
 * password on a walk is one nobody carries.
 *
 * The anon key is **publishable by design** — it is already in every page of
 * vc-writer.com, and what protects the data is row-level security rather than
 * the key being secret. It is still read from the environment rather than
 * written down here, because a key in a file is a key somebody rotates and
 * forgets.
 */

const config = (): { url: string; key: string } => {
  const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseKey?: string };
  const url = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? extra.supabaseUrl ?? '';
  const key = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? extra.supabaseKey ?? '';
  return { url, key };
};

let client: SupabaseClient | null = null;

export const supabase = (): SupabaseClient => {
  if (!client) {
    const { url, key } = config();
    client = createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        // Signed in once, and stays that way: the whole point of the app is
        // that a thought can be caught without a password between.
        persistSession: true,
        autoRefreshToken: true,
        // Nothing arrives back through a URL here, there being no browser to
        // arrive from.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
};

/** Whether the app has been told where to sign in at all. */
export const isConfigured = (): boolean => {
  const { url, key } = config();
  return url.length > 0 && key.length > 0;
};

export const signIn = async (email: string, password: string): Promise<string | null> => {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (!error) return null;
  /**
   * Supabase says *Invalid login credentials* both for a wrong password and
   * for an account that has never set one, which are different problems with
   * different answers — so the sentence names both, exactly as the website's
   * does (addendum 09 §14).
   */
  return error.message === 'Invalid login credentials'
    ? 'That email and password do not match. If you have never set a password, set one on your account page at vc-writer.com and come back.'
    : error.message;
};

export const signOut = async (): Promise<void> => {
  await supabase().auth.signOut();
};
