// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createProjectFile, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { BeatEditor } from '../components/BeatEditor';
import { PagePreview } from '../components/PagePreview';

/**
 * The writing workspace's keyboard behaviour, exercised through the component.
 *
 * The flow tables themselves are tested in the domain; what these cover is the
 * wiring — that Return really does create the next element and focus it, that
 * Tab re-types instead of moving focus, and that the beat's internal title
 * never appears among the manuscript elements.
 */

afterEach(cleanup);

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  const beat = file.beats[0]!;
  return (
    <BeatEditor
      file={file}
      beat={beat}
      focusMode={false}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

const screenplayWithAction = () => {
  const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  return updateBeat(file, file.beats[0]!.id, {
    title: 'She confronts him',
    manuscript: {
      elements: [
        {
          id: 'a1111111-1111-4111-8111-111111111111' as never,
          type: 'action',
          text: 'Rain hammers the glass.',
          characterId: null,
          attributes: {},
        },
      ],
    },
  });
};

const elementTypes = (): string[] =>
  screen.getAllByLabelText('Element type').map((node) => (node as HTMLSelectElement).value);

describe('writing keyboard flow', () => {
  it('creates the conventional next element on Return', () => {
    render(<Harness initial={screenplayWithAction()} />);
    const action = screen.getByDisplayValue('Rain hammers the glass.');

    fireEvent.keyDown(action, { key: 'Enter' });
    expect(elementTypes()).toEqual(['action', 'action']);

    // Retype the new element as a character cue; Return then gives dialogue.
    const selects = screen.getAllByLabelText('Element type');
    fireEvent.change(selects[1]!, { target: { value: 'character' } });
    const cue = screen.getAllByRole('textbox')[2] as HTMLTextAreaElement;
    fireEvent.keyDown(cue, { key: 'Enter' });

    expect(elementTypes()).toEqual(['action', 'character', 'dialogue']);
  });

  it('cycles the element type on Tab rather than moving focus', () => {
    render(<Harness initial={screenplayWithAction()} />);
    const action = screen.getByDisplayValue('Rain hammers the glass.');

    fireEvent.keyDown(action, { key: 'Tab' });
    expect(elementTypes()).toEqual(['character']);

    fireEvent.keyDown(screen.getByDisplayValue('Rain hammers the glass.'), { key: 'Tab', shiftKey: true });
    expect(elementTypes()).toEqual(['action']);
  });

  it('removes an empty element on Backspace at the start', () => {
    render(<Harness initial={screenplayWithAction()} />);
    fireEvent.keyDown(screen.getByDisplayValue('Rain hammers the glass.'), { key: 'Enter' });
    expect(elementTypes()).toHaveLength(2);

    const added = screen.getAllByRole('textbox')[2] as HTMLTextAreaElement;
    added.setSelectionRange(0, 0);
    fireEvent.keyDown(added, { key: 'Backspace' });

    expect(elementTypes()).toHaveLength(1);
  });

  it('keeps the beat title out of the manuscript column', () => {
    const { container } = render(<Harness initial={screenplayWithAction()} />);

    // The title is present as a labelled reference field…
    expect((screen.getByPlaceholderText('What happens in this beat') as HTMLInputElement).value).toBe(
      'She confronts him',
    );
    // …and nowhere among the manuscript elements.
    const column = container.querySelector('.page-column')!;
    expect(column.textContent).not.toContain('She confronts him');
  });
});

describe('page preview', () => {
  it('shows paginated pages and offers export', () => {
    render(
      <PagePreview
        file={screenplayWithAction()}
        unitId={null}
        includeBeatTitles={false}
        onToggleBeatTitles={() => undefined}
        onExportPdf={() => undefined}
        onPrint={() => undefined}
        busy={false}
        message={null}
      />,
    );

    expect(screen.getByLabelText('Page 1')).toBeDefined();
    expect(screen.getByText('1 page')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDefined();
  });

  it('disables the export buttons while an export is running', () => {
    render(
      <PagePreview
        file={screenplayWithAction()}
        unitId={null}
        includeBeatTitles={false}
        onToggleBeatTitles={() => undefined}
        onExportPdf={() => undefined}
        onPrint={() => undefined}
        busy
        message="Exporting the script"
      />,
    );

    expect((screen.getByRole('button', { name: 'Print…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Working…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Exporting the script')).toBeDefined();
  });
});
