// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  beatsForUnit,
  createProjectFile,
  lineTypeOf,
  setByWriter,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { BeatBody } from '../components/BeatBody';

/**
 * **The writing screen's toolbar** (addendum 02 §19a, from Ken: *I imported
 * some text that was italicized and I realized that there's no way to adjust
 * the style of the text in the beats… Put a toolbar on the top of the beats
 * screen*).
 *
 * The domain's own suite says what a line of type carries and what the page
 * does with it. What this pins is the **gesture** (§15a), which is the whole
 * of the report: emphasis, alignment and size were all built and all
 * printed, written by the Word importer and reachable by nobody, and the
 * keys had worked since the editor was written with nothing on the screen
 * saying so — addendum 29 §2's lesson, where *the act worked, every test
 * passed, and there was no way to see it was there*.
 *
 * So every assertion here is about a writer getting at it.
 */

afterEach(cleanup);

const ELEMENT = 'a1111111-1111-4111-8111-111111111111';

const started = (format: ProjectFormat): ProjectFile => {
  const file = createProjectFile({ title: 'The Lamp', format, author: 'K. Shank' });
  const unit = unitsInStoryOrder(file)[0]!;
  const beat = beatsForUnit(file, unit.id)[0]!;
  return updateBeat(file, beat.id, {
    manuscript: {
      elements: [
        {
          id: ELEMENT as never,
          type: format === 'screenplay' ? 'action' : 'paragraph',
          text: 'She lifted the lamp.',
          characterId: null,
          attributes: {},
        },
      ],
    },
  });
};

let latest: ProjectFile | null = null;

/**
 * The writing screen's own chrome, cut to the two things that matter: a slot
 * off the paper, and the body that fills it. It is `BeatWriter`'s shape —
 * §8c's *a slot, never a second control* — so what is asserted about the
 * portal is what really happens there.
 */
function Writing({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  const [tools, setTools] = useState<HTMLElement | null>(null);
  latest = file;
  const unit = unitsInStoryOrder(file)[0]!;
  const beat = beatsForUnit(file, unit.id)[0]!;
  return (
    <>
      <div className="writer-tools" data-testid="slot" ref={setTools} />
      <BeatBody
        file={file}
        beat={beat}
        onUpdate={(mutate) => setFile((current) => mutate(current))}
        toolbar
        dictationSlot={tools}
      />
    </>
  );
}

/** The element as it now stands, which is what the press wrote. */
const elementNow = () =>
  (latest as ProjectFile).beats.flatMap((beat) => beat.manuscript.elements).find((one) => (one.id as string) === ELEMENT)!;

/** Put the cursor in the line, as a writer does before reaching for a control. */
const cursorInLine = (start = 0, end = 0) => {
  const box = screen.getByDisplayValue('She lifted the lamp.') as HTMLTextAreaElement;
  fireEvent.focus(box);
  box.setSelectionRange(start, end);
  return box;
};

describe('reaching the emphasis that already worked', () => {
  it('puts the marks on from a button, the way the keys always did', () => {
    render(<Writing initial={started('novel')} />);
    cursorInLine(11, 14);
    fireEvent.click(screen.getByLabelText('Italic'));
    expect(elementNow().text).toBe('She lifted *the* lamp.');
  });

  it('says the key on the button, which is how anybody finds it', () => {
    /**
     * The point of the three buttons: Ctrl/Cmd+B, I and U have been there
     * all along. A writer who never learns that is a writer for whom the
     * feature does not exist.
     */
    render(<Writing initial={started('novel')} />);
    expect(screen.getByLabelText('Bold').getAttribute('title')).toMatch(/Ctrl\/Cmd\+B/);
  });

  it('stands in the slot off the paper, never on the manuscript', () => {
    /**
     * §8c took the Dictate button off the page because *the paper is the one
     * surface in this program that should hold nothing but somebody's
     * words*. A toolbar is the same kind of thing and goes the same way —
     * and it is the part that can fail silently, a control that never
     * arrives because the node was not passed down looking exactly like the
     * feature not being there (§15a).
     */
    render(<Writing initial={started('novel')} />);
    const slot = screen.getByTestId('slot');
    expect(within(slot).getByLabelText('Bold')).toBeTruthy();
    expect(within(slot).getByLabelText('Centred')).toBeTruthy();
  });
});

describe('the type, which nothing could reach at all', () => {
  it('ranges the paragraph the cursor is in', () => {
    render(<Writing initial={started('novel')} />);
    cursorInLine();
    fireEvent.click(screen.getByLabelText('Centred'));
    expect(lineTypeOf(elementNow()).align).toBe('center');
  });

  it('puts it back with the control that set it', () => {
    /**
     * There is no *none* chip to reach for, so a press on the one already on
     * clears it — a writer who centred a paragraph by mistake must be able
     * to undo it with the control they used.
     */
    render(<Writing initial={started('novel')} />);
    cursorInLine();
    fireEvent.click(screen.getByLabelText('Centred'));
    fireEvent.click(screen.getByLabelText('Centred'));
    expect(lineTypeOf(elementNow()).align).toBeNull();
    // And it is cleared rather than set to a default: null is no attribute.
    expect('align' in elementNow().attributes).toBe(false);
  });

  it('sets a size and stamps it as the writer’s', () => {
    render(<Writing initial={started('novel')} />);
    cursorInLine();
    fireEvent.change(screen.getByLabelText('Text size'), { target: { value: '18' } });
    expect(lineTypeOf(elementNow()).size).toBe(18);
    expect(setByWriter(elementNow())).toBe(true);
  });

  it('inks it, and the first option is the book’s own', () => {
    render(<Writing initial={started('novel')} />);
    cursorInLine();
    expect((screen.getByLabelText('Text size') as HTMLSelectElement).value).toBe('');
    fireEvent.click(screen.getByLabelText('Red'));
    expect(lineTypeOf(elementNow()).colour).toBe('#b4232a');
    fireEvent.click(screen.getByLabelText('Default ink'));
    expect(lineTypeOf(elementNow()).colour).toBeNull();
  });

  it('keeps the line after the press, so two controls are one trip', () => {
    /**
     * A press on a toolbar takes focus off the writing, so a toolbar that
     * read *what is focused now* would find itself. The line is remembered,
     * which is what lets somebody press **Centred** and then **18 pt**
     * without clicking back into the paragraph between them.
     */
    render(<Writing initial={started('novel')} />);
    cursorInLine();
    fireEvent.click(screen.getByLabelText('Centred'));
    fireEvent.blur(screen.getByDisplayValue('She lifted the lamp.'));
    fireEvent.change(screen.getByLabelText('Text size'), { target: { value: '14' } });
    expect(lineTypeOf(elementNow())).toEqual({ align: 'center', size: 14, colour: null });
  });
});

describe('which format gets which half', () => {
  it('gives a screenplay the marks and not the type', () => {
    /**
     * Ken's own split (*especially for novels, short stories, and
     * instructional books. That will not be needed in scripts, episodic, or
     * short form*). Emphasis is Fountain's own and a screenplay uses it; a
     * paragraph set in 18 point and centred is not a screenplay, so those
     * are **absent rather than greyed**, this room's idiom for *this does
     * not apply here*.
     */
    render(<Writing initial={started('screenplay')} />);
    expect(screen.getByLabelText('Bold')).toBeTruthy();
    expect(screen.queryByLabelText('Centred')).toBeNull();
    expect(screen.queryByLabelText('Text size')).toBeNull();
    expect(screen.queryByLabelText('Red')).toBeNull();
  });

  it('gives a book both', () => {
    render(<Writing initial={started('instructional')} />);
    expect(screen.getByLabelText('Bold')).toBeTruthy();
    expect(screen.getByLabelText('Justified')).toBeTruthy();
  });
});
