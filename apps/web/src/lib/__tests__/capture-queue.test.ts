import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  allCaptures,
  enqueue,
  forget,
  markFailed,
  markSynced,
  newClientCaptureId,
  pendingCaptures,
  pruneSynced,
  type QueuedCapture,
} from '../capture-queue';

/**
 * The offline queue is the part of VC Writer Notes that must not fail: §11 asks
 * that ideas are not lost when connectivity is poor, so a capture is on the
 * device before any send is attempted and stays there until the server has
 * acknowledged it.
 */

const capture = (overrides: Partial<QueuedCapture> = {}): QueuedCapture => ({
  clientCaptureId: newClientCaptureId(),
  projectId: null,
  rawText: 'The keeper never says what happened to the previous one.',
  source: 'mobile_text',
  capturedAt: new Date().toISOString(),
  requestedRouting: { kind: 'research', categoryKey: 'ideas' },
  syncedAt: null,
  lastError: null,
  attempts: 0,
  ...overrides,
});

beforeEach(async () => {
  for (const existing of await allCaptures()) await forget(existing.clientCaptureId);
});

describe('offline capture queue', () => {
  it('keeps a capture until the server acknowledges it', async () => {
    const item = capture();
    await enqueue(item);

    expect(await pendingCaptures()).toHaveLength(1);

    await markSynced(item.clientCaptureId);

    expect(await pendingCaptures()).toHaveLength(0);
    // Still on the device, so the interface can show that it landed.
    expect(await allCaptures()).toHaveLength(1);
  });

  it('keeps a capture that failed to send, and counts the attempt', async () => {
    const item = capture();
    await enqueue(item);

    await markFailed(item.clientCaptureId, 'Network request failed');

    const [stored] = await pendingCaptures();
    expect(stored?.rawText).toBe(item.rawText);
    expect(stored?.lastError).toBe('Network request failed');
    expect(stored?.attempts).toBe(1);
  });

  it('does not duplicate a capture when the same one is written twice', async () => {
    const item = capture();
    await enqueue(item);
    await enqueue({ ...item, rawText: 'Edited before sending' });

    const stored = await allCaptures();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.rawText).toBe('Edited before sending');
  });

  it('returns the newest capture first', async () => {
    await enqueue(capture({ rawText: 'older', capturedAt: '2026-01-01T00:00:00.000Z' }));
    await enqueue(capture({ rawText: 'newer', capturedAt: '2026-02-01T00:00:00.000Z' }));

    expect((await allCaptures()).map((entry) => entry.rawText)).toEqual(['newer', 'older']);
  });

  it('prunes synced captures once the server has held them a while, and nothing else', async () => {
    const old = capture({ rawText: 'sent yesterday' });
    const waiting = capture({ rawText: 'still waiting' });
    await enqueue({ ...old, syncedAt: '2026-01-01T00:00:00.000Z' });
    await enqueue(waiting);

    await pruneSynced();

    const remaining = await allCaptures();
    expect(remaining.map((entry) => entry.rawText)).toEqual(['still waiting']);
  });

  it('mints identifiers that do not collide', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newClientCaptureId()));
    expect(ids.size).toBe(500);
  });
});
