// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  createProjectFile,
  recordWriting,
  updateBeat,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { Reports } from '../components/Reports';
import { Welcome } from '../components/Welcome';
import { useWritingClock } from '../use-writing-clock';

/**
 * The Reports menu and the clock behind it (addendum 02 §15), and the two
 * formats offered on the way in (§14).
 */

afterEach(cleanup);

const project = (format: ProjectFormat = 'screenplay'): ProjectFile => {
  const file = createProjectFile({ title: 'Lighthouse', format });
  return updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [
        { id: 'e1' as never, type: 'action', text: 'one two three four five', characterId: null, attributes: {} },
      ],
    },
  });
};

/** Two sittings a day apart, so the log has something to show. */
const withLog = (): ProjectFile => {
  const day = (iso: string, file: ProjectFile) => {
    let next = recordWriting(file, iso);
    // A tick a few minutes later keeps it one sitting.
    next = recordWriting(next, new Date(Date.parse(iso) + 4 * 60_000).toISOString());
    return next;
  };
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return day(new Date().toISOString(), day(yesterday, project()));
};

describe('the writing log', () => {
  it('shows the figures and a row for each day worked', () => {
    render(
      <Reports file={withLog()} open="writing" onClose={() => {}} onTab={() => {}} printOptions={{}} />,
    );
    expect(screen.getByText('Days written')).toBeTruthy();
    expect(screen.getByText('Time at it')).toBeTruthy();
    expect(screen.getByText('Words an hour')).toBeTruthy();
    // Two days, so two rows under the head row.
    expect(document.querySelectorAll('.report-table tbody tr').length).toBe(2);
  });

  it('opens a day to the sittings inside it, with the hours they ran', () => {
    render(
      <Reports file={withLog()} open="writing" onClose={() => {}} onTab={() => {}} printOptions={{}} />,
    );
    expect(document.querySelector('.report-sittings')).toBeNull();
    fireEvent.click(document.querySelectorAll('.report-day')[0] as HTMLElement);
    const sittings = document.querySelector('.report-sittings');
    expect(sittings).toBeTruthy();
    // "9:05 pm – 9:09 pm", whatever the hour happens to be.
    expect(sittings?.textContent).toMatch(/\d:\d\d.*–.*\d:\d\d/);
    expect(sittings?.textContent).toContain('4m');
  });

  it('says so plainly when nothing has been written yet', () => {
    render(<Reports file={project()} open="writing" onClose={() => {}} onTab={() => {}} printOptions={{}} />);
    expect(screen.getByText(/Nothing written yet/)).toBeTruthy();
    expect(document.querySelector('.report-table')).toBeNull();
  });

  it('reads the document for the other report', () => {
    render(<Reports file={project()} open="story" onClose={() => {}} onTab={() => {}} printOptions={{}} />);
    expect(screen.getByText('Words')).toBeTruthy();
    expect(screen.getByText('Pages')).toBeTruthy();
    expect(screen.getByText('Scenes')).toBeTruthy();
  });
});

describe('the clock', () => {
  /** A component that runs the clock over a file held in state. */
  function Typing({ onFile }: { onFile(file: ProjectFile): void }) {
    const [file, setFile] = useState(project());
    useWritingClock(true, (mutate) =>
      setFile((current) => {
        const next = mutate(current);
        onFile(next);
        return next;
      }),
    );
    return <textarea aria-label="Manuscript" defaultValue="" />;
  }

  it('starts a sitting at the first keystroke into text, and not before', () => {
    const seen: ProjectFile[] = [];
    render(<Typing onFile={(file) => seen.push(file)} />);
    expect(seen).toHaveLength(0);

    fireEvent.keyDown(screen.getByLabelText('Manuscript'), { key: 'a' });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.sessions).toHaveLength(1);
  });

  it('does not count clicking around as writing', () => {
    const seen: ProjectFile[] = [];
    render(<Typing onFile={(file) => seen.push(file)} />);
    // A keystroke that lands on the page rather than in a field is not typing.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(seen).toHaveLength(0);
  });

  it('keeps the sitting open with a tick while the typing continues', () => {
    vi.useFakeTimers();
    try {
      const seen: ProjectFile[] = [];
      render(<Typing onFile={(file) => seen.push(file)} />);
      fireEvent.keyDown(screen.getByLabelText('Manuscript'), { key: 'a' });
      act(() => {
        vi.advanceTimersByTime(61_000);
      });
      // One sitting still, moved forward rather than a second one started.
      const last = seen[seen.length - 1]!;
      expect(seen.length).toBeGreaterThan(1);
      expect(last.sessions).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the opening screen', () => {
  it('offers a series and a short-form piece alongside the rest', () => {
    // The screen asks the bridge for the recent projects on mount.
    (window as unknown as Record<string, unknown>)['vcwriter'] = {
      recentProjects: () => Promise.resolve({ ok: true, data: [] }),
    };
    const created: ProjectFormat[] = [];
    render(
      <Welcome
        onCreate={(input) => created.push(input.format)}
        onOpen={() => {}}
        onImport={() => {}}
        onOpenPath={() => {}}
        error={null}
      />,
    );
    expect(screen.getByText('Series or episodic')).toBeTruthy();
    expect(screen.getByText('Short form')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Untitled'), { target: { value: 'Lighthouse' } });
    fireEvent.click(screen.getByText('Series or episodic'));
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    expect(created).toEqual(['series']);
  });
});
