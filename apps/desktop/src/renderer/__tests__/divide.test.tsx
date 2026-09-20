// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addBeat, addMarker, beatsForUnit, contentsDivisions, createProjectFile, unitsInStoryOrder, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { StoryView } from '../components/StoryView';

/**
 * Dividing the manuscript from its bar (addendum 21 §10): Chapter or
 * Passage, then a click where it starts and one where it ends.
 */

afterEach(cleanup);

let latest: ProjectFile | null = null;

function Book({ start }: { start: ProjectFile }) {
  const [file, setFile] = useState(start);
  latest = file;
  return (
    <StoryView
      file={file}
      selectedBeatId={null}
      onSelectBeat={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      focusMode={false}
      focusTitleBeatId={null}
      onTitleFocused={() => undefined}
      dictationShortcut={null}
      display={{ headings: false, sceneNames: true, beatNames: true, acts: false, pages: false }}
    />
  );
}

const para = (id: string, text: string) => ({ id: id as never, type: 'paragraph' as const, text, characterId: null, attributes: {} });

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel' });
  const unit = file.units[0]!;
  file = addMarker(file, { unitId: unit.id, kind: 'chapter', title: 'One' }).file;
  const first = file.beats.find((beat) => beat.unitId === unit.id)!;
  file = updateBeat(file, first.id, { manuscript: { elements: ['a', 'b', 'c', 'd'].map((id) => para(id, `Paragraph ${id}.`)) } });
  const second = addBeat(file, { unitId: unit.id });
  file = updateBeat(second.file, second.beat.id, { manuscript: { elements: ['e', 'f', 'g', 'h'].map((id) => para(id, `Paragraph ${id}.`)) } });
  return file;
};

const row = (id: string) => document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;

describe('dividing from the bar', () => {
  it('makes a chapter from a start and an end, says so, and resets', () => {
    render(<Book start={novel()} />);
    const chapter = screen.getByRole('button', { name: 'Chapter' });
    fireEvent.click(chapter);
    expect(screen.getByRole('status').textContent).toMatch(/Click the paragraph where the chapter starts/);
    fireEvent.click(row('c'));
    expect(row('c').classList.contains('divide-start')).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/where the chapter ends/);
    fireEvent.click(row('f'));

    const file = latest as ProjectFile;
    const order = unitsInStoryOrder(file);
    expect(order).toHaveLength(3);
    expect(contentsDivisions(file)).toHaveLength(2);
    expect(beatsForUnit(file, order[1]!.id).flatMap((beat) => beat.manuscript.elements.map((element) => element.id))).toEqual(['c', 'd', 'e', 'f']);
    // The tool put itself down and said what it did.
    expect((chapter as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('status').textContent).toBe('Chapter made from 4 paragraphs.');
    expect(document.querySelector('.divide-start')).toBeNull();
    // A click on the page is a click on the page again.
    expect(document.querySelector('.script-view.dividing')).toBeNull();
  });

  it('makes a passage inside the chapter, and Escape puts the tool down', () => {
    render(<Book start={novel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passage' }));
    fireEvent.click(row('b'));
    fireEvent.click(row('c'));
    const file = latest as ProjectFile;
    expect(unitsInStoryOrder(file)).toHaveLength(1);
    expect(beatsForUnit(file, file.units[0]!.id).map((beat) => beat.manuscript.elements.map((element) => element.id))).toEqual([['a'], ['b', 'c'], ['d'], ['e', 'f', 'g', 'h']]);
    expect(screen.getByRole('status').textContent).toBe('Passage made from 2 paragraphs.');

    fireEvent.click(screen.getByRole('button', { name: 'Passage' }));
    fireEvent.click(row('a'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.divide-start')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  /** The right-click on a line (addendum 02 §6a): the story cut where the writer points. */
  it('splits the chapter, or the passage, at a line from its right-click, and says why not on a first line', () => {
    render(<Book start={novel()} />);
    // The paragraphs' own boxes: the chapter's and the beats' names are textboxes too.
    const box = (id: string) => screen.getByDisplayValue(`Paragraph ${id}.`);
    fireEvent.contextMenu(box('a'), { clientX: 20, clientY: 20 });
    const first = screen.getByRole('menuitem', { name: 'Split the chapter here' }) as HTMLButtonElement;
    expect(first.disabled).toBe(true);
    expect(first.title).toMatch(/already opens the chapter/);
    expect((screen.getByRole('menuitem', { name: 'New passage from here' }) as HTMLButtonElement).disabled).toBe(true);
    // The writing's own items are still there.
    expect(screen.getByRole('menuitem', { name: 'Add to a character’s characterization…' })).toBeDefined();
    fireEvent.keyDown(first, { key: 'Escape' });

    fireEvent.contextMenu(box('c'), { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'New passage from here' }));
    let file = latest as ProjectFile;
    expect(beatsForUnit(file, file.units[0]!.id).map((beat) => beat.manuscript.elements.map((element) => element.id))).toEqual([['a', 'b'], ['c', 'd'], ['e', 'f', 'g', 'h']]);

    fireEvent.contextMenu(box('f'), { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split the chapter here' }));
    file = latest as ProjectFile;
    const order = unitsInStoryOrder(file);
    expect(order).toHaveLength(2);
    expect(beatsForUnit(file, order[1]!.id).flatMap((beat) => beat.manuscript.elements.map((element) => element.id))).toEqual(['f', 'g', 'h']);
  });

  it('is absent on a screenplay', () => {
    render(<Book start={createProjectFile({ title: 'S', format: 'screenplay' })} />);
    expect(screen.queryByRole('button', { name: 'Scene' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Divide the manuscript' })).toBeNull();
  });
});
