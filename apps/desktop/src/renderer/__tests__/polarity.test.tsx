// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addUnit,
  createProjectFile,
  gridOf,
  setPolarity,
  unitsInStoryOrder,
  type ProjectFile,
} from '@vcwriter/domain';
import { PolarityGraph } from '../components/PolarityGraph';
import { menusFor } from '../menus';

/**
 * The polarity graph through the interface (addendum 13).
 *
 * The rule is tested in the domain. What these cover is what a writer meets:
 * there is **nowhere to declare a scene flat**, an unread scene is drawn rather
 * than skipped, and a flat one gets a prompt rather than a verdict.
 */

afterEach(cleanup);

const script = (scenes: number) => {
  let file: ProjectFile = createProjectFile({ title: 'The Turn', format: 'screenplay' });
  const trackId = file.tracks[0]!.id;
  for (let at = 0; at < scenes; at += 1) {
    file = addUnit(file, { trackId, title: `Scene ${at + 1}` }).file;
  }
  return { file, ids: unitsInStoryOrder(file).map((unit) => unit.id) };
};

function Graph({ start, onFile }: { start: ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return <PolarityGraph file={file} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

describe('the graph', () => {
  it('draws every scene, including the ones nobody has read', () => {
    const { file } = script(4);
    render(<Graph start={file} />);
    // A graph that dropped them would draw a story with no gaps in it.
    expect(document.querySelectorAll('.polarity-scene')).toHaveLength(file.units.length);
    expect(document.querySelectorAll('.polarity-scene.unsaid')).toHaveLength(file.units.length);
    expect(screen.getByText(/none read yet/)).toBeTruthy();
  });

  it('has nowhere to say a scene is flat — only where it begins and ends', () => {
    const { file, ids } = script(2);
    render(<Graph start={setPolarity(file, ids[0]!, { start: 'positive', end: 'positive' })} />);
    fireEvent.click(document.querySelector('.polarity-scene') as Element);

    expect(screen.getByLabelText('Start polarity')).toBeTruthy();
    expect(screen.getByLabelText('End polarity')).toBeTruthy();
    // The thing the module refuses to let a writer answer.
    expect(screen.queryByLabelText(/changed|flat/i)).toBeNull();
  });

  it('marks a flat scene and prompts rather than judging', () => {
    const { file, ids } = script(2);
    render(<Graph start={setPolarity(file, ids[0]!, { start: 'negative', end: 'negative' })} />);

    expect(document.querySelectorAll('.polarity-scene.flat')).toHaveLength(1);
    fireEvent.click(document.querySelector('.polarity-scene.flat') as Element);
    const note = screen.getByText(/No polarity change is defined/);
    expect(note.textContent).toMatch(/Review whether/);
    expect(note.textContent).not.toMatch(/delete|cut this/i);
  });

  it('sets both ends from the panel, and the flat count follows', () => {
    let seen: ProjectFile | null = null;
    const { file, ids } = script(2);
    render(<Graph start={file} onFile={(one) => (seen = one)} />);
    fireEvent.click(document.querySelectorAll('.polarity-scene')[0] as Element);
    fireEvent.change(screen.getByLabelText('Start polarity'), { target: { value: 'neutral' } });
    fireEvent.change(screen.getByLabelText('End polarity'), { target: { value: 'neutral' } });

    const grid = gridOf(seen as unknown as ProjectFile, ids[0]!);
    expect(grid.polarityStart).toBe('neutral');
    expect(grid.polarityEnd).toBe('neutral');
    expect(screen.getByText(/Flat scenes \(1\)/)).toBeTruthy();
  });

  it('takes several purposes at once, because a scene does several things', () => {
    let seen: ProjectFile | null = null;
    const { file, ids } = script(1);
    render(<Graph start={file} onFile={(one) => (seen = one)} />);
    fireEvent.click(document.querySelector('.polarity-scene') as Element);
    fireEvent.click(screen.getByText('Reveals character'));
    fireEvent.click(screen.getByText('Creates conflict or tension'));

    expect(gridOf(seen as unknown as ProjectFile, ids[0]!).purposes.sort()).toEqual([
      'create_conflict',
      'reveal_character',
    ]);
  });

  it('calls an unnamed purpose not defined, and nothing more', () => {
    const { file } = script(1);
    render(<Graph start={file} />);
    fireEvent.click(document.querySelector('.polarity-scene') as Element);
    const note = screen.getByText(/Purpose not defined/);
    expect(note.textContent).toMatch(/Nothing follows from that/);
  });
});

describe('the way in', () => {
  it('is on the Editor menu for every format, since every format has scenes that turn', () => {
    const commands = (format: Parameters<typeof menusFor>[0]) =>
      menusFor(format).flatMap((menu) => menu.items.filter(Boolean).map((item) => item!.command));

    for (const format of ['screenplay', 'novel', 'series', 'short_story'] as const) {
      expect(commands(format)).toContain('editor.polarity');
    }
  });
});
