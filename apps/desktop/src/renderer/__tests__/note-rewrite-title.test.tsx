// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addResearchItem, createProjectFile, type ProjectFile } from '@vcwriter/domain';
import { NoteRewrite } from '../components/NoteRewrite';

/**
 * The title of a note is retyped in the window it opens in (from Ken: *a lot
 * of times it's dictated in and it's wrong, or misspelled*).
 */
afterEach(cleanup);

let latest: ProjectFile | null = null;

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  latest = file;
  const item = file.researchItems.at(-1)!;
  return <NoteRewrite file={file} item={item} currentBeatId={null} onClose={() => undefined} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

describe('a note opened in Research', () => {
  it('lets the dictated title be retyped, and keeps it', () => {
    const base = createProjectFile({ title: 'Guide', format: 'instructional' });
    const folder = base.researchCategories[0]!;
    const file = addResearchItem(base, { categoryId: folder.id, title: 'Constructing sentences ad verbs', body: 'If you use an adverb, make it fight the verb.' });
    render(<Harness initial={file} />);
    const title = screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;
    expect(title.value).toBe('Constructing sentences ad verbs');
    fireEvent.change(title, { target: { value: 'Constructing sentences: adverbs' } });
    expect(latest!.researchItems.at(-1)!.title).toBe('Constructing sentences: adverbs');
  });
});
