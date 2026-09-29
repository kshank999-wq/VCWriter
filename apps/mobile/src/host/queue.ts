import * as SQLite from 'expo-sqlite';
import { sendNotes } from './api';

/**
 * The offline capture queue, on a phone (addendum 27 §4).
 *
 * **The same interface the web app has, on the storage a phone has.** The
 * browser's queue is IndexedDB and this is SQLite, and the ordering that is the
 * whole feature is identical: a note is **written down before it is sent**, so
 * a thought caught on a walk with no signal is on the device and the send is a
 * retry that happens whenever. Nothing leaves the queue until the server has
 * acknowledged it.
 *
 * It is a **rewrite rather than a port** for one honest reason: `capture-queue.ts`
 * is `indexedDB` from its first line to its last, which does not exist here.
 * What is shared is the thing worth sharing — `QueuedCapture`'s shape and
 * `client_capture_id`'s promise, which is unique per user in the database, so
 * retrying a send that actually worked cannot make a second copy of one
 * thought.
 *
 * And addendum 09 §13's lesson is built in rather than remembered: **`file`
 * writes down and then sends**, because a queue nothing flushes is a drawer.
 */

export interface QueuedCapture {
  clientCaptureId: string;
  projectId: string | null;
  rawText: string;
  source: 'mobile_voice' | 'mobile_text';
  capturedAt: string;
  category: string | null;
  subjectName: string | null;
  subcategory: string | null;
  /** Set once the server has the row; kept briefly so the screen can show it landed. */
  syncedAt: string | null;
  lastError: string | null;
  attempts: number;
}

let db: SQLite.SQLiteDatabase | null = null;

const open = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('vcwriter-notes.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS captures (
      client_capture_id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT,
      raw_text TEXT NOT NULL,
      source TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      category TEXT,
      subject_name TEXT,
      subcategory TEXT,
      synced_at TEXT,
      last_error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0
    );
  `);
  return db;
};

interface Row {
  client_capture_id: string;
  project_id: string | null;
  raw_text: string;
  source: string;
  captured_at: string;
  category: string | null;
  subject_name: string | null;
  subcategory: string | null;
  synced_at: string | null;
  last_error: string | null;
  attempts: number;
}

const fromRow = (row: Row): QueuedCapture => ({
  clientCaptureId: row.client_capture_id,
  projectId: row.project_id,
  rawText: row.raw_text,
  source: row.source === 'mobile_text' ? 'mobile_text' : 'mobile_voice',
  capturedAt: row.captured_at,
  category: row.category,
  subjectName: row.subject_name,
  subcategory: row.subcategory,
  syncedAt: row.synced_at,
  lastError: row.last_error,
  attempts: row.attempts,
});

export const newClientCaptureId = (): string =>
  // React Native has had `crypto.randomUUID` since 0.74; the fallback is for
  // anything older and for the test runner, and it is still unique per user
  // per device, which is all the database asks of it.
  crypto?.randomUUID?.() ?? `capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const enqueue = async (capture: QueuedCapture): Promise<void> => {
  const database = await open();
  await database.runAsync(
    `INSERT INTO captures
       (client_capture_id, project_id, raw_text, source, captured_at,
        category, subject_name, subcategory, synced_at, last_error, attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_capture_id) DO UPDATE SET
       raw_text = excluded.raw_text,
       category = excluded.category,
       subject_name = excluded.subject_name,
       subcategory = excluded.subcategory,
       synced_at = excluded.synced_at,
       last_error = excluded.last_error,
       attempts = excluded.attempts`,
    [
      capture.clientCaptureId,
      capture.projectId,
      capture.rawText,
      capture.source,
      capture.capturedAt,
      capture.category,
      capture.subjectName,
      capture.subcategory,
      capture.syncedAt,
      capture.lastError,
      capture.attempts,
    ],
  );
};

export const allCaptures = async (): Promise<QueuedCapture[]> => {
  const database = await open();
  const rows = await database.getAllAsync<Row>(
    'SELECT * FROM captures ORDER BY captured_at DESC',
  );
  return rows.map(fromRow);
};

export const pendingCaptures = async (): Promise<QueuedCapture[]> => {
  const database = await open();
  const rows = await database.getAllAsync<Row>(
    'SELECT * FROM captures WHERE synced_at IS NULL ORDER BY captured_at DESC',
  );
  return rows.map(fromRow);
};

export const forget = async (clientCaptureId: string): Promise<void> => {
  const database = await open();
  await database.runAsync('DELETE FROM captures WHERE client_capture_id = ?', [clientCaptureId]);
};

/** Drop what the server has had for a day; it holds them now. */
export const pruneSynced = async (olderThanMs = 24 * 60 * 60 * 1000): Promise<void> => {
  const database = await open();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  await database.runAsync('DELETE FROM captures WHERE synced_at IS NOT NULL AND synced_at < ?', [
    cutoff,
  ]);
};

/**
 * What the route takes, built from what the queue holds.
 *
 * Deliberately the row and nothing more: `captureUploadBatchSchema` has no
 * field for a status, an inference or what a note became, so an app that tried
 * to set one would have nowhere to put it — *the shape is the permission*
 * (addendum 09 §7), and this app inherits it rather than restating it.
 */
const forUpload = (capture: QueuedCapture) => ({
  clientCaptureId: capture.clientCaptureId,
  projectId: capture.projectId,
  rawText: capture.rawText,
  source: capture.source,
  capturedAt: capture.capturedAt,
  requestedRouting: null,
  category: capture.category,
  subjectName: capture.subjectName,
  subcategory: capture.subcategory,
});

/**
 * Push everything still waiting. Safe to call as often as you like.
 *
 * Returns what stopped it, or null. **A failure is not a loss**: the rows stay
 * exactly where they are with the reason on them, which is what the queue is
 * for and why this may be called on a timer, on reconnecting, or after every
 * single note without anybody having to think about it.
 */
export const flush = async (): Promise<string | null> => {
  const waiting = await pendingCaptures();
  if (waiting.length === 0) return null;

  const said = await sendNotes(waiting.map(forUpload));
  const database = await open();

  if (!said.ok) {
    await database.runAsync(
      `UPDATE captures SET last_error = ?, attempts = attempts + 1 WHERE synced_at IS NULL`,
      [said.error],
    );
    return said.error;
  }

  // **Exactly the ones that landed**, which is what the route answers with —
  // marking the whole batch on a partial accept is how a note is lost while
  // the screen says it was sent.
  const landed = new Set(said.data.accepted ?? []);
  const now = new Date().toISOString();
  for (const capture of waiting) {
    if (!landed.has(capture.clientCaptureId)) continue;
    await database.runAsync(
      'UPDATE captures SET synced_at = ?, last_error = NULL WHERE client_capture_id = ?',
      [now, capture.clientCaptureId],
    );
  }
  await pruneSynced();
  return null;
};

/**
 * One note, **written down and then sent**.
 *
 * Addendum 09 §13 is why this is one function rather than two calls every
 * caller has to remember: the typed screen did `enqueue` then `flush` and the
 * hands-free path did only the first, so a whole walk sat on the phone while
 * the screen said *Saved*. Here there is no way to do half of it.
 */
export const file = async (capture: QueuedCapture): Promise<string | null> => {
  await enqueue(capture);
  return flush();
};
