import { app, safeStorage } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import {
  SYNC_TABLES,
  captureFromRow,
  captureReviewToRow,
  fromRows,
  mergeProjects,
  parseProjectFile,
  projectToRow,
  toRows,
  type CaptureItem,
  type MergeResult,
  type ProjectFile,
  type Row,
  type SceneVerdict,
} from '@vcwriter/domain';

/**
 * The desktop's connection to Supabase: sign-in, project sync and the capture
 * queue (spec §11, §12.1, §14).
 *
 * All of it lives in the main process. The renderer never holds a session
 * token or a service key — it asks for a sync and gets a merged project back.
 *
 * Sync is optional. A writer who never signs in has a completely working
 * desktop application whose projects live in files; nothing here is on the
 * path between typing and saving.
 */

const SUPABASE_URL = process.env['MAIN_VITE_SUPABASE_URL'] ?? '';
const SUPABASE_ANON_KEY = process.env['MAIN_VITE_SUPABASE_ANON_KEY'] ?? '';

export class CloudError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudError';
  }
}

export const isCloudConfigured = (): boolean => SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

let client: SupabaseClient | null = null;

const supabase = (): SupabaseClient => {
  if (!isCloudConfigured()) {
    throw new CloudError(
      'Sync is not configured in this build. Set MAIN_VITE_SUPABASE_URL and MAIN_VITE_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
};

// ---------------------------------------------------------------------------
// Session storage
// ---------------------------------------------------------------------------

const sessionPath = () => join(app.getPath('userData'), 'session.bin');
const syncStatePath = () => join(app.getPath('userData'), 'sync-state.json');

/**
 * The refresh token is a credential, so it is encrypted with the OS keychain
 * where one is available (Keychain on macOS, DPAPI on Windows) rather than
 * left readable on disk.
 */
const storeSession = async (session: Session | null): Promise<void> => {
  if (!session) {
    await writeFile(sessionPath(), '', 'utf8').catch(() => undefined);
    return;
  }
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  await mkdir(app.getPath('userData'), { recursive: true });
  if (safeStorage.isEncryptionAvailable()) {
    await writeFile(sessionPath(), safeStorage.encryptString(payload));
  } else {
    // No keychain: write it, but mark it so a later run knows it is unprotected.
    await writeFile(sessionPath(), `plain:${payload}`, 'utf8');
  }
};

const readStoredSession = async (): Promise<{ access_token: string; refresh_token: string } | null> => {
  try {
    const raw = await readFile(sessionPath());
    if (raw.length === 0) return null;
    const text = raw.toString('utf8');
    const payload = text.startsWith('plain:')
      ? text.slice('plain:'.length)
      : safeStorage.decryptString(raw);
    return JSON.parse(payload) as { access_token: string; refresh_token: string };
  } catch {
    return null;
  }
};

export interface AccountStatus {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
}

export const restoreSession = async (): Promise<AccountStatus> => {
  if (!isCloudConfigured()) return { configured: false, signedIn: false, email: null };
  const stored = await readStoredSession();
  if (!stored) return { configured: true, signedIn: false, email: null };

  const { data, error } = await supabase().auth.setSession(stored);
  if (error || !data.session) return { configured: true, signedIn: false, email: null };
  await storeSession(data.session);
  return { configured: true, signedIn: true, email: data.session.user.email ?? null };
};

export const accountStatus = async (): Promise<AccountStatus> => {
  if (!isCloudConfigured()) return { configured: false, signedIn: false, email: null };
  const { data } = await supabase().auth.getUser();
  return { configured: true, signedIn: Boolean(data.user), email: data.user?.email ?? null };
};

/** Step one of sign-in: Supabase emails a six-digit code. */
export const requestSignInCode = async (email: string): Promise<void> => {
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw new CloudError(error.message);
};

/** Step two: the code goes straight into the app — no browser round trip. */
export const verifySignInCode = async (email: string, token: string): Promise<AccountStatus> => {
  const { data, error } = await supabase().auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new CloudError(error.message);
  if (!data.session) throw new CloudError('That code was accepted but no session came back. Try again.');
  await storeSession(data.session);
  return { configured: true, signedIn: true, email: data.session.user.email ?? null };
};

export const signOut = async (): Promise<void> => {
  if (isCloudConfigured()) await supabase().auth.signOut().catch(() => undefined);
  await storeSession(null);
};

// ---------------------------------------------------------------------------
// Sync state
// ---------------------------------------------------------------------------

type SyncStateFile = Record<string, { lastSyncedAt: string | null }>;

const readSyncState = async (): Promise<SyncStateFile> => {
  try {
    return JSON.parse(await readFile(syncStatePath(), 'utf8')) as SyncStateFile;
  } catch {
    return {};
  }
};

const writeSyncState = async (projectId: string, lastSyncedAt: string): Promise<void> => {
  const state = await readSyncState();
  state[projectId] = { lastSyncedAt };
  await writeFile(syncStatePath(), JSON.stringify(state, null, 2), 'utf8').catch(() => undefined);
};

// ---------------------------------------------------------------------------
// Project sync
// ---------------------------------------------------------------------------

const requireUserId = async (): Promise<string> => {
  const { data, error } = await supabase().auth.getUser();
  if (error || !data.user) throw new CloudError('Sign in to sync this project.');
  return data.user.id;
};

const pullRows = async (projectId: string): Promise<ProjectFile | null> => {
  const db = supabase();
  const { data: projectRow, error } = await db.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (error) throw new CloudError(error.message);
  if (!projectRow) return null;

  const collections = await Promise.all(
    Object.entries(SYNC_TABLES).map(async ([key, table]) => {
      const { data, error: readError } = await db.from(table).select('*').eq('project_id', projectId);
      if (readError) throw new CloudError(readError.message);
      return [key, (data ?? []) as Row[]] as const;
    }),
  );

  const rows = Object.fromEntries(collections) as Record<string, Row[]>;
  return fromRows({
    project: projectRow as Row,
    lanes: rows['lanes'] ?? [],
    units: rows['units'] ?? [],
    beats: rows['beats'] ?? [],
    researchCategories: rows['researchCategories'] ?? [],
    researchItems: rows['researchItems'] ?? [],
    characters: rows['characters'] ?? [],
    links: rows['links'] ?? [],
    setupsPayoffs: rows['setupsPayoffs'] ?? [],
  });
};

const pushRows = async (file: ProjectFile, remote: ProjectFile | null): Promise<void> => {
  const db = supabase();
  const rows = toRows(file);

  const { error: projectError } = await db.from('projects').upsert(rows.project);
  if (projectError) throw new CloudError(projectError.message);

  for (const [key, table] of Object.entries(SYNC_TABLES)) {
    const collection = rows[key as keyof typeof SYNC_TABLES] as Row[];
    if (collection.length > 0) {
      const { error } = await db.from(table).upsert(collection);
      if (error) throw new CloudError(error.message);
    }

    // Rows the merge dropped have to go from the server too, or the next pull
    // brings them straight back.
    const keep = new Set(collection.map((row) => row['id'] as string));
    const stale = (remote?.[key as keyof typeof SYNC_TABLES] as { id: string }[] | undefined)?.filter(
      (record) => !keep.has(record.id),
    );
    if (stale && stale.length > 0) {
      const { error } = await db
        .from(table)
        .delete()
        .in('id', stale.map((record) => record.id));
      if (error) throw new CloudError(error.message);
    }
  }
};

export interface SyncOutcome {
  merged: ProjectFile;
  conflicts: MergeResult['conflicts'];
  summary: MergeResult['summary'];
  syncedAt: string;
}

/**
 * One round trip: pull what the cloud has, merge it with what is here, push the
 * result. The merge rules — including that an edit beats a delete — live in the
 * domain and are tested there.
 */
export const syncProject = async (input: { file: unknown }): Promise<SyncOutcome> => {
  const local = parseProjectFile(input.file);
  const userId = await requireUserId();

  const owned: ProjectFile = {
    ...local,
    project: { ...local.project, ownerId: local.project.ownerId ?? (userId as ProjectFile['project']['ownerId']) },
  };

  const remote = await pullRows(owned.project.id);
  const state = await readSyncState();
  const lastSyncedAt = state[owned.project.id]?.lastSyncedAt ?? null;

  const result: MergeResult = remote
    ? mergeProjects(owned, remote, { lastSyncedAt })
    : { merged: owned, conflicts: [], summary: { pulled: 0, pushed: 0, deletedLocally: 0, revivedByEdit: 0 } };

  await pushRows(result.merged, remote);

  const syncedAt = new Date().toISOString();
  await writeSyncState(owned.project.id, syncedAt);

  return { merged: result.merged, conflicts: result.conflicts, summary: result.summary, syncedAt };
};

// ---------------------------------------------------------------------------
// AI structural read (spec §8.2)
// ---------------------------------------------------------------------------

const SITE_URL = process.env['MAIN_VITE_SITE_URL'] ?? 'https://vc-writer.com';

/**
 * Ask the Final Editor's AI pass to read one scene.
 *
 * The request goes to vc-writer.com, not to a model vendor: the API key lives
 * on the server, where it can be rotated and metered, instead of inside every
 * installed copy of the application. The desktop sends the writer's session
 * token and the scene text — nothing else about the project leaves the
 * machine.
 */
export const requestSceneReview = async (input: {
  sceneText: string;
  position?: string;
  format: 'screenplay' | 'prose';
}): Promise<SceneVerdict> => {
  const { data, error } = await supabase().auth.getSession();
  if (error || !data.session) throw new CloudError('Sign in to use the Final Editor.');

  const response = await fetch(`${SITE_URL}/api/ai/scene-review`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { verdict?: Omit<SceneVerdict, 'model'> & { model: string }; error?: string }
    | null;

  if (!response.ok || !payload?.verdict) {
    throw new CloudError(payload?.error ?? `The structural read failed (${response.status})`);
  }
  return payload.verdict;
};

// ---------------------------------------------------------------------------
// Capture queue
// ---------------------------------------------------------------------------

/** Captures waiting for a decision, newest first. */
export const listCaptures = async (projectId: string | null): Promise<CaptureItem[]> => {
  const userId = await requireUserId();
  let query = supabase()
    .from('capture_items')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'needs_review'])
    .order('captured_at', { ascending: false })
    .limit(200);

  // Captures with no project belong to whichever project is open: the writer
  // had not decided yet, and this is where they decide.
  if (projectId) query = query.or(`project_id.eq.${projectId},project_id.is.null`);

  const { data, error } = await query;
  if (error) throw new CloudError(error.message);
  return (data ?? []).map((row) => captureFromRow(row as Row));
};

/**
 * Record a review decision. The project change itself is made in the renderer
 * with the domain functions; this only writes back the outcome — and never
 * touches `raw_text`, so a wrong call can be read back and redone (§9).
 */
export const resolveCapture = async (capture: CaptureItem): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase()
    .from('capture_items')
    .update(captureReviewToRow(capture))
    .eq('id', capture.id)
    .eq('user_id', userId);
  if (error) throw new CloudError(error.message);
};
