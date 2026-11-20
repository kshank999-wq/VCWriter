// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createProjectFile, editReviewOf, runEditCheck, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { EditCheckPanel } from '../components/EditCheckPanel';

/**
 * The Edit Check's review screen (editor spec §5): a queue, the passage, and
 * the writer's decisions. Nothing changes until they act; a fix is the
 * finding's own narrow fix.
 */
vi.mock('../grammar-check', () => ({ grammarHits: async () => [] }));

afterEach(cleanup);

const para = (id: string, text: string) => ({ id: id as never, type: 'paragraph' as const, text, characterId: null, attributes: {} });

const book = (): ProjectFile => {
  let file = createProjectFile({ title: 'Book', format: 'novel' });
  return updateBeat(file, file.beats[0]!.id, {
    manuscript: { elements: [para('00000000-0000-4000-8000-000000000001', 'It was  dark. The ball was thrown by Tom.')] },
  });
};

let latest: ProjectFile;
function Panel({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return <EditCheckPanel file={file} onUpdate={(mutate) => setFile((current) => mutate(current))} currentUnitId={null} currentBeatId={null} onGoTo={() => undefined} />;
}

const text = () => latest.beats[0]!.manuscript.elements[0]!.text;

describe('the Edit Check screen', () => {
  it('runs a check without changing the manuscript, then fixes only what is accepted', async () => {
    render(<Panel initial={book()} />);
    expect(screen.getByText('Check your writing')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run Edit Check' }));
    });
    await waitFor(() => expect(editReviewOf(latest).checkedAt).not.toBeNull());
    expect(text()).toBe('It was  dark. The ball was thrown by Tom.');

    // The doubled space is first: an error with a narrow fix.
    fireEvent.click(screen.getByRole('button', { name: /Accept fix/ }));
    expect(text()).toBe('It was dark. The ball was thrown by Tom.');

    // The passive voice is a note: no fix, only the writer's decisions.
    const passive = screen.getAllByRole('button').find((one) => one.textContent?.includes('Possibly passive voice'))!;
    fireEvent.click(passive);
    expect(screen.queryByRole('button', { name: /Accept fix/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mark intentional' }));
    const review = editReviewOf(latest);
    expect(Object.values(review.decisions).map((one) => one.status)).toContain('intentional');
    expect(text()).toBe('It was dark. The ball was thrown by Tom.');
  });

  it('offers no way to fix every finding at once', () => {
    render(<Panel initial={runEditCheck(book())} />);
    expect(screen.queryByRole('button', { name: /Fix all|Accept all/i })).toBeNull();
  });
});
