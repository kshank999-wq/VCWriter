// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addResearchItem,
  addUnit,
  beatsInStoryOrder,
  createProjectFile,
  linkEntities,
  ref,
  updateBeat,
  updateUnit,
  type BeatId,
  type ProjectFile,
} from '@vcwriter/domain';
import { TimelineViewer } from '../components/TimelineViewer';

/**
 * The Timeline & Viewer screen (addendum 02 §5).
 */

afterEach(cleanup);

const cue = (name: string) => ({ id: crypto.randomUUID() as never, type: 'character' as const, text: name, characterId: null, attributes: {} });
const say = (text: string) => ({ id: crypto.randomUUID() as never, type: 'dialogue' as const, text, characterId: null, attributes: {} });
const action = (text: string) => ({ id: crypto.randomUUID() as never, type: 'action' as const, text, characterId: null, attributes: {} });

/** Two scenes: Mike is in both, Celeste only in the second. */
const twoScenes = () => {
  let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  file = updateUnit(file, file.units[0]!.id, { title: 'Opening', sequenceLabel: '1' });
  file = updateBeat(file, file.beats[0]!.id, {
    manuscript: { elements: [action('Rain. '.repeat(120)), cue('MIKE'), say('Morning.')] },
  });
  const second = addUnit(file, { laneId: file.lanes[0]!.id, title: 'The kitchen' });
  file = second.file;
  const beat = addBeat(file, { unitId: second.unit.id });
  file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [cue('CELESTE'), say('Hello.'), cue('MIKE'), say('Hey.')] } });
  return file;
};

function Harness({ initial, isolate = '' }: { initial: ProjectFile; isolate?: string }) {
  const [file, setFile] = useState(initial);
  const [selected, setSelected] = useState<BeatId | null>(beatsInStoryOrder(initial)[0]?.id ?? null);
  const [isolated, setIsolated] = useState(isolate);
  const [zoom, setZoom] = useState(120);
  return (
    <TimelineViewer
      file={file}
      selectedBeatId={selected}
      onSelectBeat={setSelected}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      zoom={zoom}
      onZoom={setZoom}
      isolated={isolated}
      onIsolate={setIsolated}
    />
  );
}

describe('the timeline', () => {
  it('lays the scenes out in time, at a page a minute', () => {
    const { container } = render(<Harness initial={twoScenes()} />);

    expect(screen.getByText('Opening')).toBeDefined();
    expect(screen.getByText('The kitchen')).toBeDefined();
    // The first scene starts at zero; the second starts after it, so its
    // timecode is later — the axis is a running time.
    const times = Array.from(container.querySelectorAll('.viewer-time')).map((node) => node.textContent);
    expect(times[0]).toBe('0:00');
    expect(times[1]).not.toBe('0:00');
  });

  it('changes the width of every scene as it is zoomed', () => {
    const { container } = render(<Harness initial={twoScenes()} />);
    const columnsAt = () => (container.querySelector('.viewer-grid') as HTMLElement).style.gridTemplateColumns;
    const before = columnsAt();

    fireEvent.change(screen.getByLabelText('Timeline zoom, pixels per page'), { target: { value: '400' } });
    expect(columnsAt()).not.toBe(before);
  });

  it('selects the scene that is clicked', () => {
    const { container } = render(<Harness initial={twoScenes()} />);
    fireEvent.click(screen.getByText('The kitchen'));
    expect(container.querySelectorAll('.viewer-scene.playhead')).toHaveLength(1);
    expect((container.querySelector('.viewer-scene.playhead') as HTMLElement).textContent).toContain('The kitchen');
  });
});

describe('the threads through it', () => {
  it('runs a row per character through the scenes they speak in', () => {
    const { container } = render(<Harness initial={twoScenes()} />);
    const names = Array.from(container.querySelectorAll('.viewer-thread-name')).map((node) => node.textContent);
    expect(names).toEqual(['MIKE', 'CELESTE']);

    // Mike is in both scenes; Celeste is in the second only.
    const rows = container.querySelectorAll('.viewer-thread-head');
    const mikeCells = rows[0]!.parentElement!.querySelectorAll('.viewer-cell.on');
    expect(mikeCells.length).toBeGreaterThanOrEqual(2);
  });

  it('isolates one character, and dims the scenes they are not in', () => {
    const { container } = render(<Harness initial={twoScenes()} isolate="CELESTE" />);
    expect(Array.from(container.querySelectorAll('.viewer-thread-name')).map((node) => node.textContent)).toEqual(['CELESTE']);
    // The first scene has no Celeste in it, so it steps back.
    const scenes = container.querySelectorAll('.viewer-scene');
    expect(scenes[0]!.className).toContain('dim');
    expect(scenes[1]!.className).not.toContain('dim');
  });

  it('runs a theme through the scenes it is linked to, and draws the links between objects', () => {
    let file = twoScenes();
    const themes = file.researchCategories.find((category) => category.systemKey === 'themes')!;
    file = addResearchItem(file, { categoryId: themes.id, title: 'Faith and doubt' });
    const item = file.researchItems[file.researchItems.length - 1]!;
    file = linkEntities(file, { from: ref('research_item', item.id), to: ref('unit', file.units[1]!.id), type: 'relates_to' });
    // A link between two scenes: an object connection, which this screen draws.
    file = linkEntities(file, { from: ref('unit', file.units[0]!.id), to: ref('unit', file.units[1]!.id), type: 'establishes' });

    const { container } = render(<Harness initial={file} />);
    expect(Array.from(container.querySelectorAll('.viewer-thread-name')).map((node) => node.textContent)).toContain(
      'Faith and doubt',
    );
    expect(within(screen.getByLabelText('Links between objects')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('says so when there is nothing running through the story yet', () => {
    const bare = createProjectFile({ title: 'Empty', format: 'screenplay' });
    render(<Harness initial={bare} />);
    expect(screen.getByText(/Characters appear here as they speak/)).toBeDefined();
  });
});

describe('what left the screen', () => {
  it('no longer shows the page, the promises or the beats', () => {
    const onSelect = vi.fn();
    const { container } = render(<Harness initial={twoScenes()} />);
    expect(container.querySelector('.paper')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Page' })).toBeNull();
    expect(container.querySelector('.thread-beat')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
