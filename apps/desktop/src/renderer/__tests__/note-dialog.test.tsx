// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createProjectFile, type ProjectFile } from '@vcwriter/domain';
import { ResearchBody } from '../components/ResearchWindow';

/**
 * The note's own screen, in the middle (addendum 28 §6).
 *
 * From Ken: *when you create a note, I would like a dialog box in the center
 * that you can type into… trying to type it into the sidebar, it just doesn't
 * feel right.*
 *
 * **What is pinned is the gesture, not the dialog** — addendum 20 §15a's rule,
 * which this room has now been taught twice. The screen can be perfect and the
 * complaint stands if *+ Note* still leaves a writer hunting for a box: so what
 * these assert is that the press opens it, that the cursor is *in* it, and that
 * what is typed reaches the note. A dialog nobody is put inside reads exactly
 * like the one that was there before.
 */

afterEach(cleanup);

function Room({ start }: { start: ProjectFile }) {
  const [file, setFile] = useState(start);
  return (
    <ResearchBody
      file={file}
      currentBeatId={null}
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

const project = () => createProjectFile({ title: 'Notes', format: 'screenplay' });

const dialog = () => document.querySelector('dialog.note-dialog');
const open = () => dialog()?.hasAttribute('open') ?? false;

/**
 * The **card**, rather than anywhere on the screen. A note's title is also an
 * option in the Related picker, which is the note being linkable and not a
 * second copy of it — so what these assert is the card, which is the note read
 * back.
 */
const cardTitle = (words: string) => screen.getByText(words, { selector: '.research-card-title' });

describe('writing a note', () => {
  it('is not open until there is a note to write', () => {
    render(<Room start={project()} />);
    expect(open()).toBe(false);
  });

  /** The press Ken is complaining about. */
  it('opens in the middle when a note is made, with the cursor in it', () => {
    render(<Room start={project()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Note' }));

    expect(open()).toBe(true);

    // **In the dialog, not merely somewhere on the screen.** Before this, the
    // press left focus on the + Note button and the writer went looking.
    const focused = document.activeElement as HTMLInputElement | null;
    expect(focused?.tagName).toBe('INPUT');
    expect(focused?.closest('dialog.note-dialog')).toBeTruthy();

    // And selected, so the first keystroke replaces the name the program gave
    // it rather than appending to it (addendum 20 §16e).
    expect(focused?.value).toBe('New note');
    expect(focused?.selectionStart).toBe(0);
    expect(focused?.selectionEnd).toBe('New note'.length);
  });

  it('what is typed in it is the note', () => {
    render(<Room start={project()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Note' }));

    const box = dialog()!;
    fireEvent.change(box.querySelector('input')!, { target: { value: 'Miller house at night' } });
    fireEvent.change(box.querySelector('textarea')!, { target: { value: 'Peeling paint.' } });

    // The card is the note read back, so it is the honest place to look.
    expect(cardTitle('Miller house at night')).toBeTruthy();
    expect(screen.getByText('Peeling paint.', { selector: '.research-card-body' })).toBeTruthy();
  });

  it('closes on the ×, and the note stays', () => {
    render(<Room start={project()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Note' }));
    fireEvent.change(dialog()!.querySelector('input')!, { target: { value: 'Kept' } });

    fireEvent.click(screen.getByRole('button', { name: 'Close the note' }));
    expect(open()).toBe(false);
    expect(cardTitle('Kept')).toBeTruthy();
  });

  /**
   * The program's own gesture for *open the thing* — the beat, the part, the
   * chapter page, a contents box. The writing takes the cursor here because the
   * note is named already: **the act decides where the cursor goes**, which is
   * addendum 25 §4e's `onOpenCharacter` one room over.
   */
  it('reopens on a double-click, with the cursor in the writing', () => {
    render(<Room start={project()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Note' }));
    fireEvent.change(dialog()!.querySelector('input')!, { target: { value: 'Miller house' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close the note' }));
    expect(open()).toBe(false);

    fireEvent.doubleClick(cardTitle('Miller house'));

    expect(open()).toBe(true);
    const focused = document.activeElement;
    expect(focused?.tagName).toBe('TEXTAREA');
    expect(focused?.closest('dialog.note-dialog')).toBeTruthy();
  });

  /**
   * **One component, two places** (addendum 20 §16d): the dialog and the aside
   * draw `NoteFields`, so there is one answer to what a note is. What this
   * asserts is the half that would be a *second* answer — that the words are
   * the same words, rather than two boxes that could drift.
   */
  it('shows the same note in the aside it shows in the middle', () => {
    render(<Room start={project()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Note' }));
    fireEvent.change(dialog()!.querySelector('input')!, { target: { value: 'One note' } });

    const aside = document.querySelector('.research-detail')!;
    expect((aside.querySelector('input') as HTMLInputElement).value).toBe('One note');
    expect((dialog()!.querySelector('input') as HTMLInputElement).value).toBe('One note');
  });
});
