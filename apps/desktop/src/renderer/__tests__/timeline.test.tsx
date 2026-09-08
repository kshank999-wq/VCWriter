// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addLane,
  addSetupPayoff,
  addSetupPoint,
  addUnit,
  beatsInStoryOrder,
  createProjectFile,
  lanesInOrder,
  recordPayoff,
  ref,
  unitsForLane,
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
          onAddLane={() => undefined}
          onAddAct={() => undefined}
          onOpenLane={() => undefined}
          {...extra}
        />
      )}
    </Harness>,
  );

const twoLanes = (): ProjectFile =>
  addLane(createProjectFile({ title: 'Lighthouse', format: 'screenplay' }), { name: 'Subplot' }).file;

const laneNames = () =>
  screen.getAllByLabelText(/^Lane name: /).map((element) => (element.getAttribute('aria-label') ?? '').replace('Lane name: ', ''));

describe('master timeline', () => {
  it('draws a track per lane with the scene blocks and beats in them', () => {
    timeline(twoLanes());
    expect(laneNames()).toEqual(['Main Plot', 'Subplot']);
    expect(screen.getByText('Opening Scene')).toBeDefined();
    expect(screen.getByText('Opening beat')).toBeDefined();
    expect(screen.getByText('Pages · time')).toBeDefined();
    expect(screen.getByText('Links')).toBeDefined();

    fireEvent.click(screen.getByTitle('Add beat'));
    expect(screen.getByText('New beat')).toBeDefined();
  });

  it('moves a lane down with Alt and an arrow, and not without Alt', () => {
    timeline(twoLanes());
    fireEvent.keyDown(screen.getByLabelText(/Reorder lane Main Plot/i), { key: 'ArrowDown' });
    expect(laneNames()).toEqual(['Main Plot', 'Subplot']);

    fireEvent.keyDown(screen.getByLabelText(/Reorder lane Main Plot/i), { key: 'ArrowDown', altKey: true });
    expect(laneNames()).toEqual(['Subplot', 'Main Plot']);
  });

  it('moves a scene later in the story with Alt+↓ and to the next lane with Alt+Shift+↓', () => {
    let initial = twoLanes();
    const main = initial.lanes[0]!;
    initial = addUnit(initial, { laneId: main.id, title: 'Second scene' }).file;
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
              onAddLane={() => undefined}
              onAddAct={() => undefined}
              onOpenLane={() => undefined}
            />
          );
        }}
      </Harness>,
    );

    fireEvent.keyDown(screen.getByLabelText(/Reorder Opening Scene/i), { key: 'ArrowDown', altKey: true });
    expect(unitsInStoryOrder(latest).map((unit) => unit.title)).toEqual(['Second scene', 'Opening Scene']);

    fireEvent.keyDown(screen.getByLabelText(/Reorder Opening Scene/i), { key: 'ArrowDown', altKey: true, shiftKey: true });
    const subplot = lanesInOrder(latest)[1]!;
    expect(unitsForLane(latest, subplot.id).map((unit) => unit.title)).toEqual(['Opening Scene']);
    // The lane changed; the story position did not.
    expect(unitsInStoryOrder(latest).map((unit) => unit.title)).toEqual(['Second scene', 'Opening Scene']);
  });

  it('draws a kept promise as a curve to its payoff and an outstanding one into the air', () => {
    let file = twoLanes();
    const first = file.units[0]!;
    const fourth = addUnit(file, { laneId: file.lanes[0]!.id, title: 'Sc 4' });
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
    let file = twoLanes();
    const second = addUnit(file, { laneId: file.lanes[0]!.id, title: 'Second scene' });
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

  it('offers the toolbar actions', () => {
    const onAddScene = vi.fn();
    const onAddAct = vi.fn();
    timeline(twoLanes(), { onAddScene, onAddAct });
    fireEvent.click(screen.getByRole('button', { name: '+ Scene' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Act' }));
    expect(onAddScene).toHaveBeenCalledTimes(1);
    expect(onAddAct).toHaveBeenCalledTimes(1);
  });
});

describe('inspector', () => {
  it('edits the beat, moves its scene to another lane, and starts an act', () => {
    let latest: ProjectFile = twoLanes();
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

    const subplot = lanesInOrder(latest)[1]!;
    fireEvent.change(screen.getByLabelText('Scene lane'), { target: { value: subplot.id } });
    expect(latest.units[0]?.laneId).toBe(subplot.id);

    fireEvent.click(screen.getByRole('button', { name: /Start one here/i }));
    expect(latest.markers).toHaveLength(1);
    expect((screen.getByPlaceholderText('Act I') as HTMLInputElement).value).toBe('New act');
  });
});

describe('master panel', () => {
  it('is the Script, with Research opening over the whole workspace', () => {
    const opened = vi.fn();
    render(
      <Harness initial={twoLanes()}>
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
            onOpenResearch={opened}
          />
        )}
      </Harness>,
    );

    // The Script opens as the finished script: the page, not the scaffolding.
    expect(screen.queryByLabelText('Beat title (not printed)')).toBeNull();
    fireEvent.click(screen.getByLabelText('Beat names'));
    expect(screen.getByLabelText('Beat title (not printed)')).toBeDefined();

    // Research is no longer a tab with a strip of categories under it.
    fireEvent.click(screen.getByText('Research'));
    expect(opened).toHaveBeenCalled();
    expect(screen.queryByRole('tab', { name: /^Characters/ })).toBeNull();
  });
});
