// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  createProjectFile,
  mergeProjects,
  projectFileSchema,
  updateBeat,
  type ProjectFile,
  type SyncConflict,
} from '@vcwriter/domain';
import { RecoveryPanel } from '../components/RecoveryPanel';

/**
 * Phase 8 hardening: the promise in §15 that a reviewer cannot check by
 * reading the code — that work a sync overwrote can be got back. (Keyboard
 * reordering of the timeline is covered in timeline.test.tsx.)
 */

afterEach(cleanup);

function Harness({
  initial,
  children,
}: {
  initial: ProjectFile;
  children: (file: ProjectFile, update: (mutate: (current: ProjectFile) => ProjectFile) => void) => React.ReactNode;
}) {
  const [file, setFile] = useState(initial);
  return <>{children(file, (mutate) => setFile((current) => mutate(current)))}</>;
}

describe('recovering what a sync overwrote', () => {
  const conflicted = (): { merged: ProjectFile; conflicts: SyncConflict[] } => {
    const base = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    const settled = projectFileSchema.parse({
      ...base,
      beats: base.beats.map((beat) => ({ ...beat, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })),
    });

    const local = projectFileSchema.parse({
      ...updateBeat(settled, settled.beats[0]!.id, { summary: 'The desk version of the scene.' }),
      beats: settled.beats.map((beat) => ({ ...beat, summary: 'The desk version of the scene.', updatedAt: '2026-07-01T00:00:00.000Z' })),
    });
    const remote = projectFileSchema.parse({
      ...settled,
      beats: settled.beats.map((beat) => ({ ...beat, summary: 'The phone version of the scene.', updatedAt: '2026-08-01T00:00:00.000Z' })),
    });

    const result = mergeProjects(local, remote, { lastSyncedAt: '2026-06-01T00:00:00.000Z' });
    return { merged: result.merged, conflicts: result.conflicts };
  };

  beforeEach(() => {
    // The panel lists snapshots on mount; the conflict half is what matters here.
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      listSnapshots: vi.fn().mockResolvedValue({ ok: true, data: [] }),
      restoreSnapshot: vi.fn(),
    };
  });

  it('shows the text that was overwritten and puts it back', () => {
    const { merged, conflicts } = conflicted();
    expect(conflicts).toHaveLength(1);
    expect(merged.beats[0]?.summary).toBe('The phone version of the scene.');

    let restored: ProjectFile | null = null;
    render(
      <RecoveryPanel
        file={merged}
        path="/tmp/lighthouse.vcw"
        conflicts={conflicts}
        onRestoreVersion={(next) => {
          restored = next;
        }}
        onRestoreSnapshot={() => undefined}
        onConflictResolved={() => undefined}
      />,
    );

    // The writer can read what they lost before deciding.
    fireEvent.click(screen.getByText(/Show what was overwritten/i));
    expect(screen.getByText('The desk version of the scene.')).toBeDefined();

    fireEvent.click(screen.getByText(/Put that version back/i));
    expect(restored).not.toBeNull();
    expect(restored!.beats[0]?.summary).toBe('The desk version of the scene.');
  });

  it('says so rather than pretending when the scene is gone', () => {
    const { merged, conflicts } = conflicted();
    const orphaned = projectFileSchema.parse({ ...merged, units: [], beats: [] });

    render(
      <RecoveryPanel
        file={orphaned}
        path="/tmp/lighthouse.vcw"
        conflicts={conflicts}
        onRestoreVersion={() => {
          throw new Error('must not restore an orphan');
        }}
        onRestoreSnapshot={() => undefined}
        onConflictResolved={() => undefined}
      />,
    );

    fireEvent.click(screen.getByText(/Put that version back/i));
    expect(screen.getByRole('alert').textContent).toMatch(/scene it belonged to is gone/i);
  });
});
