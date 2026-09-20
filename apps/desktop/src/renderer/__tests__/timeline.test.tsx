// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addTrack,
  addSetupPayoff,
  addSetupPoint,
  addBeat,
  addUnit,
  beatsForUnit,
  beatsInStoryOrder,
  createProjectFile,
  tracksInOrder,
  recordPayoff,
  ref,
  setRowFrame,
  updateBeat,
  updateUnit,
  unitsForTrack,
  unitsInStoryOrder,
  type BeatId,
  type ProjectFile,
} from '@vcwriter/domain';
import { MasterTimeline } from '../components/MasterTimeline';
import { Inspector } from '../components/Inspector';
import { MasterPanel } from '../components/MasterPanel';

/**
 * The master timeline and the windows under it (addendum 02 §4, §6, §7):
 * what a reviewer cannot check by reading — that the tracks draw, that the
 * keyboard alone reorders, that the links track shows a promise kept and one
 * outstanding, and that the inspector writes through to the same document.
 */

afterEach(cleanup);

function Harness({
  initial,
  children,
}: {
  initial: ProjectFile;
  children: (
    file: ProjectFile,
    update: (mutate: (current: ProjectFile) => ProjectFile) => void,
    selected: BeatId | null,
    select: (id: BeatId) => void,
  ) => React.ReactNode;
}) {
  const [file, setFile] = useState(initial);
  const [selected, setSelected] = useState<BeatId | null>(beatsInStoryOrder(initial)[0]?.id ?? null);
  return <>{children(file, (mutate) => setFile((current) => mutate(current)), selected, setSelected)}</>;
}

const timeline = (initial: ProjectFile, extra: Partial<React.ComponentProps<typeof MasterTimeline>> = {}) =>
  render(
    <Harness initial={initial}>
      {(file, update, selected, select) => (
        <MasterTimeline
          file={file}
          selectedBeatId={selected}
          onSelectBeat={select}
          onUpdate={update}
          pixelsPerPage={120}
          onZoom={() => undefined}
          inspectorOpen
          onToggleInspector={() => undefined}
          onAddScene={() => undefined}
          onAddBeat={() => undefined}
          onAddTrack={() => undefined}
          onAddAct={() => undefined}
          onOpenTrack={() => undefined}
          {...extra}
        />
      )}
    </Harness>,
  );

const twoTracks = (): ProjectFile =>
  addTrack(createProjectFile({ title: 'Lighthouse', format: 'screenplay' }), { name: 'Subplot' }).file;

const trackNames = () =>
  screen.getAllByLabelText(/^Track name: /).map((element) => (element.getAttribute('aria-label') ?? '').replace('Track name: ', ''));

describe('master timeline', () => {
  it('draws a track per track with the scene blocks and beats in them', () => {
    timeline(twoTracks());
    expect(trackNames()).toEqual(['Main Plot', 'Subplot']);
    expect(screen.getByText('Opening Scene')).toBeDefined();
    expect(screen.getByText('Opening beat')).toBeDefined();
    expect(screen.getByText('Pages · time')).toBeDefined();
    expect(screen.getByText('Links')).toBeDefined();

    fireEvent.click(screen.getByTitle('Add beat'));
    expect(screen.getByText('New beat')).toBeDefined();
  });

  it('moves a track down with Alt and an arrow, and not without Alt', () => {
    timeline(twoTracks());
    fireEvent.keyDown(screen.getByLabelText(/Reorder track Main Plot/i), { key: 'ArrowDown' });
    expect(trackNames()).toEqual(['Main Plot', 'Subplot']);

    fireEvent.keyDown(screen.getByLabelText(/Reorder track Main Plot/i), { key: 'ArrowDown', altKey: true });
    expect(trackNames()).toEqual(['Subplot', 'Main Plot']);
  });

  it('moves a scene later in the story with Alt+↓ and to the next track with Alt+Shift+↓', () => {
    let initial = twoTracks();
    const main = initial.tracks[0]!;
    initial = addUnit(initial, { trackId: main.id, title: 'Second scene' }).file;
    expect(unitsInStoryOrder(initial).map((unit) => unit.title)).toEqual(['Opening Scene', 'Second scene']);

    let latest: ProjectFile = initial;
    render(
      <Harness initial={initial}>
        {(file, update, selected, select) => {
          latest = file;
          return (
            <MasterTimeline
              file={file}
              selectedBeatId={selected}
              onSelectBeat={select}
              onUpdate={update}
              pixelsPerPage={120}
              onZoom={() => undefined}
              inspectorOpen
              onToggleInspector={() => undefined}
              onAddScene={() => undefined}
              onAddBeat={() => undefined}
              onAddTrack={() => undefined}
              onAddAct={() => undefined}
              onOpenTrack={() => undefined}
            />
          );
        }}
      </Harness>,
    );

    fireEvent.keyDown(screen.getByLabelText(/Reorder Opening Scene/i), { key: 'ArrowDown', altKey: true });
    expect(unitsInStoryOrder(latest).map((unit) => unit.title)).toEqual(['Second scene', 'Opening Scene']);

    fireEvent.keyDown(screen.getByLabelText(/Reorder Opening Scene/i), { key: 'ArrowDown', altKey: true, shiftKey: true });
    const subplot = tracksInOrder(latest)[1]!;
    expect(unitsForTrack(latest, subplot.id).map((unit) => unit.title)).toEqual(['Opening Scene']);
    // The track changed; the story position did not.
    expect(unitsInStoryOrder(latest).map((unit) => unit.title)).toEqual(['Second scene', 'Opening Scene']);
  });

  it('draws a kept promise as a curve to its payoff and an outstanding one into the air', () => {
    let file = twoTracks();
    const first = file.units[0]!;
    const fourth = addUnit(file, { trackId: file.tracks[0]!.id, title: 'Sc 4' });
    file = fourth.file;
    file = addSetupPayoff(file, { title: 'The revolver' });
    file = addSetupPoint(file, { setupPayoffId: file.setupsPayoffs[0]!.id, description: 'Drawer', location: ref('unit', first.id) });
    file = recordPayoff(file, { setupPayoffId: file.setupsPayoffs[0]!.id, description: 'Fired', location: ref('unit', fourth.unit.id) });
    file = addSetupPayoff(file, { title: 'The letter' });
    file = addSetupPoint(file, { setupPayoffId: file.setupsPayoffs[1]!.id, description: 'Arrives', location: ref('unit', first.id) });

    const { container } = timeline(file);
    const arcs = container.querySelectorAll('.links-cell .arc');
    expect(arcs).toHaveLength(2);
    expect(container.querySelector('.arc.setup title')?.textContent).toBe('The revolver');
    expect(container.querySelector('.arc.open title')?.textContent).toMatch(/The letter — not yet paid off/);
  });

  it('puts the playhead on the selected scene and follows a click', () => {
    let file = twoTracks();
    const second = addUnit(file, { trackId: file.tracks[0]!.id, title: 'Second scene' });
    file = second.file;
    const { container } = timeline(file);

    // Two ruler cells; the first is at the playhead because the first beat is selected.
    const cells = container.querySelectorAll('.ruler-cell:not(.tail)');
    expect(cells).toHaveLength(2);
    expect(cells[0]!.className).toContain('playhead');

    // The scene with no beats gets one via its own + beat control; clicking it selects it.
    const block = screen.getByText('Second scene').closest('.block')!;
    fireEvent.click(within(block as HTMLElement).getByTitle('Add beat'));
    fireEvent.click(within(block as HTMLElement).getByText('New beat'));
    expect(container.querySelectorAll('.ruler-cell:not(.tail)')[1]!.className).toContain('playhead');
  });

  /**
   * The right-click on a beat and on a scene (addendum 02 §6a, from Ken):
   * the tools to edit what was pointed at, at the pointer.
   */
  it('splits a scene before a beat from the beat’s right-click, refusing on the first', () => {
    let initial = twoTracks();
    const opening = unitsInStoryOrder(initial)[0]!;
    initial = addBeat(initial, { unitId: opening.id, title: 'Second beat' }).file;
    let latest: ProjectFile = initial;
    render(
      <Harness initial={initial}>
        {(file, update, selected, select) => {
          latest = file;
          return (
            <MasterTimeline file={file} selectedBeatId={selected} onSelectBeat={select} onUpdate={update} pixelsPerPage={120} onZoom={() => undefined} inspectorOpen onToggleInspector={() => undefined} onAddScene={() => undefined} onAddBeat={() => undefined} onAddTrack={() => undefined} onAddAct={() => undefined} onOpenTrack={() => undefined} />
          );
        }}
      </Harness>,
    );
    fireEvent.contextMenu(screen.getByText('Opening beat').closest('li') as HTMLElement, { clientX: 40, clientY: 40 });
    const split = screen.getByRole('menuitem', { name: 'Split the scene before this beat' }) as HTMLButtonElement;
    expect(split.disabled).toBe(true);
    expect(split.title).toMatch(/first beat of the scene already/);
    fireEvent.keyDown(split, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.contextMenu(screen.getByText('Second beat').closest('li') as HTMLElement, { clientX: 40, clientY: 40 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split the scene before this beat' }));
    expect(unitsInStoryOrder(latest)).toHaveLength(2);
    expect(beatsForUnit(latest, unitsInStoryOrder(latest)[1]!.id).map((beat) => beat.title)).toEqual(['Second beat']);
    expect(screen.queryByRole('menu')).toBeNull();

    // The scene's own menu, and its remove.
    fireEvent.contextMenu(screen.getAllByText(/Opening Scene/)[0]!.closest('header') as HTMLElement, { clientX: 40, clientY: 40 });
    expect(screen.getByRole('menuitem', { name: 'Add a beat' })).toBeDefined();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove the scene and its beats' }));
    expect(unitsInStoryOrder(latest)).toHaveLength(1);
  });

  it('makes a scene of a beat dropped past the last scene, or on another track’s empty slot', () => {
    let initial = twoTracks();
    const opening = unitsInStoryOrder(initial)[0]!;
    initial = addBeat(initial, { unitId: opening.id, title: 'Second beat' }).file;
    let latest: ProjectFile = initial;
    render(
      <Harness initial={initial}>
        {(file, update, selected, select) => {
          latest = file;
          return (
            <MasterTimeline file={file} selectedBeatId={selected} onSelectBeat={select} onUpdate={update} pixelsPerPage={120} onZoom={() => undefined} inspectorOpen onToggleInspector={() => undefined} onAddScene={() => undefined} onAddBeat={() => undefined} onAddTrack={() => undefined} onAddAct={() => undefined} onOpenTrack={() => undefined} />
          );
        }}
      </Harness>,
    );
    const beat = screen.getByText('Second beat').closest('li') as HTMLElement;
    fireEvent.dragStart(beat, { dataTransfer: { setData: () => undefined } });
    // While a beat is in the air, the tails say where it may land.
    const tails = document.querySelectorAll('.slot.tail.takes-beat');
    expect(tails).toHaveLength(2);
    expect(tails[0]?.textContent).toBe('+ new scene');
    fireEvent.dragOver(tails[0]!);
    fireEvent.drop(tails[0]!);
    const order = unitsInStoryOrder(latest);
    expect(order).toHaveLength(2);
    expect(order[1]?.trackId).toBe(tracksInOrder(latest)[0]?.id);
    expect(beatsForUnit(latest, order[1]!.id).map((beat) => beat.title)).toEqual(['Second beat']);
    expect(beatsForUnit(latest, order[0]!.id).map((beat) => beat.title)).toEqual(['Opening beat']);

    // Dropped on the subplot's empty slot at the opening scene's position: a scene there, on that track.
    const first = screen.getByText('Opening beat').closest('li') as HTMLElement;
    fireEvent.dragStart(first, { dataTransfer: { setData: () => undefined } });
    const slot = document.querySelector('.slot.takes-beat:not(.tail)') as HTMLElement;
    fireEvent.dragOver(slot);
    fireEvent.drop(slot);
    const after = unitsInStoryOrder(latest);
    expect(after).toHaveLength(3);
    expect(after[0]?.trackId).toBe(tracksInOrder(latest)[1]?.id);
    expect(beatsForUnit(latest, after[0]!.id).map((beat) => beat.title)).toEqual(['Opening beat']);
  });

  it('offers the toolbar actions', () => {
    const onAddScene = vi.fn();
    const onAddAct = vi.fn();
    timeline(twoTracks(), { onAddScene, onAddAct });
    fireEvent.click(screen.getByRole('button', { name: '+ Scene' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Marker' }));
    expect(onAddScene).toHaveBeenCalledTimes(1);
    expect(onAddAct).toHaveBeenCalledTimes(1);
  });
});

describe('inspector', () => {
  it('edits the beat, moves its scene to another track, and starts an act', () => {
    let latest: ProjectFile = twoTracks();
    render(
      <Harness initial={latest}>
        {(file, update, selected) => {
          latest = file;
          return <Inspector file={file} selectedBeatId={selected} onUpdate={update} />;
        }}
      </Harness>,
    );

    fireEvent.change(screen.getByPlaceholderText('What happens in this beat'), { target: { value: 'She arrives' } });
    expect(latest.beats[0]?.title).toBe('She arrives');

    const subplot = tracksInOrder(latest)[1]!;
    fireEvent.change(screen.getByLabelText('Scene track'), { target: { value: subplot.id } });
    expect(latest.units[0]?.trackId).toBe(subplot.id);

    fireEvent.click(screen.getByRole('button', { name: /Start one here/i }));
    expect(latest.markers).toHaveLength(1);
    expect((screen.getByPlaceholderText('Act I') as HTMLInputElement).value).toBe('New act');
  });
});

describe('master panel', () => {
  it('is the Script and nothing around it', () => {
    render(
      <Harness initial={twoTracks()}>
        {(file, update, selected, select) => (
          <MasterPanel
            file={file}
            selectedBeatId={selected}
            onSelectBeat={select}
            onUpdate={update}
            focusMode={false}
            focusTitleBeatId={null}
            onTitleFocused={() => undefined}
            dictationShortcut={null}
          />
        )}
      </Harness>,
    );

    // The Script opens as the finished script: the page, not the scaffolding.
    expect(screen.queryByLabelText('Beat title (not printed)')).toBeNull();
    fireEvent.click(screen.getByLabelText('Page options'));
    fireEvent.click(screen.getByLabelText('Beat names'));
    expect(screen.getByLabelText('Beat title (not printed)')).toBeDefined();

    // Research is not a tab beside the Script any more: it is in the title
    // bar, so taking the Script to another monitor does not take it too.
    expect(screen.queryByText('Research')).toBeNull();
    expect(screen.queryByRole('tab', { name: /^Characters/ })).toBeNull();
  });
});

/**
 * Short form's timeline (addendum 05 §3a, §3e, §5): a commercial has no pages
 * to count, no plot to track, and a clock the strip and the sheet share.
 */
describe('the timeline under a board', () => {
  const commercial = (): ProjectFile => {
    let file = createProjectFile({ title: 'Commercial 1', format: 'short_form' });
    file = updateUnit(file, file.units[0]!.id, { title: 'Know your enemy...' });
    return updateBeat(file, file.beats[0]!.id, {
      manuscript: {
        elements: [
          { id: 'e1' as never, type: 'dialogue', text: '"Know your enemy."', characterId: null, attributes: {} },
        ],
      },
      seconds: 6,
    });
  };

  it('says Time rather than Pages, because a commercial has neither', () => {
    timeline(commercial());
    expect(screen.getByText('Time')).toBeDefined();
    expect(screen.queryByText('Pages · time')).toBeNull();
  });

  it('draws no playhead until the board is playing, and one when it is', () => {
    const { unmount } = timeline(commercial());
    expect(document.querySelector('.board-playhead')).toBeNull();
    unmount();

    timeline(commercial(), { playheadSeconds: 3 });
    expect(document.querySelector('.board-playhead')).not.toBeNull();
  });

  it('widens a segment as the zoom widens, at every zoom', () => {
    const width = (zoom: number) => {
      cleanup();
      timeline(commercial(), { pixelsPerPage: zoom });
      const grid = document.querySelector('.timeline-grid') as HTMLElement;
      // The second column is the one segment there is; the first is the head.
      return Number((grid.style.gridTemplateColumns.split(' ')[1] ?? '0').replace('px', ''));
    };
    // Six seconds. Not a fixed floor swallowing the lot at the low end.
    expect(width(40)).toBeLessThan(width(160));
    expect(width(160)).toBeLessThan(width(600));
  });

  it('runs a shot to its clip in the strip as well as on the sheet', () => {
    const file = commercial();
    const made = setRowFrame(file, file.beats[0]!.id, {
      data: 'data:video/mp4;base64,AAAA',
      kind: 'video',
      seconds: 20,
    });
    timeline(made.file);
    // Twenty seconds of clip over six of line: the shot reads twenty, on the
    // segment strip and at the end of the ruler alike.
    expect(screen.getAllByText('00:20').length).toBeGreaterThan(0);
    expect(document.querySelector('.segment-rt')?.textContent).toBe('00:20');
    expect(document.querySelector('.board-frame video')).not.toBeNull();
  });
});
