// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  addCharacter,
  createProjectFile,
  type CaptureItem,
  type ProjectFile,
} from '@vcwriter/domain';
import { ResearchWindow } from '../components/ResearchWindow';

/**
 * The Mobile App inbox (addendum 09 §9, stage 1).
 *
 * The rule every one of these defends is §1: **the phone captures and the
 * desktop places.** Nothing arrives in the project because it was synced — a
 * person drags it somewhere, or presses the button under the suggestion, and
 * until then it is a note in a tray.
 */

afterEach(cleanup);

const resolveCapture = vi.fn();

const cap = (over: Partial<CaptureItem>, projectId: string): CaptureItem =>
  ({
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    projectId,
    source: 'mobile_voice',
    capturedAt: new Date().toISOString(),
    rawText: 'She never lets anyone else drive.',
    audioAssetId: null,
    transcriptConfidence: null,
    inference: null,
    requestedRouting: null,
    category: null,
    subjectName: null,
    status: 'pending',
    reviewedAt: null,
    resultRef: null,
    syncedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  }) as CaptureItem;

/** A project with Mara in it, and whatever notes the test wants waiting. */
const staged = (make: (projectId: string) => CaptureItem[]) => {
  const file = addCharacter(createProjectFile({ title: 'Blackout', format: 'screenplay' }), {
    name: 'MARA',
  });
  const captures = make(file.project.id as string);
  resolveCapture.mockResolvedValue({ ok: true, data: null });
  (window as unknown as { vcwriter: unknown }).vcwriter = {
    listCaptures: () => Promise.resolve({ ok: true, data: captures }),
    resolveCapture,
  };
  return file;
};

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  return (
    <ResearchWindow
      file={file}
      open
      currentBeatId={null}
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

/** Open Research on the Mobile App entry, once the notes have arrived. */
const openInbox = async () => {
  const side = within(screen.getByLabelText('Research folders'));
  await waitFor(() => expect(side.getByText('Mobile App')).toBeDefined());
  fireEvent.click(side.getByText('Mobile App'));
  await waitFor(() => expect(document.querySelector('.mobile-inbox')).not.toBeNull());
};

beforeEach(() => resolveCapture.mockReset());

describe('the Mobile App inbox', () => {
  it('counts what is waiting before anybody opens it', async () => {
    render(<Harness initial={staged((id) => [cap({ category: 'idea' }, id), cap({}, id)])} />);
    const side = within(screen.getByLabelText('Research folders'));
    await waitFor(() => {
      expect(side.getByRole('button', { name: /^Mobile App/ }).textContent).toContain('2');
    });
  });

  it('groups the notes by what the writer said they were', async () => {
    render(
      <Harness
        initial={staged((id) => [
          cap({ category: 'theme', rawText: 'Everybody is paying somebody off.' }, id),
          cap({ category: 'character', subjectName: 'MARA' }, id),
        ])}
      />,
    );
    await openInbox();

    const headings = Array.from(document.querySelectorAll('.mobile-inbox h4')).map(
      (one) => one.textContent ?? '',
    );
    expect(headings[0]).toContain('Character');
    expect(headings[1]).toContain('Theme');
  });

  it('keeps a note that named no category rather than dropping it', async () => {
    render(<Harness initial={staged((id) => [cap({ rawText: 'A revolver in the drawer.' }, id)])} />);
    await openInbox();
    expect(screen.getByText('No category')).toBeDefined();
  });

  it('does not print the note twice when nobody was named', async () => {
    // The heading falls back to the first line, so a note with no spoken name
    // used to appear as its own title.
    render(<Harness initial={staged((id) => [cap({ rawText: 'A revolver in the drawer.' }, id)])} />);
    await openInbox();
    expect(screen.getAllByText('A revolver in the drawer.')).toHaveLength(1);
  });

  it('files a note where the suggestion says, and stops it waiting', async () => {
    render(
      <Harness
        initial={staged((id) => [cap({ category: 'plot_point', rawText: 'The audit lands.' }, id)])}
      />,
    );
    await openInbox();
    fireEvent.click(screen.getByRole('button', { name: /^File / }));

    // It is in the project, and gone from the tray.
    await waitFor(() => expect(resolveCapture).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('The audit lands.')).toBeNull());
  });

  it('files a note about somebody already in the cast, without making a second one', async () => {
    let seen: ProjectFile | null = null;
    function Watching({ initial }: { initial: ProjectFile }) {
      const [file, setFile] = useState(initial);
      seen = file;
      return (
        <ResearchWindow
          file={file}
          open
          currentBeatId={null}
          onClose={() => undefined}
          onUpdate={(mutate) => setFile((current) => mutate(current))}
        />
      );
    }

    render(
      <Watching
        initial={staged((id) => [
          cap({ category: 'character', subjectName: 'MARA', rawText: 'She never drives.' }, id),
        ])}
      />,
    );
    await openInbox();
    fireEvent.click(screen.getByRole('button', { name: /^File / }));

    await waitFor(() => expect(resolveCapture).toHaveBeenCalled());
    expect(seen!.characters).toHaveLength(1);
    expect(seen!.researchItems.at(-1)?.body).toContain('never drives');
  });

  it('sets a note aside without taking its words', async () => {
    render(<Harness initial={staged((id) => [cap({ rawText: 'Not this one.' }, id)])} />);
    await openInbox();
    fireEvent.click(screen.getByRole('button', { name: /^Discard/ }));

    await waitFor(() => expect(resolveCapture).toHaveBeenCalled());
    // Rejected, not deleted: the row keeps its raw text.
    expect(resolveCapture.mock.calls[0]![0]).toMatchObject({ status: 'rejected', rawText: 'Not this one.' });
  });

  it('drags a note onto a folder and files it there', async () => {
    let seen: ProjectFile | null = null;
    function Watching({ initial }: { initial: ProjectFile }) {
      const [file, setFile] = useState(initial);
      seen = file;
      return (
        <ResearchWindow
          file={file}
          open
          currentBeatId={null}
          onClose={() => undefined}
          onUpdate={(mutate) => setFile((current) => mutate(current))}
        />
      );
    }

    render(<Watching initial={staged((id) => [cap({ rawText: 'A revolver in the drawer.' }, id)])} />);
    await openInbox();

    const note = document.querySelector('.mobile-note')!;
    fireEvent.dragStart(note, { dataTransfer: { setData: () => undefined } });

    const side = within(screen.getByLabelText('Research folders'));
    const props = side.getByText('Props').closest('.folder-row')!;
    fireEvent.dragOver(props);
    fireEvent.drop(props);

    await waitFor(() => expect(resolveCapture).toHaveBeenCalled());
    const propsFolder = seen!.researchCategories.find((one) => one.systemKey === 'props')!;
    // Where it was dropped, not where the suggestion wanted it.
    expect(seen!.researchItems.at(-1)?.categoryId).toBe(propsFolder.id);
  });

  it('drags a note onto somebody in the cast and files it about them', async () => {
    let seen: ProjectFile | null = null;
    function Watching({ initial }: { initial: ProjectFile }) {
      const [file, setFile] = useState(initial);
      seen = file;
      return (
        <ResearchWindow
          file={file}
          open
          currentBeatId={null}
          onClose={() => undefined}
          onUpdate={(mutate) => setFile((current) => mutate(current))}
        />
      );
    }

    render(<Watching initial={staged((id) => [cap({ rawText: 'She never drives.' }, id)])} />);
    await openInbox();

    fireEvent.dragStart(document.querySelector('.mobile-note')!, {
      dataTransfer: { setData: () => undefined },
    });

    const side = within(screen.getByLabelText('Research folders'));
    const mara = side.getByRole('button', { name: /^MARA/ });
    fireEvent.dragOver(mara);
    fireEvent.drop(mara);

    await waitFor(() => expect(resolveCapture).toHaveBeenCalled());
    // About her, never a second Mara.
    expect(seen!.characters).toHaveLength(1);
    const made = seen!.researchItems.at(-1)!;
    expect(made.body).toContain('never drives');
    expect(
      seen!.links.some((link) => link.from.id === (made.id as string)),
    ).toBe(true);
  });

  it('says so when the notes cannot be read, rather than looking empty', async () => {
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      listCaptures: () => Promise.resolve({ ok: false, error: 'No signal' }),
      resolveCapture,
    };
    const file = addCharacter(createProjectFile({ title: 'Blackout', format: 'screenplay' }), {
      name: 'MARA',
    });
    render(<Harness initial={file} />);
    await openInbox();
    expect(screen.getByText('No signal')).toBeDefined();
  });
});
