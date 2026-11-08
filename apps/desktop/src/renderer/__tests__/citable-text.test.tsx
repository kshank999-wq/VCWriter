// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { addPart, addReference, createProjectFile, partsOf, updatePart, type ProjectFile, type ProjectFormat } from '@vcwriter/domain';
import { CitableText } from '../components/citations/CitableText';

/**
 * Citing in a page's words (addendum 43 §13): a foreword's text box with Cite
 * beside it, a token placed at the cursor, listed by its note, opened by a
 * click and taken out again.
 */

afterEach(cleanup);

let latest: ProjectFile | null = null;

const start = (format: ProjectFormat = 'instructional') => {
  let file = createProjectFile({ title: 'The Sea', format });
  file = addReference(file, { title: 'On Tides', authors: ['Jones, Robert'] }).file;
  const added = addPart(file, 'foreword', { text: 'A word first.' });
  return { file: added.file, partId: added.partId! };
};

function Foreword({ initial, partId }: { initial: ProjectFile; partId: string }) {
  const [file, setFile] = useState(initial);
  latest = file;
  const part = partsOf(file).find((one) => one.id === partId)!;
  return (
    <CitableText
      file={file}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      aria-label="The part's text"
      value={part.text}
      onChange={(text) => setFile((current) => updatePart(current, partId, { text }))}
    />
  );
}

const words = () => partsOf(latest!).find((one) => one.kind === 'foreword')!.text;
const box = () => screen.getByLabelText("The part's text") as HTMLTextAreaElement;

describe('citing in a page’s words', () => {
  it('places a citation at the cursor, says which note it is, and opens it from a click inside it', () => {
    const { file, partId } = start();
    render(<Foreword initial={file} partId={partId} />);
    box().setSelectionRange(6, 6);
    fireEvent.click(screen.getByRole('button', { name: 'Cite…' }));
    fireEvent.doubleClick(within(screen.getByRole('listbox', { name: 'Sources' })).getByRole('option'));
    const key = latest!.citations[0]!.key;
    expect(words()).toBe(`A word[^${key}] first.`);
    expect(screen.getByLabelText('Citations in these words').textContent).toBe(`[^${key}] is note 1`);

    // Ctrl+Shift+C cites at the cursor too.
    box().setSelectionRange(words().length, words().length);
    fireEvent.keyDown(box(), { key: 'C', ctrlKey: true, shiftKey: true });
    fireEvent.doubleClick(within(screen.getByRole('listbox', { name: 'Sources' })).getByRole('option'));
    expect(latest!.citations).toHaveLength(2);

    // A click inside the first token opens it; Remove takes it out.
    box().setSelectionRange(9, 9);
    fireEvent.click(box());
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Citation' })).getByRole('button', { name: 'Remove citation' }));
    expect(words()).toBe(`A word first.[^${latest!.citations[1]!.key}]`);
  });

  it('is the plain box on a book that does not cite', () => {
    const { file, partId } = start('novel');
    render(<Foreword initial={file} partId={partId} />);
    expect(screen.queryByRole('button', { name: 'Cite…' })).toBeNull();
  });
});
