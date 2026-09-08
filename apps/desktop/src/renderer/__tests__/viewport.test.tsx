// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addUnit,
  beatsInStoryOrder,
  createProjectFile,
  updateBeat,
  type BeatId,
  type ProjectFile,
} from '@vcwriter/domain';
import { Viewport } from '../components/Viewport';
import { ThreadView } from '../components/ThreadView';
import { LaneDialog } from '../components/LaneDialog';

/**
 * The viewport, the Threads view and the plot pop-up (addendum 02 §4, §6).
 */

afterEach(cleanup);

const cue = (name: string) => ({ id: crypto.randomUUID() as never, type: 'character' as const, text: name, characterId: null, attributes: {} });
const say = (text: string) => ({ id: crypto.randomUUID() as never, type: 'dialogue' as const, text, characterId: null, attributes: {} });

/** Two scenes; Mike speaks in both, Celeste in the second only. */
const twoScenes = () => {
  let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  file = updateBeat(file, file.beats[0]!.id, { title: 'Opening', manuscript: { elements: [cue('MIKE'), say('Morning.')] } });
  const second = addUnit(file, { laneId: file.lanes[0]!.id, title: 'The kitchen' });
  file = second.file;
  const b2 = addBeat(file, { unitId: second.unit.id, title: 'They meet' });
  file = updateBeat(b2.file, b2.beat.id, { manuscript: { elements: [cue('CELESTE'), say('Hello.'), cue('MIKE'), say('Hey.')] } });
  return file;
};

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

describe('viewport', () => {
  it('names the scene, counts pages, shows its page, and steps through beats', () => {
    const onView = vi.fn();
    render(
      <Harness initial={twoScenes()}>
        {(file, update, selected, select) => (
          <Viewport file={file} selectedBeatId={selected} onSelectBeat={select} onUpdate={update} view="page" onView={onView} />
        )}
      </Harness>,
    );

    expect(screen.getByText('Opening Scene')).toBeDefined();
    expect(screen.getByLabelText('Page 1')).toBeDefined();
    expect(screen.getByText(/1 \/ 2 · Opening/)).toBeDefined();

    fireEvent.click(screen.getByLabelText('Next beat'));
    expect(screen.getByText('The kitchen')).toBeDefined();
    expect(screen.getByText(/2 \/ 2 · They meet/)).toBeDefined();
    expect((screen.getByLabelText('Next beat') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('tab', { name: 'Threads' }));
    expect(onView).toHaveBeenCalledWith('threads');
  });
});

describe('threads view', () => {
  it('draws a thread per character through the scenes they speak in, and colours beats by cast', () => {
    const { container } = render(
      <Harness initial={twoScenes()}>
        {(file, update, selected, select) => <ThreadView file={file} selectedBeatId={selected} onSelectBeat={select} onUpdate={update} />}
      </Harness>,
    );
    const names = Array.from(container.querySelectorAll('.thread-character-name')).map((node) => node.textContent);
    expect(names).toEqual(['MIKE', 'CELESTE']);
    // Mike is in both scenes, so his thread is a line; Celeste's is a single dot.
    expect(container.querySelectorAll('.thread-character polyline')).toHaveLength(1);
    expect(container.querySelectorAll('.thread-character circle')).toHaveLength(3);
    // The second beat has two speakers: two dots on its chip.
    const chips = container.querySelectorAll('.thread-beat');
    expect(chips).toHaveLength(2);
    expect(chips[1]!.querySelectorAll('circle')).toHaveLength(2);
  });

  it('links two beats by dragging from one to the other, and removes a link on click', () => {
    let latest: ProjectFile = twoScenes();
    const { container } = render(
      <Harness initial={latest}>
        {(file, update, selected, select) => {
          latest = file;
          return <ThreadView file={file} selectedBeatId={selected} onSelectBeat={select} onUpdate={update} />;
        }}
      </Harness>,
    );
    const [first, second] = Array.from(container.querySelectorAll('.thread-beat'));
    fireEvent.pointerDown(first!);
    fireEvent.pointerUp(second!);
    expect(latest.links).toHaveLength(1);
    expect(latest.links[0]).toMatchObject({ from: { type: 'beat' }, to: { type: 'beat' }, type: 'relates_to' });

    expect(container.querySelectorAll('.beat-link')).toHaveLength(1);
    fireEvent.click(container.querySelector('.beat-link')!);
    expect(latest.links).toHaveLength(0);
  });

  it('hides a layer when its toggle is off', () => {
    const { container } = render(
      <Harness initial={twoScenes()}>
        {(file, update, selected, select) => <ThreadView file={file} selectedBeatId={selected} onSelectBeat={select} onUpdate={update} />}
      </Harness>,
    );
    fireEvent.click(screen.getByLabelText('Characters'));
    expect(container.querySelectorAll('.thread-character')).toHaveLength(0);
  });
});

describe('plot pop-up', () => {
  it('edits the plot summary and arc as typed', () => {
    let latest: ProjectFile = twoScenes();
    const onClose = vi.fn();
    render(
      <Harness initial={latest}>
        {(file, update) => {
          latest = file;
          return <LaneDialog file={file} laneId={file.lanes[0]!.id} onClose={onClose} onUpdate={update} />;
        }}
      </Harness>,
    );
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'A man and his faith.' } });
    fireEvent.change(screen.getByLabelText('Arc'), { target: { value: 'Certainty, doubt, a harder faith.' } });
    expect(latest.lanes[0]).toMatchObject({ description: 'A man and his faith.', arc: 'Certainty, doubt, a harder faith.' });

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
