// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addMoment,
  addSetupPayoff,
  addSetupPoint,
  addThread,
  addUnit,
  createProjectFile,
  dependOn,
  graveyard,
  momentsOf,
  recordPayoff,
  ref,
  threadsInOrder,
  unitsInStoryOrder,
  updateBeat,
  updateThread,
  type ManuscriptElementId,
  type ProjectFile,
} from '@vcwriter/domain';
import { LinksTimeline } from '../components/LinksTimeline';

/**
 * The Links timeline through the interface (addendum 15).
 *
 * The rules are tested in the domain. What these cover is what a writer meets:
 * that every track is drawn by the same code, that a sequence and a dependency
 * look different, that a track can be turned off and a row isolated, and that
 * the under-prepared payoff's red arrives here without this screen knowing what
 * a setup is.
 */

afterEach(cleanup);

const para = (text: string) => ({
  id: crypto.randomUUID() as ManuscriptElementId,
  type: 'action' as const,
  text,
  characterId: null,
  attributes: {},
});

const script = (scenes: number) => {
  let file: ProjectFile = createProjectFile({ title: 'The Key', format: 'screenplay' });
  const trackId = file.tracks[0]!.id;
  const offset = unitsInStoryOrder(file).length;
  for (let at = 0; at < scenes; at += 1) {
    const scene = addUnit(file, { trackId, title: `Scene ${at + 1}` });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [para(`Line ${at + 1}.`)] } });
  }
  return { file, offset, total: offset + scenes };
};

const beatAt = (file: ProjectFile, sceneIndex: number) => {
  const unitId = unitsInStoryOrder(file)[sceneIndex + 1]!.id;
  return file.beats.find((one) => one.unitId === unitId)!;
};

/** A link of three moments across the script. */
const threaded = (scenes = 4) => {
  const { file, total } = script(scenes);
  const made = addThread(file, { name: 'The key' });
  let current = made.file;
  for (const at of [0, 1, 3]) {
    current = addMoment(current, made.thread.id, { beatId: beatAt(current, at).id }).file;
  }
  return { file: current, threadId: made.thread.id, total };
};

/** Open a link's row in the list below. Its name is also an isolate option. */
const openLink = (name: string) => {
  const head = [...document.querySelectorAll('.links-thread-name')].find(
    (one) => one.textContent === name,
  )!.closest('.links-thread-head') as HTMLElement;
  fireEvent.click(head);
};

function Board({ start, onFile }: { start: ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return <LinksTimeline file={file} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

describe('the wiring diagram', () => {
  it('draws a scene box per scene, in script order', () => {
    const { file, total } = script(3);
    render(<Board start={file} />);
    // The scene row is the script's own units; this module keeps no order.
    const numbers = document.querySelectorAll('.links-scene');
    expect(numbers).toHaveLength(total);
  });

  it('draws every track by the same code, including the ones with nothing in them', () => {
    const { file } = script(2);
    render(<Board start={file} />);
    for (const title of ['Links', 'Setups & Payoffs', 'Themes & Motifs', 'Character Arcs']) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
  });

  it('joins a sequence link quietly, and never with an arrow', () => {
    const { file } = threaded();
    render(<Board start={file} />);
    expect(document.querySelectorAll('.links-edge.sequence')).toHaveLength(2);
    expect(document.querySelectorAll('.links-edge.dependency')).toHaveLength(0);
  });

  it('draws nothing between the moments of a dependency link until one is drawn', () => {
    const made = threaded();
    const current = updateThread(made.file, made.threadId, { relationship: 'dependency' });
    render(<Board start={current} />);
    // Chronology is not causality.
    expect(document.querySelectorAll('.links-edge')).toHaveLength(0);

    const nodes = momentsOf(current, made.threadId).map((one) => one.node.id as string);
    cleanup();
    render(<Board start={dependOn(current, nodes[2]!, nodes[0]!)} />);
    expect(document.querySelectorAll('.links-edge.dependency')).toHaveLength(1);
  });
});

describe('filters', () => {
  it('turns a track off and back on', () => {
    const { file } = threaded();
    render(<Board start={file} />);
    expect(document.querySelectorAll('.links-row').length).toBeGreaterThan(0);

    const toggle = screen.getAllByRole('button', { name: 'Links' })[0]!;
    fireEvent.click(toggle);
    expect(document.querySelectorAll('.links-row')).toHaveLength(0);
    fireEvent.click(toggle);
    expect(document.querySelectorAll('.links-row').length).toBeGreaterThan(0);
  });

  it('isolates one row, and the count says the rest were put away', () => {
    const made = threaded();
    const second = addThread(made.file, { name: 'The letter' });
    const current = addMoment(second.file, second.thread.id, { beatId: beatAt(second.file, 2).id }).file;

    render(<Board start={current} />);
    expect(document.querySelectorAll('.links-row')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Isolate'), {
      target: { value: `links:${made.threadId as string}` },
    });
    expect(document.querySelectorAll('.links-row')).toHaveLength(1);
    expect(screen.getByText(/filtered out/)).toBeTruthy();
  });

  it('narrows to a stretch of the script and gives it all back', () => {
    const made = threaded(5);
    render(<Board start={made.file} />);
    expect(document.querySelectorAll('.links-row')).toHaveLength(1);

    // A stretch the link does not reach.
    fireEvent.change(screen.getByLabelText('From scene'), { target: { value: String(made.total) } });
    fireEvent.change(screen.getByLabelText('To scene'), { target: { value: String(made.total) } });
    expect(document.querySelectorAll('.links-row')).toHaveLength(0);

    fireEvent.click(screen.getByText('Clear filters'));
    expect(document.querySelectorAll('.links-row')).toHaveLength(1);
  });
});

describe('the other tracks arrive without this screen knowing what they are', () => {
  it('shows an under-prepared payoff in red, read from the Setups module', () => {
    const { file } = script(4);
    let current = addSetupPayoff(file, { title: 'The gun' });
    const recordId = current.setupsPayoffs[0]!.id;
    current = addSetupPoint(current, {
      setupPayoffId: recordId,
      description: 'bought',
      location: ref('beat', beatAt(current, 0).id as string),
    });
    current = recordPayoff(current, {
      setupPayoffId: recordId,
      description: 'fired',
      location: ref('beat', beatAt(current, 3).id as string),
    });

    render(<Board start={current} />);
    // One setup where three are wanted: the light is the Setups module's.
    expect(document.querySelectorAll('.links-warn').length).toBeGreaterThan(0);
    // And the setup depends on the payoff — an arrow, never a stored edge.
    expect(document.querySelectorAll('.links-edge.dependency').length).toBeGreaterThan(0);
  });
});

describe('a link, opened', () => {
  it('lists its moments in story order, with nowhere to reorder them', () => {
    const made = threaded();
    render(<Board start={made.file} />);
    openLink('The key');

    const list = document.querySelector('.links-moments') as HTMLElement;
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    // §13: position comes from the script, so there is no move control at all.
    expect(within(list).queryByText('Move up')).toBeNull();
  });

  it('offers dependencies only on a dependency link', () => {
    const made = threaded();
    render(<Board start={made.file} />);
    openLink('The key');
    expect(screen.queryByLabelText('Dependent moment')).toBeNull();

    fireEvent.change(screen.getByLabelText('Relationship type'), { target: { value: 'dependency' } });
    expect(screen.getByLabelText('Dependent moment')).toBeTruthy();
  });

  /**
   * The delete is on the row rather than a fold away at the foot of the body
   * (addendum 24 §5d), and what it says is the graveyard's own sentence — the
   * old one promised *the moments go with it*, which stopped being true when
   * burying started keeping them so that restoring could give them back.
   */
  it('deletes from its own row, saying where it goes, and keeps its moments', () => {
    let seen: ProjectFile | null = null;
    const made = threaded();
    render(<Board start={made.file} onFile={(one) => (seen = one)} />);
    expect(screen.queryByText('Remove this link')).toBeNull();

    fireEvent.click(screen.getByLabelText('Delete The key'));
    expect(screen.getByText(/goes to the graveyard/)).toBeTruthy();
    expect(screen.getByText(/Not a word of the writing is cut/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const after = seen as unknown as ProjectFile;
    expect(threadsInOrder(after)).toHaveLength(0);
    expect(graveyard(after).map((row) => row.word)).toEqual(['Thread']);
    // Kept, which is what makes restoring give back the thread it was.
    expect(momentsOf(after, made.threadId)).toHaveLength(3);
  });

  it('renames once and the timeline follows, because nothing copied the name', () => {
    let seen: ProjectFile | null = null;
    const made = threaded();
    render(<Board start={made.file} onFile={(one) => (seen = one)} />);
    openLink('The key');
    fireEvent.change(screen.getByLabelText('Link name'), { target: { value: 'The brass key' } });

    expect((seen as unknown as ProjectFile).threads[0]!.name).toBe('The brass key');
    expect(document.querySelector('.links-row-name')!.textContent).toBe('The brass key');
  });
});
