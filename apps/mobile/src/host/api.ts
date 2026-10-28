import Constants from 'expo-constants';
import { supabase } from './session';
import type { CaptureItem, NotesPlan } from '@vcwriter/domain';

/**
 * The site, from the app (addendum 27 §2).
 *
 * **The routes are the only door.** This app never reaches a Supabase table
 * directly, though it perfectly well could: `/api/notes` was written so that
 * *another developer's app should not need this project's RLS in its head*
 * (addendum 09 §3), and an app that read the tables itself would be a second
 * answer to what a note may carry — the very thing the routes exist to stop.
 * Auth is the one exception below, and it is not a table.
 *
 * What travels is a **bearer token**, because a browser proves who it is with
 * a cookie and an app has none. `serverClient()` reads it and is bound by
 * exactly the same row-level security; it is that person's session rather
 * than a way past it.
 */

/**
 * Where vc-writer.com is, for this build.
 *
 * **Exported, because three screens need it and a second copy would be the
 * older one** — which is the reason `Account` gives for linking the privacy
 * policy rather than repeating it, applied to the address the link is made
 * from. It is here rather than in a module of its own because this file is
 * already *the site, from the app*, and a `site.ts` beside it would be a
 * second answer to where that is.
 */
export const site = (): string => {
  const said = (Constants.expoConfig?.extra as { site?: string } | undefined)?.site;
  return (process.env['EXPO_PUBLIC_SITE'] ?? said ?? 'https://vc-writer.com').replace(/\/$/, '');
};

/** What a call came back with, or why it did not. */
export type Answer<T> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T>(data: T): Answer<T> => ({ ok: true, data });
const no = <T>(error: string): Answer<T> => ({ ok: false, error });

const ask = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<Answer<T>> => {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return no('Sign in first.');

  try {
    const response = await fetch(`${site()}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const body = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) return no(body.error ?? `That did not work (${response.status})`);
    return ok(body);
  } catch (cause) {
    // Offline is ordinary here rather than exceptional: the queue is what the
    // whole app is arranged around.
    return no(cause instanceof Error ? cause.message : 'No signal');
  }
};

export interface ProjectSummary {
  id: string;
  title: string;
  format: string;
  updated_at: string;
}

export const listProjects = async (): Promise<Answer<ProjectSummary[]>> => {
  const said = await ask<{ projects?: ProjectSummary[] }>('/api/notes/projects');
  return said.ok ? ok(said.data.projects ?? []) : said;
};

/** A story of a collection, as the phone lists it (addendum 27 §23). */
export interface StoryChoice {
  id: string;
  title: string;
}

export const makeProject = async (input: {
  title: string;
  format: string;
  /** A collection's story names, or the one story's (addendum 27 §23). */
  stories?: string[];
}): Promise<Answer<ProjectSummary>> => {
  const said = await ask<{ project?: ProjectSummary }>('/api/notes/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!said.ok) return said;
  return said.data.project ? ok(said.data.project) : no('That project could not be started.');
};

/** A collection's stories, in order (addendum 27 §23). */
export const listStories = async (projectId: string): Promise<Answer<StoryChoice[]>> => {
  const said = await ask<{ stories?: StoryChoice[] }>(`/api/notes/projects/${encodeURIComponent(projectId)}/stories`);
  return said.ok ? ok(said.data.stories ?? []) : said;
};

/** Add a story at the end of a collection; answers the whole list after. */
export const addStory = async (projectId: string, title: string): Promise<Answer<StoryChoice[]>> => {
  const said = await ask<{ stories?: StoryChoice[] }>(`/api/notes/projects/${encodeURIComponent(projectId)}/stories`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  return said.ok ? ok(said.data.stories ?? []) : said;
};

/**
 * Send notes, as the documented route takes them.
 *
 * `captureUploadBatchSchema` is the one definition of what a phone may send,
 * and it is the **domain's** — so this app cannot invent a field, and a note
 * from here is indistinguishable at the desk from one typed in the browser.
 */
/** What a send answers: the notes that landed, and any the server would not take, with why. */
export interface SendAnswer {
  accepted: string[];
  refused?: { clientCaptureId: string | null; reason: string }[];
}

export const sendNotes = async (notes: unknown[]): Promise<Answer<SendAnswer>> =>
  ask<SendAnswer>('/api/notes', {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });

export const listNotes = async (projectId: string | null): Promise<Answer<CaptureItem[]>> => {
  const said = await ask<{ notes?: CaptureItem[] }>(
    `/api/notes${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`,
  );
  return said.ok ? ok(said.data.notes ?? []) : said;
};

export const correctNote = async (
  noteId: string,
  change: { rawText?: string; category?: string | null; subjectName?: string | null },
): Promise<Answer<{ changed: boolean }>> =>
  ask(`/api/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify(change) });

export const forgetNote = async (noteId: string): Promise<Answer<{ deleted: boolean }>> =>
  ask(`/api/notes/${noteId}`, { method: 'DELETE' });

/**
 * Delete notes the desk has already transferred (addendum 27 §25, from Ken:
 * *once the notes are transferred and verified, it'll give you the option to
 * delete those notes*). The same route the desk's archive uses.
 */
export const deleteNotes = async (ids: string[]): Promise<Answer<{ deleted: number }>> =>
  ask('/api/notes/inbox', { method: 'DELETE', body: JSON.stringify({ ids }) });

/**
 * Clear transferred notes off this phone (addendum 27 §29): they stay on the
 * account, in the desk's archive, which is the backup.
 */
export const clearNotes = async (ids: string[]): Promise<Answer<{ cleared: number }>> =>
  ask('/api/notes/cleared', { method: 'POST', body: JSON.stringify({ ids }) });

/**
 * Delete the account this phone is signed into (addendum 27 §12).
 *
 * **In the app rather than at a link to the website**, which is what the App
 * Store asks for and is also the only honest arrangement: an app that can
 * write your notes to a server and cannot take them off it is asking you to
 * go and find another device to be believed on.
 *
 * It is the same route the account page presses, which is the whole reason §2
 * made `currentUser()` read a bearer token — one answer to *what does deleting
 * mean* rather than a shorter one for the phone.
 */
export const deleteAccount = async (confirm: string): Promise<Answer<{ deleted: boolean }>> =>
  ask('/api/account/delete', { method: 'POST', body: JSON.stringify({ confirm }) });

/**
 * Where this account stands with the subscription (addendum 27 §14).
 *
 * Every field on it is a reading of `notesPlan` on the server, so the app holds
 * no copy of the rule: what the line says, whether to offer the purchase and
 * whether a note may be sent are one answer, and a screen cannot disagree with
 * the route that refuses it.
 */
export interface NotesStanding {
  plan: NotesPlan;
  said: string;
  mayCapture: boolean;
  mayOffer: boolean;
  refusal: string | null;
}

export const notesStanding = async (): Promise<Answer<NotesStanding>> =>
  ask<NotesStanding>('/api/notes/plan');

/**
 * Hand a receipt to the server and be told what it was.
 *
 * **One route for a purchase, a restore and a renewal**, because they are one
 * act: a receipt identifier the server takes to the shop. The payload carries
 * nothing else — no state, no expiry, no plan — so this app cannot claim an
 * entitlement it has not been granted.
 */
export const recordPurchase = async (input: {
  store: 'app_store' | 'play_store';
  receiptId: string;
}): Promise<Answer<{ said: string; mayCapture: boolean }>> =>
  ask('/api/notes/purchase', { method: 'POST', body: JSON.stringify(input) });
