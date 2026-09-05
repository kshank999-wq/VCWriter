'use client';

/**
 * The offline capture queue (spec §11: "offline-tolerant capture queue is
 * strongly preferred so ideas are not lost when connectivity is poor").
 *
 * Every capture is written to IndexedDB *first* and only then sent. That
 * ordering is the whole feature: an idea caught on a train with no signal is on
 * the device, and the send is a retry that can happen whenever. Nothing is
 * removed from the queue until the server has acknowledged it.
 *
 * `clientCaptureId` travels with the row and is unique per user in the
 * database, so retrying a send that actually succeeded cannot create a second
 * copy of the same thought.
 */

const DB_NAME = 'vcwriter-notes';
const DB_VERSION = 1;
const STORE = 'captures';

export interface QueuedCapture {
  clientCaptureId: string;
  projectId: string | null;
  rawText: string;
  source: 'mobile_voice' | 'mobile_text';
  capturedAt: string;
  requestedRouting: { kind: 'research' | 'beat' | 'character'; categoryKey: string | null } | null;
  /** Set once the server has the row; kept briefly so the UI can show it landed. */
  syncedAt: string | null;
  lastError: string | null;
  attempts: number;
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientCaptureId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'));
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Capture queue write failed'));
    transaction.oncomplete = () => db.close();
  });
};

export const newClientCaptureId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const enqueue = async (capture: QueuedCapture): Promise<void> => {
  await withStore('readwrite', (store) => store.put(capture) as IDBRequest<IDBValidKey>);
};

export const allCaptures = async (): Promise<QueuedCapture[]> => {
  const rows = await withStore('readonly', (store) => store.getAll() as IDBRequest<QueuedCapture[]>);
  return rows.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
};

export const pendingCaptures = async (): Promise<QueuedCapture[]> =>
  (await allCaptures()).filter((capture) => capture.syncedAt === null);

export const markSynced = async (clientCaptureId: string): Promise<void> => {
  const existing = await withStore(
    'readonly',
    (store) => store.get(clientCaptureId) as IDBRequest<QueuedCapture | undefined>,
  );
  if (!existing) return;
  await enqueue({ ...existing, syncedAt: new Date().toISOString(), lastError: null });
};

export const markFailed = async (clientCaptureId: string, message: string): Promise<void> => {
  const existing = await withStore(
    'readonly',
    (store) => store.get(clientCaptureId) as IDBRequest<QueuedCapture | undefined>,
  );
  if (!existing) return;
  await enqueue({ ...existing, lastError: message, attempts: existing.attempts + 1 });
};

export const forget = async (clientCaptureId: string): Promise<void> => {
  await withStore('readwrite', (store) => store.delete(clientCaptureId) as IDBRequest<undefined>);
};

/** Drop synced captures older than a day; the server holds them now. */
export const pruneSynced = async (olderThanMs = 24 * 60 * 60 * 1000): Promise<void> => {
  const cutoff = Date.now() - olderThanMs;
  for (const capture of await allCaptures()) {
    if (capture.syncedAt && Date.parse(capture.syncedAt) < cutoff) await forget(capture.clientCaptureId);
  }
};
