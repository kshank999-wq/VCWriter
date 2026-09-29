// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  captureItemSchema,
  createProjectFile,
  newId,
  type CaptureItem,
  type CaptureItemId,
  type UserId,
} from '@vcwriter/domain';
import { ResearchShelf } from '../components/ResearchShelf';

/**
 * The phone's notes on the shelf inside the Outliner and the Sculptor
 * (addendum 09 §15).
 *
 * `cast-surfaces`' shape: what can go wrong is not the carrying — the domain
 * is tested for what a drop does — but a room that is handed the notes and
 * draws none of them, which reads exactly like the feature not being there.
 * That is the failure this whole revision was reported as.
 */

let tick = 0;
const note = (text: string, category = 'idea'): CaptureItem =>
  captureItemSchema.parse({
    id: newId<CaptureItemId>(),
    userId: newId<UserId>(),
    source: 'mobile_voice',
    capturedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, (tick += 1))).toISOString(),
    rawText: text,
    category,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

const draw = (notes: CaptureItem[], onCarry = vi.fn()) => {
  const file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  render(<ResearchShelf file={file} from="outline" reveal={null} notes={notes} onCarry={onCarry} />);
  return { onCarry, notes };
};

afterEach(cleanup);

describe('the phone, on the research shelf', () => {
  it('offers a tab with the count on it, and lists what is waiting', () => {
    draw([note('a bell rings and nobody in the house moves'), note('the kitchen is too small')]);

    fireEvent.click(screen.getByRole('tab', { name: 'Phone 2' }));
    expect(screen.getByText(/a bell rings/)).toBeTruthy();
    expect(screen.getByText(/the kitchen is too small/)).toBeTruthy();
  });

  it('is absent where nothing is waiting', () => {
    // A tab over nothing teaches somebody the shelf is empty.
    draw([]);
    expect(screen.queryByRole('tab', { name: /Phone/ })).toBeNull();
  });

  it('names the kind in the format’s own words', () => {
    draw([note('the kitchen, before anybody arrives', 'unit')]);
    fireEvent.click(screen.getByRole('tab', { name: 'Phone 1' }));
    // A screenplay's unit is a Scene, not *Scene or chapter*.
    expect(screen.getByText('Scene')).toBeTruthy();
  });

  it('carries the note itself, so the room knows which one landed', () => {
    const { onCarry, notes } = draw([note('a bell rings')]);
    fireEvent.click(screen.getByRole('tab', { name: 'Phone 1' }));

    const row = screen.getByText(/a bell rings/).closest('[draggable]') as HTMLElement;
    fireEvent.dragStart(row, {
      dataTransfer: { setData: vi.fn(), types: [], effectAllowed: 'none' },
    });
    expect(onCarry).toHaveBeenCalledWith({ kind: 'note', id: notes[0]?.id });
  });

  it('says why the notes could not be read, where it happened', () => {
    const file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    render(
      <ResearchShelf
        file={file}
        from="outline"
        reveal={null}
        notes={[note('a bell rings')]}
        notesError="No signal"
        onCarry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Phone 1' }));
    expect(screen.getByText('No signal')).toBeTruthy();
  });
});
