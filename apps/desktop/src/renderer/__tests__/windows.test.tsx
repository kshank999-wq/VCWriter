// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createProjectFile, updateBeat, type ProjectFile } from '@vcwriter/domain';
import {
  DEFAULT_ARRANGEMENT,
  movePane,
  normaliseArrangement,
  paneNamesFor,
  paneTitle,
  slotOf,
  type Arrangement,
  type PaneId,
} from '../panes';
import { createHub, type LinkMessage, type LinkTransport } from '../link';
import { PaneFrame } from '../components/PaneFrame';
import { TitleBar } from '../components/TitleBar';
import Satellite from '../Satellite';

/**
 * Sections that can be rearranged, and sections that can be moved to another
 * monitor (addendum 02 §8).
 */

afterEach(cleanup);

describe('where the sections sit', () => {
  it('swaps two sections when one is put in the other one’s place', () => {
    const moved = movePane(DEFAULT_ARRANGEMENT, 'script', 'bottom');
    expect(moved.bottom).toBe('script');
    // The lanes were there; they take the place the Script came from.
    expect(moved.left).toBe('lanes');
    // Nothing else stirred, and every section still has exactly one place.
    expect(moved.top).toBe('viewer');
    expect(new Set(Object.values(moved)).size).toBe(4);
  });

  it('leaves an arrangement alone when a section is put back where it is', () => {
    expect(movePane(DEFAULT_ARRANGEMENT, 'script', 'left')).toBe(DEFAULT_ARRANGEMENT);
  });

  // Spec §6.4: a novel and a short story are written as a manuscript, and the
  // section that shows the finished pages is called what the work is called.
  it('calls the pages a manuscript in prose and a script everywhere else', () => {
    expect(paneNamesFor('novel').script).toBe('Manuscript');
    expect(paneNamesFor('short_story').script).toBe('Manuscript');
    expect(paneNamesFor('screenplay').script).toBe('Script');
    expect(paneNamesFor('series').script).toBe('Script');
    expect(paneNamesFor(null).script).toBe('Script');
    // The other three sections are the same work under either name.
    expect(paneNamesFor('novel').lanes).toBe(paneNamesFor('screenplay').lanes);
    // And a window of its own carries the same name on its title.
    expect(paneTitle('script', 'novel')).toBe('Manuscript');
    expect(paneTitle('script')).toBe('Script');
  });

  it('falls back rather than losing a section to a bad remembered arrangement', () => {
    expect(normaliseArrangement({ left: 'script', top: 'script', bottom: 'lanes', right: 'inspector' })).toEqual(
      DEFAULT_ARRANGEMENT,
    );
    expect(normaliseArrangement({ left: 'script' })).toEqual(DEFAULT_ARRANGEMENT);
    expect(normaliseArrangement('nonsense')).toEqual(DEFAULT_ARRANGEMENT);
    const good: Arrangement = { left: 'lanes', top: 'script', bottom: 'viewer', right: 'inspector' };
    expect(normaliseArrangement(good)).toEqual(good);
  });
});

/** Two framed sections, as the workspace draws them. */
function Frames({ onDetach = () => undefined }: { onDetach?(pane: PaneId): void }) {
  const [arrangement, setArrangement] = useState<Arrangement>(DEFAULT_ARRANGEMENT);
  const [dragging, setDragging] = useState<PaneId | null>(null);
  const frame = (pane: PaneId) => (
    <PaneFrame
      pane={pane}
      arrangement={arrangement}
      onMove={(moved, to) => setArrangement(movePane(arrangement, moved, to))}
      onDetach={() => onDetach(pane)}
      dragging={dragging}
      onDragStart={setDragging}
      onDragEnd={() => setDragging(null)}
      onDrop={(onto) => {
        if (dragging) setArrangement(movePane(arrangement, dragging, slotOf(arrangement, onto)));
        setDragging(null);
      }}
    >
      <p>{pane} contents</p>
    </PaneFrame>
  );
  return (
    <>
      <p data-testid="where">{`${arrangement.left}/${arrangement.top}/${arrangement.bottom}/${arrangement.right}`}</p>
      {frame('script')}
      {frame('lanes')}
    </>
  );
}

describe('the strip on a section', () => {
  it('moves a section to another place from its menu', () => {
    render(<Frames />);
    expect(screen.getByTestId('where').textContent).toBe('script/viewer/lanes/inspector');
    fireEvent.change(screen.getByLabelText('Move Script'), { target: { value: 'bottom' } });
    expect(screen.getByTestId('where').textContent).toBe('lanes/viewer/script/inspector');
  });

  it('swaps two sections when one is dragged onto the other', () => {
    const { container } = render(<Frames />);
    const grips = container.querySelectorAll('.pane-grip');
    fireEvent.dragStart(grips[0] as HTMLElement);
    fireEvent.drop(screen.getByLabelText('Plot lanes'));
    expect(screen.getByTestId('where').textContent).toBe('lanes/viewer/script/inspector');
  });

  it('takes a section out to its own window', () => {
    const onDetach = vi.fn();
    render(<Frames onDetach={onDetach} />);
    fireEvent.click(screen.getByLabelText('Open Script in its own window'));
    expect(onDetach).toHaveBeenCalledWith('script');
  });
});

describe('the title bar', () => {
  const bar = (away: string[], extra: Partial<React.ComponentProps<typeof TitleBar>> = {}) =>
    render(
      <TitleBar
        file={project()}
        pages={1}
        beatCount={1}
        wordCount={3}
        writing
        focusMode={false}
        onFocus={() => undefined}
        onOpenResearch={() => undefined}
        onOpenSculptor={() => undefined}
        away={away}
        onBringBack={() => undefined}
        account={{ configured: false, signedIn: false, email: null }}
        syncing={false}
        onSync={() => undefined}
        saveState="saved"
        onSaveNow={() => undefined}
        onCloseProject={() => undefined}
        onPreferences={() => undefined}
        {...extra}
      />,
    );

  it('keeps Research reachable whatever section has left the workspace', () => {
    const onOpenResearch = vi.fn();
    bar(['script', 'lanes'], { onOpenResearch });
    fireEvent.click(screen.getByText('Research'));
    expect(onOpenResearch).toHaveBeenCalled();
  });

  it('offers a way back for each section that is out, and none when they are all here', () => {
    const onBringBack = vi.fn();
    bar(['script'], { onBringBack });
    fireEvent.click(screen.getByLabelText('Bring Script back'));
    expect(onBringBack).toHaveBeenCalledWith('script');

    cleanup();
    bar([]);
    expect(screen.queryByLabelText(/^Bring /)).toBeNull();
  });

  it('does not offer a chip per beat window, which would be endless', () => {
    bar(['research', 'beat:1234']);
    expect(screen.getByLabelText('Bring Research back')).toBeDefined();
    expect(screen.queryByLabelText(/^Bring beat/)).toBeNull();
  });
});

// -------------------------------------------------- a section on its own

const project = (): ProjectFile => {
  const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  return updateBeat(file, file.beats[0]!.id, { title: 'She arrives' });
};

/** A workspace holding the document, and a bridge for the window to reach it. */
const connect = (initial: ProjectFile) => {
  const handlers = new Set<(message: LinkMessage) => void>();
  const state = { file: initial };

  // Each side sends to the other and never to itself, as a real relay does.
  const side = (): LinkTransport => {
    let own: ((message: LinkMessage) => void) | null = null;
    return {
      send: (message) => {
        for (const handler of handlers) if (handler !== own) handler(message);
      },
      subscribe: (handler) => {
        own = handler;
        handlers.add(handler);
        return () => handlers.delete(handler);
      },
    };
  };

  const hubSide = side();
  const windowSide = side();
  const hub = createHub({
    transport: hubSide,
    onProposal: (next) => {
      state.file = next;
      hub.publish(next, '/tmp/lighthouse.vcw');
    },
    current: () => ({ file: state.file, path: '/tmp/lighthouse.vcw' }),
  });
  hub.publish(initial, '/tmp/lighthouse.vcw');

  const opened: string[] = [];
  (window as unknown as { vcwriter: unknown }).vcwriter = {
    link: {
      send: (message: Record<string, unknown>) => windowSide.send(message as unknown as LinkMessage),
      subscribe: (handler: (message: Record<string, unknown>) => void) =>
        windowSide.subscribe((message) => handler(message as unknown as Record<string, unknown>)),
    },
    panes: {
      open: async (pane: string) => {
        opened.push(pane);
        return { ok: true, data: true };
      },
      close: async () => ({ ok: true, data: true }),
      list: async () => ({ ok: true, data: [] }),
      onChanged: () => () => undefined,
      self: () => null,
    },
  };

  /** The workspace edits its own document and publishes it, as the App does. */
  const editHere = (mutate: (current: ProjectFile) => ProjectFile) => {
    state.file = mutate(state.file);
    hub.publish(state.file, '/tmp/lighthouse.vcw');
  };

  return { state, opened, editHere };
};

describe('a beat in a window of its own', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows the workspace’s beat and writes back into the workspace’s project', async () => {
    const initial = project();
    const beat = initial.beats[0]!;
    const workspace = connect(initial);

    render(<Satellite pane={`beat:${beat.id}`} />);

    // It asks the workspace for the project rather than holding one of its own.
    await waitFor(() => expect(screen.getByLabelText('Beat name')).toBeDefined());
    expect((screen.getByLabelText('Beat name') as HTMLInputElement).value).toBe('She arrives');

    // A change made here is the workspace's document, not a copy of it.
    fireEvent.change(screen.getByLabelText('Beat name'), { target: { value: 'She arrives late' } });
    await waitFor(() => expect(workspace.state.file.beats[0]?.title).toBe('She arrives late'));
  });

  it('follows the workspace when the beat changes over there', async () => {
    const initial = project();
    const beat = initial.beats[0]!;
    const workspace = connect(initial);
    render(<Satellite pane={`beat:${beat.id}`} />);
    await waitFor(() => expect(screen.getByLabelText('Beat name')).toBeDefined());

    // Renamed in the workspace — say, from the inspector. The window is not
    // showing a copy, so it changes here too.
    workspace.editHere((current) => updateBeat(current, beat.id, { title: 'She arrives at dusk' }));
    await waitFor(() =>
      expect((screen.getByLabelText('Beat name') as HTMLInputElement).value).toBe('She arrives at dusk'),
    );
  });

  it('opens a beat from the Script into a window of its own rather than over this one', async () => {
    const initial = project();
    const beat = initial.beats[0]!;
    const workspace = connect(initial);
    render(<Satellite pane="script" />);

    await waitFor(() => expect(screen.getByLabelText('Page options')).toBeDefined());
    fireEvent.click(screen.getByLabelText('Page options'));
    fireEvent.click(screen.getByLabelText('Beat names'));
    fireEvent.click(screen.getByLabelText('Write in this beat'));
    expect(workspace.opened).toEqual([`beat:${beat.id}`]);
  });

  it('says so, rather than showing an empty page, before the workspace answers', () => {
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      link: { send: () => undefined, subscribe: () => () => undefined },
      panes: { self: () => null, onChanged: () => () => undefined },
    };
    render(<Satellite pane="script" />);
    expect(screen.getByText('Waiting for the workspace…')).toBeDefined();
  });
});
