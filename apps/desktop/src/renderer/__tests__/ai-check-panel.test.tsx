// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createProjectFile, editReviewOf, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { AiCheckPanel } from '../components/AiCheckPanel';

/**
 * The AI check (addendum 47): it shows what a check costs and what the writer
 * has before anything is sent, and its findings join the review with no fix.
 */
afterEach(() => {
  cleanup();
  delete (window as { vcwriter?: unknown }).vcwriter;
});

const ID = '00000000-0000-4000-8000-000000000001';
const para = (id: string, text: string) => ({ id: id as never, type: 'paragraph' as const, text, characterId: null, attributes: {} });
const book = (): ProjectFile => {
  const file = createProjectFile({ title: 'Book', format: 'novel' });
  return updateBeat(file, file.beats[0]!.id, { manuscript: { elements: [para(ID, 'One was to Harry. He would read it in the morning.')] } });
};

let latest: ProjectFile;
function Panel({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return <AiCheckPanel file={file} scope={{ kind: 'all' }} scopeName="The whole project" onUpdate={(mutate) => setFile((current) => mutate(current))} onClose={() => undefined} onDone={() => undefined} />;
}

describe('the AI check', () => {
  it('says what it costs and refuses to start without enough credits', async () => {
    const deepCheck = vi.fn();
    (window as { vcwriter?: unknown }).vcwriter = {
      editCredits: async () => ({ ok: true, data: { signedIn: true, configured: true, balance: 500 } }),
      deepCheck,
    };
    render(<Panel initial={book()} />);
    await waitFor(() => expect(screen.getByText('0.5 credits')).toBeTruthy());
    expect(screen.getByText('1 credits')).toBeTruthy();
    expect(screen.getByText(/You need 0.5 more credits/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Check for 1 credits/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(deepCheck).not.toHaveBeenCalled();
  });

  it('adds what the check found to the review, with nothing to accept', async () => {
    (window as { vcwriter?: unknown }).vcwriter = {
      editCredits: async () => ({ ok: true, data: { signedIn: true, configured: true, balance: 20_000 } }),
      deepCheck: async (input: { lines: { id: string; text: string }[] }) => {
        expect(input.lines.map((one) => one.text)).toEqual(['One was to Harry. He would read it in the morning.']);
        return {
          ok: true,
          data: {
            findings: [{ elementId: ID, quote: 'He would read it', start: 18, end: 34, check: 'pronoun', severity: 'concern', confidence: 'high', message: '“He” could be Harry or someone else.', why: 'Two men are near.' }],
            words: 10,
            charged: 1000,
            balance: 19_000,
          },
        };
      },
    };
    render(<Panel initial={book()} />);
    const start = await screen.findByRole('button', { name: /Check for 1 credits/ });
    await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
    await act(async () => {
      fireEvent.click(start);
    });
    await waitFor(() => expect(editReviewOf(latest).findings).toHaveLength(1));
    expect(editReviewOf(latest).findings[0]).toMatchObject({ source: 'ai', ruleId: 'ai-pronoun', category: 'clarity', fix: null, quote: 'He would read it' });
    expect(latest.beats[0]!.manuscript.elements[0]!.text).toBe('One was to Harry. He would read it in the morning.');
  });
});
