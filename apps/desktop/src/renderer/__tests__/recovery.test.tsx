// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addLane,
  addUnit,
  createProjectFile,
  lanesInOrder,
  mergeProjects,
  projectFileSchema,
  unitsForLane,
  updateBeat,
  type ProjectFile,
  type SyncConflict,
} from '@vcwriter/domain';
import { StructureBoard } from '../components/StructureBoard';
import { RecoveryPanel } from '../components/RecoveryPanel';

/**
 * Phase 8 hardening: the two promises in §15 that a reviewer cannot check by
 * reading the code — that a keyboard alone can reorder the board, and that
 * work a sync overwrote can be got back.
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

describe('reordering the structure board with a keyboard', () => {
  const twoLanes = (): ProjectFile => addLane(createProjectFile({ title: 'Lighthouse', format: 'screenplay' }), { name: 'Subplot' }).file;

  /** Lane names in the order they are drawn. */
  const laneNames = () =>
    screen
      .getAllByLabelText(/^Lane name: /)
      .map((element) => (element.getAttribute('aria-label') ?? '').replace('Lane name: ', ''));

  const board = (initial: ProjectFile) =>
    render(
      <Harness initial={initial}>
        {(file, update) => (
          <StructureBoard file={file} selectedBeatId={null} onSelectBeat={() => undefined} onUpdate={update} />
        )}
      </Harness>,
    );

  it('moves a lane down with Alt and an arrow', () => {
    // Until this existed, reordering — the board's whole point — could only be
    // done by dragging, which a keyboard user cannot do at all.
    const initial = twoLanes();
    expect(lanesInOrder(initial).map((lane) => lane.name)).toEqual(['Main Plot', 'Subplot']);

    board(initial);
    const grip = screen.getByLabelText(/Reorder lane Main Plot/i);
    fireEvent.keyDown(grip, { key: 'ArrowDown', altKey: true });

    const names = laneNames();
    expect(names).toEqual(['Subplot', 'Main Plot']);
  });

  it('does nothing at the ends of the list', () => {
    board(twoLanes());
    fireEvent.keyDown(screen.getByLabelText(/Reorder lane Main Plot/i), { key: 'ArrowUp', altKey: true });

    const names = laneNames();
    expect(names).toEqual(['Main Plot', 'Subplot']);
  });

  it('ignores an arrow without Alt, so arrowing around the board is still just navigation', () => {
    board(twoLanes());
    fireEvent.keyDown(screen.getByLabelText(/Reorder lane Main Plot/i), { key: 'ArrowDown' });

    const names = laneNames();
    expect(names).toEqual(['Main Plot', 'Subplot']);
  });

  it('moves a scene between lanes with Alt+Shift', () => {
    const initial = twoLanes();
    const subplot = lanesInOrder(initial)[1]!;
    expect(unitsForLane(initial, subplot.id)).toHaveLength(0);

    board(initial);
    const grip = screen.getAllByLabelText(/Reorder .*Opening/i)[0]!;
    fireEvent.keyDown(grip, { key: 'ArrowDown', altKey: true, shiftKey: true });

    // The scene now sits under the second lane: its beat moved with it.
    expect(screen.getByText('Subplot')).toBeDefined();
    expect(screen.getAllByText(/No scenes in this lane/i)).toHaveLength(1);
  });
});

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
