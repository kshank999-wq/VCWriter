// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addMarker,
  createProjectFile,
  threadLayout,
  type ProjectFile,
  type ProjectFormat,
  type StoryMarkerId,
} from '@vcwriter/domain';
import { MarkerDialog } from '../components/MarkerDialog';
import { TimelineViewer } from '../components/TimelineViewer';
import { StoryView } from '../components/StoryView';

/**
 * Markers and the leaves between chapters (addendum 02 §11), and the gear
 * that decides how the page looks (§6.3).
 */

afterEach(cleanup);

const marked = (format: ProjectFormat = 'novel'): ProjectFile => {
  const file = createProjectFile({ title: 'The Lighthouse', format });
  return addMarker(file, {
    unitId: file.units[0]!.id,
    title: 'The arrival',
    kind: format === 'screenplay' ? 'act' : 'chapter',
  }).file;
};

function Marker({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  return (
    <MarkerDialog
      file={file}
      markerId={file.markers[0]!.id as StoryMarkerId}
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

describe('a marker on the timeline', () => {
  it('is drawn at the point in the story it marks, and opens when it is clicked', () => {
    const file = marked();
    let opened: string | null = null;
    render(
      <TimelineViewer
        file={file}
        threads={threadLayout(file)}
        selectedBeatId={null}
        onSelectBeat={() => undefined}
        onUpdate={() => undefined}
        zoom={180}
        onZoom={() => undefined}
        isolated=""
        onIsolate={() => undefined}
        onOpenMarker={(id) => {
          opened = id;
        }}
      />,
    );

    const mark = screen.getByLabelText('Marker: Chapter 1 — The arrival');
    fireEvent.click(mark);
    expect(opened).toBe(file.markers[0]!.id);
  });

  it('is a script’s act, in the same row, when the project is a script', () => {
    const file = marked('screenplay');
    render(
      <TimelineViewer
        file={file}
        threads={threadLayout(file)}
        selectedBeatId={null}
        onSelectBeat={() => undefined}
        onUpdate={() => undefined}
        zoom={180}
        onZoom={() => undefined}
        isolated=""
        onIsolate={() => undefined}
      />,
    );
    expect(screen.getByLabelText('Marker: ACT I — The arrival')).toBeDefined();
  });
});

describe('what opens from a marker', () => {
  it('is a page to design, in a book', () => {
    render(<Marker initial={marked('novel')} />);

    // Off to begin with: a chapter runs on from the last unless asked not to.
    expect(screen.getByText('This chapter runs straight on from the last one.')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Give this chapter a page of its own'));

    const page = within(screen.getByLabelText('The page'));
    expect(page.getByText('Chapter 1')).toBeDefined();
    expect(page.getByText('The arrival')).toBeDefined();

    // The epigraph lands on it as it is typed.
    fireEvent.change(screen.getByLabelText('Epigraph'), { target: { value: 'The sea does not forgive.' } });
    expect(page.getByText('The sea does not forgive.')).toBeDefined();

    // And each part of it can be left off.
    fireEvent.click(screen.getByLabelText('Show the name'));
    expect(page.queryByText('The arrival')).toBeNull();
    expect(page.getByText('Chapter 1')).toBeDefined();
  });

  it('is notes, in a script, because a script prints no such leaf', () => {
    render(<Marker initial={marked('screenplay')} />);
    expect(screen.queryByLabelText('Give this chapter a page of its own')).toBeNull();
    expect(screen.queryByLabelText('The page')).toBeNull();

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'The point of no return.' } });
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('The point of no return.');
  });

  it('changes the numbering for the whole project at once, as a book must', () => {
    render(<Marker initial={marked('novel')} />);
    fireEvent.click(screen.getByLabelText('Give this chapter a page of its own'));
    expect(within(screen.getByLabelText('The page')).getByText('Chapter 1')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Numbering'), { target: { value: 'roman' } });
    expect(within(screen.getByLabelText('The page')).getByText('Chapter I')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Numbering'), { target: { value: 'words' } });
    expect(within(screen.getByLabelText('The page')).getByText('Chapter One')).toBeDefined();
  });
});

describe('the Script’s gear', () => {
  const script = () => {
    const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    return file;
  };

  function Page({ initial }: { initial: ProjectFile }) {
    const [file, setFile] = useState(initial);
    return (
      <StoryView
        file={file}
        selectedBeatId={null}
        onSelectBeat={() => undefined}
        onUpdate={(mutate) => setFile((current) => mutate(current))}
        focusMode={false}
        focusTitleBeatId={null}
        onTitleFocused={() => undefined}
        dictationShortcut={null}
      />
    );
  }

  it('keeps the page’s own options out of the bar until they are asked for', () => {
    render(<Page initial={script()} />);
    expect(screen.queryByLabelText('Paper colour')).toBeNull();
    fireEvent.click(screen.getByLabelText('Page options'));
    expect(screen.getByLabelText('Paper colour')).toBeDefined();
    expect(screen.getByLabelText('Text colour')).toBeDefined();
    expect(screen.getByLabelText('Typeface')).toBeDefined();
  });

  it('puts the writer’s paper and ink on the page itself', () => {
    const { container } = render(<Page initial={script()} />);
    fireEvent.click(screen.getByLabelText('Page options'));
    fireEvent.click(screen.getByLabelText('Night'));

    const view = container.querySelector('.script-view') as HTMLElement;
    expect(view.className).toContain('own-paper');
    expect(view.style.getPropertyValue('--own-paper')).toBe('#1b1b1e');
    expect(view.style.getPropertyValue('--own-ink')).toBe('#e8e4d9');

    // A colour picked by hand lands the same way.
    fireEvent.change(screen.getByLabelText('Paper colour'), { target: { value: '#f6f1e4' } });
    expect(view.style.getPropertyValue('--own-paper')).toBe('#f6f1e4');
  });

  it('holds the display switches, so the bar above the page is the page’s', () => {
    render(<Page initial={script()} />);
    fireEvent.click(screen.getByLabelText('Page options'));
    fireEvent.click(screen.getByLabelText('Beat names'));
    expect(screen.getByLabelText('Beat title (not printed)')).toBeDefined();
  });
});
