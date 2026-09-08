// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addBeat, createProjectFile, updateBeat, type BeatId, type ProjectFile } from '@vcwriter/domain';
import { StoryView } from '../components/StoryView';
import { PagePreview } from '../components/PagePreview';

/**
 * The Script's keyboard behaviour, exercised through the component.
 *
 * The flow tables themselves are tested in the domain; what these cover is the
 * wiring — that Return really does create the next element and focus it, that
 * Tab re-types instead of moving focus, that typing lands in the beat it was
 * typed in, and that the beat's internal title never appears among the
 * manuscript elements.
 */

afterEach(cleanup);

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  const [selected, setSelected] = useState<BeatId | null>(file.beats[0]?.id ?? null);
  return (
    <StoryView
      file={file}
      selectedBeatId={selected}
      onSelectBeat={setSelected}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      focusMode={false}
      focusTitleBeatId={null}
      onTitleFocused={() => undefined}
      dictationShortcut={null}
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
    const cue = screen.getAllByPlaceholderText('character')[0] as HTMLTextAreaElement;
    fireEvent.keyDown(cue, { key: 'Enter' });

    expect(elementTypes()).toEqual(['action', 'character', 'dialogue']);
  });

  it('re-types the line on Tab rather than moving focus, as Final Draft does', () => {
    render(<Harness initial={screenplayWithAction()} />);

    // Action → Character → Parenthetical, the line itself changing style.
    fireEvent.keyDown(screen.getByDisplayValue('Rain hammers the glass.'), { key: 'Tab' });
    expect(elementTypes()).toEqual(['character']);
    fireEvent.keyDown(screen.getByDisplayValue('Rain hammers the glass.'), { key: 'Tab' });
    expect(elementTypes()).toEqual(['parenthetical']);

    // Shift+Tab walks back.
    fireEvent.keyDown(screen.getByDisplayValue('Rain hammers the glass.'), { key: 'Tab', shiftKey: true });
    expect(elementTypes()).toEqual(['character']);
  });

  it('sets the paragraph style from the number keys', () => {
    render(<Harness initial={screenplayWithAction()} />);
    fireEvent.keyDown(screen.getByDisplayValue('Rain hammers the glass.'), { key: '3', ctrlKey: true });
    expect(elementTypes()).toEqual(['character']);
  });

  it('types a line as what it turns out to be', () => {
    render(<Harness initial={screenplayWithAction()} />);
    const action = screen.getByDisplayValue('Rain hammers the glass.');

    fireEvent.change(action, { target: { value: 'INT. LIGHTHOUSE - NIGHT' } });
    expect(elementTypes()).toEqual(['scene_heading']);
  });

  it('removes an empty element on Backspace at the start', () => {
    render(<Harness initial={screenplayWithAction()} />);
    fireEvent.keyDown(screen.getByDisplayValue('Rain hammers the glass.'), { key: 'Enter' });
    expect(elementTypes()).toHaveLength(2);

    const added = screen.getAllByPlaceholderText('action')[1] as HTMLTextAreaElement;
    added.setSelectionRange(0, 0);
    fireEvent.keyDown(added, { key: 'Backspace' });

    expect(elementTypes()).toHaveLength(1);
  });

  it('keeps the beat title out of the manuscript column', () => {
    const { container } = render(<Harness initial={screenplayWithAction()} />);
    fireEvent.click(screen.getByLabelText('Beat names'));

    // The title is present as a labelled bar…
    expect((screen.getByLabelText('Beat title (not printed)') as HTMLInputElement).value).toBe('She confronts him');
    // …and nowhere among the manuscript elements.
    const column = container.querySelector('.page-column')!;
    expect(column.textContent).not.toContain('She confronts him');
  });
});

describe('the whole script in story order', () => {
  it('shows every beat, and typing in one changes only that one', () => {
    let file = screenplayWithAction();
    const unitId = file.units[0]!.id;
    file = addBeat(file, { unitId, title: 'Second' }).file;
    const third = addBeat(file, { unitId, title: 'Third' });
    file = updateBeat(third.file, third.beat.id, {
      manuscript: {
        elements: [{ id: 'a2222222-2222-4222-8222-222222222222' as never, type: 'action', text: 'Later.', characterId: null, attributes: {} }],
      },
    });

    render(<Harness initial={file} />);
    fireEvent.click(screen.getByLabelText('Beat names'));
    const titles = screen.getAllByLabelText('Beat title (not printed)').map((node) => (node as HTMLInputElement).value);
    expect(titles).toEqual(['She confronts him', 'Second', 'Third']);

    fireEvent.change(screen.getByDisplayValue('Later.'), { target: { value: 'Much later.' } });
    expect(screen.getByDisplayValue('Much later.')).toBeDefined();
    expect(screen.getByDisplayValue('Rain hammers the glass.')).toBeDefined();
  });

  it('selects the beat the cursor lands in', () => {
    let file = screenplayWithAction();
    const second = addBeat(file, { unitId: file.units[0]!.id, title: 'Second' });
    file = updateBeat(second.file, second.beat.id, {
      manuscript: {
        elements: [{ id: 'a3333333-3333-4333-8333-333333333333' as never, type: 'action', text: 'Then.', characterId: null, attributes: {} }],
      },
    });
    const { container } = render(<Harness initial={file} />);

    expect(container.querySelectorAll('.beat-block.selected')).toHaveLength(1);
    fireEvent.focus(screen.getByDisplayValue('Then.'));
    const selected = container.querySelector('.beat-block.selected')!;
    expect(selected.textContent).toContain('Then.');
  });
});

describe('the finished script', () => {
  it('shows the manuscript, hides the sluglines on request, and rules the printed page breaks', () => {
    let file = screenplayWithAction();
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: {
        elements: [
          { id: 'b1111111-1111-4111-8111-111111111111' as never, type: 'scene_heading', text: 'INT. LIGHTHOUSE - NIGHT', characterId: null, attributes: {} },
          // Enough action to run past the first page of 55 lines.
          ...Array.from({ length: 40 }, (_, index) => ({
            id: `b${String(index).padStart(7, '0')}-2222-4222-8222-222222222222` as never,
            type: 'action' as const,
            text: `Beat ${index}. ${'The lamp turns and the sea answers. '.repeat(2)}`,
            characterId: null,
            attributes: {},
          })),
        ],
      },
    });
    const { container } = render(<Harness initial={file} />);

    expect(screen.getByDisplayValue('INT. LIGHTHOUSE - NIGHT')).toBeDefined();
    expect(container.querySelector('.script-sheet.no-headings')).toBeNull();
    expect(container.querySelectorAll('.page-break').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Page 2 starts here')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Scene headings'));
    expect(container.querySelector('.script-sheet.no-headings')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Page breaks'));
    expect(container.querySelectorAll('.page-break')).toHaveLength(0);
  });

  it('leaves a beat that is not in the script out of the page', () => {
    let file = screenplayWithAction();
    const second = addBeat(file, { unitId: file.units[0]!.id, title: 'Held back' });
    file = updateBeat(second.file, second.beat.id, {
      inScript: false,
      manuscript: {
        elements: [{ id: 'b3333333-3333-4333-8333-333333333333' as never, type: 'action', text: 'Not yet.', characterId: null, attributes: {} }],
      },
    });
    render(<Harness initial={file} />);

    expect(screen.getByDisplayValue('Rain hammers the glass.')).toBeDefined();
    expect(screen.queryByDisplayValue('Not yet.')).toBeNull();
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
