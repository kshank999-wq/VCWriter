// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { addCharacter, createProjectFile, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { EditorPanel } from '../components/EditorPanel';
import { ReadBackPanel } from '../components/ReadBackPanel';

/**
 * The editors and read-back through the interface.
 *
 * The rules themselves are tested in the domain; what these cover is that a
 * finding reaches the writer, that Fix and Dismiss do what they say, that the
 * Final Editor does not claim to know whether a scene turns, and that
 * read-back reflects the voices actually assigned.
 */

afterEach(cleanup);

const scriptWithProblems = (): ProjectFile => {
  const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  return updateBeat(file, file.beats[0]!.id, {
    status: 'written',
    manuscript: {
      elements: [
        {
          id: 'e1111111-1111-4111-8111-111111111111' as never,
          type: 'scene_heading',
          text: 'INT. LIGHTHOUSE - NIGHT',
          characterId: null,
          attributes: {},
        },
        {
          id: 'e2222222-2222-4222-8222-222222222222' as never,
          type: 'action',
          text: 'She opens the the door.',
          characterId: null,
          attributes: {},
        },
      ],
    },
  });
};

function EditorHarness({ initial, signedIn = false }: { initial: ProjectFile; signedIn?: boolean }) {
  const [file, setFile] = useState(initial);
  return (
    <EditorPanel
      file={file}
      currentUnitId={file.units[0]!.id}
      signedIn={signedIn}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

describe('daily editor panel', () => {
  it('shows a mechanical finding and fixes it in place', () => {
    render(<EditorHarness initial={scriptWithProblems()} />);

    expect(screen.getByText(/"the" is repeated/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Fix' }));

    expect(screen.queryByText(/"the" is repeated/i)).toBeNull();
  });

  it('keeps a dismissed finding dismissed when the pass re-runs', () => {
    render(<EditorHarness initial={scriptWithProblems()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/"the" is repeated/i)).toBeNull();

    // Toggling an option re-runs the pass; the dismissal must survive it.
    fireEvent.click(screen.getByLabelText(/include style notes/i));
    fireEvent.click(screen.getByLabelText(/include style notes/i));
    expect(screen.queryByText(/"the" is repeated/i)).toBeNull();
  });

  it('marks opinions as style rather than errors', () => {
    // An action line whose only problem is a matter of taste.
    const base = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    const styled = updateBeat(base, base.beats[0]!.id, {
      manuscript: {
        elements: [
          {
            id: 'e3333333-3333-4333-8333-333333333333' as never,
            type: 'action',
            text: 'He begins to walk away.',
            characterId: null,
            attributes: {},
          },
        ],
      },
    });
    render(<EditorHarness initial={styled} />);
    expect(screen.getByText('style')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Fix' })).toBeNull();
  });
});

describe('final editor panel', () => {
  it('lists the scenes and says plainly that the turn has not been read', () => {
    render(<EditorHarness initial={scriptWithProblems()} />);
    fireEvent.click(screen.getByRole('tab', { name: /final/i }));

    expect(screen.getByText(/scene by scene/i)).toBeDefined();
    expect(screen.getByText(/has not been read yet/i)).toBeDefined();
  });

  it('does not offer a structural read when signed out', () => {
    render(<EditorHarness initial={scriptWithProblems()} />);
    fireEvent.click(screen.getByRole('tab', { name: /final/i }));

    expect((screen.getByRole('button', { name: 'Read scene' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('read back panel', () => {
  const voices = [
    { voiceURI: 'v-daniel', name: 'Daniel', lang: 'en-GB' },
    { voiceURI: 'v-samantha', name: 'Samantha', lang: 'en-US' },
  ];

  beforeEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => voices,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        speak: vi.fn(),
        cancel: vi.fn(),
      },
    });
  });

  function ReadBackHarness({ initial }: { initial: ProjectFile }) {
    const [file, setFile] = useState(initial);
    return (
      <ReadBackPanel
        file={file}
        currentUnitId={file.units[0]!.id}
        onUpdate={(mutate) => setFile((current) => mutate(current))}
      />
    );
  }

  const withCast = (): ProjectFile => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = addCharacter(file, { name: 'Marisol' });
    return updateBeat(file, file.beats[0]!.id, {
      manuscript: {
        elements: [
          {
            id: 'e4444444-4444-4444-8444-444444444444' as never,
            type: 'character',
            text: 'MARISOL',
            characterId: file.characters[0]!.id,
            attributes: {},
          },
          {
            id: 'e5555555-5555-4555-8555-555555555555' as never,
            type: 'dialogue',
            text: 'You should not have come back.',
            characterId: null,
            attributes: {},
          },
        ],
      },
    });
  };

  it('offers the system voices, described where they are known', () => {
    render(<ReadBackHarness initial={withCast()} />);

    const picker = screen.getByLabelText('Voice for Marisol');
    expect(within(picker).getByText(/Daniel · British · male/)).toBeDefined();
    expect(within(picker).getByText(/Samantha · American · female/)).toBeDefined();
  });

  it('says which characters have no voice yet rather than silently narrating them', () => {
    render(<ReadBackHarness initial={withCast()} />);
    expect(screen.getByText(/Marisol has no voice yet/)).toBeDefined();
  });

  it('assigns a voice and stops warning about it', () => {
    render(<ReadBackHarness initial={withCast()} />);

    fireEvent.change(screen.getByLabelText('Voice for Marisol'), { target: { value: 'v-samantha' } });

    expect(screen.queryByText(/has no voice yet/)).toBeNull();
  });

  it('fills the whole cast in one click', () => {
    render(<ReadBackHarness initial={withCast()} />);

    fireEvent.click(screen.getByRole('button', { name: /suggest a cast/i }));

    expect((screen.getByLabelText('Voice for Marisol') as HTMLSelectElement).value).not.toBe('');
  });
});
