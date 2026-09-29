// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createProjectFile, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { BeatBody } from '../components/BeatBody';

/**
 * Dictation in the writing areas (spec §9), through the component.
 *
 * The reading itself is tested in the domain (`spoken-script.ts`). What these
 * cover is the wiring, and one thing about it in particular: **the writing
 * rules live on keydown, and dictated text never presses a key.** Return and
 * Tab are handled in `handleKeyDown`; text that arrives from a recogniser or
 * from the system's dictation goes straight into the field. Without the path
 * these exercise, a dictated scene would be one action paragraph with newlines
 * buried in it.
 */

afterEach(cleanup);

class FakeRecognition {
  static made: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.made.push(this);
  }

  start(): void {}
  stop(): void {
    this.onend?.();
  }

  say(text: string): void {
    const result = Object.assign([{ transcript: text }], { isFinal: true });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
}

/**
 * Say something, and let React settle before looking.
 *
 * A recogniser fires outside React's event system, so the state it sets is not
 * flushed by the time the next line runs — which is true of the real one too.
 */
const say = (text: string) =>
  act(() => {
    (FakeRecognition.made[FakeRecognition.made.length - 1] as FakeRecognition).say(text);
  });

beforeEach(() => {
  FakeRecognition.made = [];
  // No `window.vcwriter`, so the renderer reads as the browser preview and
  // offers the recogniser rather than naming an operating-system key.
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
});

const started = (): ProjectFile => {
  const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  return updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [
        {
          id: 'a1111111-1111-4111-8111-111111111111' as never,
          type: 'action',
          text: '',
          characterId: null,
          attributes: {},
        },
      ],
    },
  });
};

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  return (
    <BeatBody
      file={file}
      beat={file.beats[0]!}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      dictation
    />
  );
}

/** The manuscript as [type, text] pairs, which is what these are all about. */
const written = (): Array<[string, string]> =>
  [...document.querySelectorAll('.element')].map((row) => [
    (row.querySelector('.element-type') as HTMLSelectElement).value,
    (row.querySelector('textarea') as HTMLTextAreaElement).value,
  ]);

describe('dictating a scene', () => {
  it('lays a whole scene out as typed elements', () => {
    render(<Harness initial={started()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }));

    say(
      'Scene heading. Interior kitchen, night. Action. She opens the fridge. ' +
        'Character. Mara. Dialogue. There is nothing in here.',
    );

    expect(written()).toEqual([
      ['scene_heading', 'Interior kitchen, night.'],
      ['action', 'She opens the fridge.'],
      ['character', 'Mara'],
      ['dialogue', 'There is nothing in here.'],
    ]);
  });

  it('adds ordinary dictation to the line being written', () => {
    render(<Harness initial={started()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }));

    say('She crosses to the window.');
    say('The rain has stopped.');

    // One element, not two: nothing structural was said.
    expect(written()).toEqual([['action', 'She crosses to the window. The rain has stopped.']]);
  });

  it('carries on into the line it just made', () => {
    // A writer dictates a scene in more than one breath. Without this, the
    // second breath lands back on the line the first one started from.
    render(<Harness initial={started()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }));

    say('Character. Mara.');
    say('Dialogue. There is nothing in here.');
    say('It has been empty for a week.');

    expect(written()).toEqual([
      ['character', 'Mara'],
      ['dialogue', 'There is nothing in here. It has been empty for a week.'],
    ]);
  });

  it('brackets a parenthetical, because that is what the style does', () => {
    render(<Harness initial={started()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }));

    say('Parenthetical. under her breath');

    expect(written()).toEqual([['parenthetical', '(under her breath)']]);
  });

  it('does not act on a style word used in a sentence', () => {
    render(<Harness initial={started()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }));

    say('The action was over by the time she got there.');

    expect(written()).toEqual([['action', 'The action was over by the time she got there.']]);
  });

  it('stops when the writer clicks again', () => {
    render(<Harness initial={started()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }));
    fireEvent.click(screen.getByRole('button', { name: /Listening/ }));

    expect(screen.getByRole('button', { name: 'Dictate' })).toBeTruthy();
  });

  it('draws into the slot the surface gives it, and nowhere on the page', () => {
    // §8c, from Ken: *move the dictate button to just below where it says in
    // script… but off of the page. I don't want distractions when people are
    // writing.* The writing screen hands `BeatBody` somewhere better than the
    // manuscript to put it, and the control goes there whole — one
    // implementation moved, never a second one built in the chrome.
    //
    // Worth its own test because the slot is the one part of this that can
    // fail silently: a button that never arrives looks exactly like dictation
    // not being there at all.
    function Slotted({ initial }: { initial: ProjectFile }) {
      const [file, setFile] = useState(initial);
      const [slot, setSlot] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div data-testid="tools" ref={setSlot} />
          <div data-testid="paper">
            <BeatBody
              file={file}
              beat={file.beats[0]!}
              onUpdate={(mutate) => setFile((current) => mutate(current))}
              dictation
              dictationSlot={slot}
            />
          </div>
        </>
      );
    }

    render(<Slotted initial={started()} />);
    const button = screen.getByRole('button', { name: 'Dictate' });
    expect(screen.getByTestId('tools').contains(button)).toBe(true);
    expect(screen.getByTestId('paper').contains(button)).toBe(false);
    // And it is the same working control, not a decoration in the bar.
    fireEvent.click(button);
    say('Scene heading. Interior kitchen, night.');
    expect(written()).toEqual([['scene_heading', 'Interior kitchen, night.']]);
  });

  it('is a toggle with the instructions in its tooltip, not on the page', () => {
    // From Ken: *a button in the corner that you can turn on and off, with a
    // little microphone that says dictate… when you hold your cursor over it,
    // a tooltip comes up with the instructions that are now shown on the
    // screen. It would be too distracting for a writer.*
    render(<Harness initial={started()} />);
    const button = screen.getByRole('button', { name: 'Dictate' });

    // The five spoken styles are in the tooltip and nowhere on the page. This
    // is the whole of the ask, so it is asserted from both ends.
    expect(button.getAttribute('title')).toContain('Scene heading');
    expect(button.getAttribute('title')).toContain('Parenthetical');
    expect(screen.queryByText(/Say .*Scene heading/)).toBeNull();

    // A real on/off, said to a screen reader as well as drawn.
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: /Listening/ }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('the system’s own dictation', () => {
  it('re-types a line break typed into the field, which Return never sees', () => {
    // This is the path that matters in Electron: the operating system types
    // into the focused field, so "new line" arrives as a newline character
    // rather than as a keypress the editor could have handled.
    render(<Harness initial={started()} />);
    const field = document.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: 'She waits.\nThe door opens.' } });

    expect(written()).toEqual([
      ['action', 'She waits.'],
      ['action', 'The door opens.'],
    ]);
  });

  it('leaves ordinary typing alone', () => {
    render(<Harness initial={started()} />);
    const field = document.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: 'She waits.' } });

    expect(written()).toEqual([['action', 'She waits.']]);
  });
});

/**
 * Last on purpose: what a failed session establishes is remembered for the run
 * of the app, so this must not run before the tests that need the button.
 */
describe('finding out there is no speech service', () => {
  it('names the system’s dictation once a session dies for want of one', () => {
    // What Electron does every time: the constructor is there and the service
    // behind it is not. The app finds out by trying, because the bridge is
    // deliberately identical in both places and must not be sniffed to guess
    // the platform.
    render(<Harness initial={started()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }));

    act(() => {
      (FakeRecognition.made.at(-1) as FakeRecognition).onerror?.({ error: 'network' });
    });

    expect(screen.getByText(/No speech service in this build/)).toBeTruthy();
    // And it does not invite a second press at a button that cannot work.
    expect(screen.queryByRole('button', { name: 'Dictate' })).toBeNull();
    expect(screen.getByText(/put the cursor in a line/)).toBeTruthy();
  });
});
