// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addResearchItem,
  addUnit,
  createProjectFile,
  fileNoteUnder,
  markResearchUsed,
  notesForSection,
  placeNoteText,
  updateBeat,
  type ProjectFile,
} from '@vcwriter/domain';
import { ElementNotes } from '../components/ElementNotes';

/**
 * The notes beside a scene or a beat (from Ken): red until used, green
 * after; Hide used notes takes the green ones away, and unticked they come
 * back at the foot of the list. Place text puts a note's words where the
 * cursor was, as a block.
 */
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const scene = () => {
  let file: ProjectFile = createProjectFile({ title: 'Night', format: 'screenplay' });
  const unit = addUnit(file, { trackId: file.tracks[0]!.id, title: 'The farmhouse' });
  file = unit.file;
  const beat = addBeat(file, { unitId: unit.unit.id, title: 'Boarding up' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: { elements: [{ id: 'e1', type: 'action', text: 'Ben checks the windows.', characterId: null, attributes: {} } as never] },
  });
  const folder = file.researchCategories[0]!.id;
  for (const [title, body] of [['The table legs', 'Ben breaks up the table.'], ['Radio on the mantel', 'It crackles.']]) {
    file = addResearchItem(file, { categoryId: folder, title: title!, body: body! });
    file = fileNoteUnder(file, file.researchItems.at(-1)!.id, { kind: 'section', unitId: unit.unit.id });
  }
  return { file, unitId: unit.unit.id, beatId: beat.beat.id };
};

describe('the notes beside a scene', () => {
  it('lists the notes filed to it, red until used, and hides the used ones', () => {
    const s = scene();
    const notes = notesForSection(s.file, s.unitId as string);
    expect(notes.map((one) => one.title)).toEqual(['The table legs', 'Radio on the mantel']);
    const used = markResearchUsed(s.file, { itemId: notes[0]!.id, beatId: s.beatId });
    function Harness() {
      const [file] = useState(used);
      return <ElementNotes file={file} notes={notesForSection(file, s.unitId as string)} placeWord="add it" onOpen={() => undefined} />;
    }
    render(<Harness />);
    expect(screen.queryByText('The table legs')).toBeNull();
    expect(screen.getByText('Radio on the mantel')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Hide used notes'));
    const titles = screen.getAllByRole('button').map((one) => one.textContent ?? '').filter((text) => /table|Radio/.test(text));
    expect(titles[0]).toMatch(/Radio/);
    expect(titles[1]).toMatch(/table legs/);
  });
});

describe('Place text', () => {
  it('puts the note in after the cursor line, as its own lines, and marks it used', () => {
    const s = scene();
    const note = notesForSection(s.file, s.unitId as string)[0]!;
    const result = placeNoteText(s.file, note.id, s.beatId, 'e1' as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const beat = result.file.beats.find((one) => one.id === s.beatId)!;
    expect(beat.manuscript.elements.map((one) => one.text)).toEqual(['Ben checks the windows.', 'Ben breaks up the table.']);
    expect(result.file.researchItems.find((one) => one.id === note.id)!.usage).toBe('used');
  });
});
