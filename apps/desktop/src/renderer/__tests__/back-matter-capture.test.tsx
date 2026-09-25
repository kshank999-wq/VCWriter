// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addPart,
  addUnit,
  createProjectFile,
  glossaryEntries,
  partsOf,
  updateBeat,
  type ManuscriptElementId,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { BeatBody } from '../components/BeatBody';

/**
 * **Collecting into the back matter from the page being read** (addendum 20
 * §17b, from Ken).
 *
 * The acts and their refusals are the domain's, and tested there. What these
 * cover is what a writer meets: that all three stand on a book's right-click
 * and none on a screenplay, that each opens its own screen, and that pressing
 * makes the page where the book has none — the thing a writer would otherwise
 * have to go to Layout for first.
 */

afterEach(cleanup);

const para = (text: string) => ({
  id: crypto.randomUUID() as ManuscriptElementId,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const book = (format: ProjectFormat = 'novel') => {
  let file: ProjectFile = createProjectFile({ title: 'The Lighthouse Keeper', format });
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
  const elements = ['The Fresnel lens turned all night.', 'Maeve did not sleep.'].map(para);
  file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements } });
  return { file, beatId: beat.beat.id };
};

function Writing({
  format,
  start,
  onFile,
}: {
  format?: ProjectFormat;
  start?: ReturnType<typeof book>;
  onFile?(file: ProjectFile): void;
}) {
  const [made] = useState(() => start ?? book(format));
  const [file, setFile] = useState(made.file);
  onFile?.(file);
  const beat = file.beats.find((one) => one.id === made.beatId)!;
  return <BeatBody file={file} beat={beat} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

const rightClick = () => fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);

describe('the three the right-click collects with', () => {
  it('offers all three on a book and none on a screenplay', () => {
    render(<Writing format="novel" />);
    rightClick();
    expect(screen.getByText('Add to the index…')).toBeTruthy();
    expect(screen.getByText('Add to the glossary…')).toBeTruthy();
    expect(screen.getByText('Add to the appendix…')).toBeTruthy();

    cleanup();
    render(<Writing format="screenplay" />);
    rightClick();
    // Absent rather than greyed: a screenplay has no back matter at all, and
    // a disabled line would say *not yet*.
    expect(screen.queryByText('Add to the glossary…')).toBeNull();
    expect(screen.queryByText('Add to the appendix…')).toBeNull();
  });

  it('says under each what a press would do, the two differing in what they take', () => {
    render(<Writing format="novel" />);
    rightClick();
    // The one a writer would otherwise get wrong: an appendix takes the
    // passage where the glossary takes the words.
    expect(screen.getByText('the words you picked, as a term to define')).toBeTruthy();
    expect(screen.getByText('this passage, copied — the writing stays')).toBeTruthy();
  });
});

describe('adding a term to the glossary', () => {
  it('makes the glossary where the book has none, and says so before the press', () => {
    let seen: ProjectFile | null = null;
    render(<Writing format="novel" onFile={(file) => (seen = file)} />);
    rightClick();
    fireEvent.click(screen.getByText('Add to the glossary…'));

    // The page it would make is said in the sentence about the press, not
    // as a second notice under it.
    expect(screen.getByText(/Start a glossary at the back of the book/)).toBeTruthy();
    // The picked words arrive as the term and are the writer's to correct.
    fireEvent.change(screen.getByLabelText('The term'), { target: { value: 'Fresnel lens' } });
    fireEvent.click(screen.getByText('Add the term'));

    const page = partsOf(seen as unknown as ProjectFile).find((one) => one.kind === 'glossary')!;
    expect(page).toBeTruthy();
    expect(glossaryEntries(page).map((one) => one.term)).toEqual(['Fresnel lens']);
    expect(glossaryEntries(page)[0]!.definition).toBe('');
  });

  it('refuses a term the glossary already has, in a sentence rather than silently', () => {
    const made = book('novel');
    const with_ = addPart(made.file, 'glossary', {
      title: 'Glossary',
      about: { terms: [{ id: 'g1', term: 'Fresnel lens', definition: '' }] },
    });
    render(<Writing start={{ ...made, file: with_.file }} />);
    rightClick();
    fireEvent.click(screen.getByText('Add to the glossary…'));

    fireEvent.change(screen.getByLabelText('The term'), { target: { value: 'fresnel lens' } });
    expect(screen.getByText(/already in the glossary/)).toBeTruthy();
    expect((screen.getByText('Add the term') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('adding a passage to the appendix', () => {
  it('copies the passage in, leaving the writing where it was', () => {
    const made = book('novel');
    let seen: ProjectFile | null = null;
    render(<Writing start={made} onFile={(file) => (seen = file)} />);
    rightClick();
    fireEvent.click(screen.getByText('Add to the appendix…'));
    fireEvent.click(screen.getByText('Add the passage'));

    const file = seen as unknown as ProjectFile;
    const page = partsOf(file).find((one) => one.kind === 'appendix')!;
    expect(page.text).toBe('The Fresnel lens turned all night.');
    // The manuscript still has it: this copies, it never cuts.
    const beat = file.beats.find((one) => one.id === made.beatId)!;
    expect(beat.manuscript.elements[0]!.text).toBe('The Fresnel lens turned all night.');
  });

  it('has no picker over one appendix and a picker over two', () => {
    const made = book('novel');
    render(<Writing start={made} />);
    rightClick();
    fireEvent.click(screen.getByText('Add to the appendix…'));
    // Nothing to choose is not a control.
    expect(screen.queryByLabelText('Which appendix')).toBeNull();
    cleanup();

    const one = addPart(made.file, 'appendix', { title: 'Sources' });
    const two = addPart(one.file, 'appendix', { title: 'Tables' });
    render(<Writing start={{ ...made, file: two.file }} />);
    rightClick();
    fireEvent.click(screen.getByText('Add to the appendix…'));
    const picker = screen.getByLabelText('Which appendix') as HTMLSelectElement;
    expect([...picker.options].map((option) => option.text.trim())).toEqual([
      'Appendix A — Sources',
      'Appendix B — Tables',
    ]);
  });
});
