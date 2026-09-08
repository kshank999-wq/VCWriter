// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { addBeat, createProjectFile, pageCount, updateBeat, type BeatId, type ProjectFile } from '@vcwriter/domain';
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

/** One beat with enough action in it to run over more than one printed page. */
const longScript = (): ProjectFile => {
  const file = screenplayWithAction();
  return updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [
        {
          id: 'c0000000-0000-4000-8000-000000000000' as never,
          type: 'scene_heading',
          text: 'INT. LIGHTHOUSE - NIGHT',
          characterId: null,
          attributes: {},
        },
        ...Array.from({ length: 40 }, (_, index) => ({
          id: `c${String(index).padStart(7, '0')}-3333-4333-8333-333333333333` as never,
          type: 'action' as const,
          text: `Beat ${index}. ${'The lamp turns and the sea answers. '.repeat(2)}`,
          characterId: null,
          attributes: {},
        })),
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
    fireEvent.click(screen.getByLabelText('Page options'));
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
    fireEvent.click(screen.getByLabelText('Page options'));
    fireEvent.click(screen.getByLabelText('Beat names'));
    const titles = screen.getAllByLabelText('Beat title (not printed)').map((node) => (node as HTMLInputElement).value);
    expect(titles).toEqual(['She confronts him', 'Second', 'Third']);

    fireEvent.change(screen.getByDisplayValue('Later.'), { target: { value: 'Much later.' } });
    expect(screen.getByDisplayValue('Much later.')).toBeDefined();
    expect(screen.getByDisplayValue('Rain hammers the glass.')).toBeDefined();
  });

  it('is written in, not just read: the same two keys work on the page itself', () => {
    render(<Harness initial={screenplayWithAction()} />);
    const action = screen.getByDisplayValue('Rain hammers the glass.');

    // Tab re-types the line you are on, exactly as in the beat's own screen.
    fireEvent.keyDown(action, { key: 'Tab' });
    expect(elementTypes()).toEqual(['character']);

    // Return gives the element that conventionally follows a cue.
    fireEvent.keyDown(screen.getByDisplayValue('Rain hammers the glass.'), { key: 'Enter' });
    expect(elementTypes()).toEqual(['character', 'dialogue']);

    // And what is typed into it is the manuscript, not a copy of it.
    fireEvent.change(screen.getAllByRole('textbox')[1] as HTMLElement, { target: { value: 'You came back.' } });
    expect(screen.getByDisplayValue('You came back.')).toBeDefined();
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

describe('pasting a scene in as text', () => {
  const paste = (target: Element, text: string) =>
    fireEvent.paste(target, { clipboardData: { getData: () => text } });

  it('reads it as sluglines, cues and dialogue instead of one block', () => {
    render(<Harness initial={screenplayWithAction()} />);
    const action = screen.getByDisplayValue('Rain hammers the glass.') as HTMLTextAreaElement;
    action.setSelectionRange(action.value.length, action.value.length);

    paste(
      action,
      ['INT. LIGHTHOUSE - NIGHT', '', 'Mike stands at the lamp,', 'watching the water.', '', 'MIKE', 'She was here.'].join('\n'),
    );

    expect(elementTypes()).toEqual(['action', 'scene_heading', 'action', 'character', 'dialogue']);
    // The line that was already there is untouched, and the hard-wrapped
    // lines are one paragraph again.
    expect(screen.getByDisplayValue('Rain hammers the glass.')).toBeDefined();
    expect(screen.getByDisplayValue('Mike stands at the lamp, watching the water.')).toBeDefined();
    expect(screen.getByDisplayValue('She was here.')).toBeDefined();
  });

  it('leaves an ordinary paste to the ordinary paste', () => {
    render(<Harness initial={screenplayWithAction()} />);
    const action = screen.getByDisplayValue('Rain hammers the glass.');
    paste(action, ' Again.');
    // Nothing was intercepted: still the one element the beat started with.
    expect(elementTypes()).toEqual(['action']);
  });
});

describe('emphasis and dual dialogue while writing', () => {
  it('puts emphasis on the selection and draws it under the cursor', () => {
    const { container } = render(<Harness initial={screenplayWithAction()} />);
    const action = screen.getByDisplayValue('Rain hammers the glass.') as HTMLTextAreaElement;

    action.setSelectionRange(5, 12);
    fireEvent.keyDown(action, { key: 'b', ctrlKey: true });
    expect(screen.getByDisplayValue('Rain **hammers** the glass.')).toBeDefined();

    // The layer under the cursor carries the same characters, styled.
    const ink = container.querySelector('.element .ink') as HTMLElement;
    expect(ink.textContent).toContain('Rain **hammers** the glass.');
    expect(ink.querySelector('b')?.textContent).toBe('hammers');
    expect(Array.from(ink.querySelectorAll('.mark')).map((node) => node.textContent)).toEqual(['**', '**']);

    // And again takes it off.
    const bolded = screen.getByDisplayValue('Rain **hammers** the glass.') as HTMLTextAreaElement;
    bolded.setSelectionRange(7, 14);
    fireEvent.keyDown(bolded, { key: 'b', ctrlKey: true });
    expect(screen.getByDisplayValue('Rain hammers the glass.')).toBeDefined();
  });

  it('prints a speech beside the one above it when asked, and side by side while writing', () => {
    let file = screenplayWithAction();
    const beatId = file.beats[0]!.id;
    file = updateBeat(file, beatId, {
      manuscript: {
        elements: [
          { id: 'c1111111-1111-4111-8111-111111111111' as never, type: 'character', text: 'MIKE', characterId: null, attributes: {} },
          { id: 'c2222222-2222-4222-8222-222222222222' as never, type: 'dialogue', text: 'Now don’t.', characterId: null, attributes: {} },
          { id: 'c3333333-3333-4333-8333-333333333333' as never, type: 'character', text: 'CELESTE', characterId: null, attributes: {} },
          { id: 'c4444444-4444-4444-8444-444444444444' as never, type: 'dialogue', text: 'No way!', characterId: null, attributes: {} },
        ],
      },
    });
    const { container } = render(<Harness initial={file} />);

    expect(container.querySelectorAll('.dual-row')).toHaveLength(0);
    const toggles = screen.getAllByLabelText('Print beside the speech above');
    // The second cue is the one that can sit beside the first.
    fireEvent.click(toggles[1]!);

    const row = container.querySelector('.dual-row')!;
    expect(row).toBeDefined();
    const columns = row.querySelectorAll('.dual-column');
    expect(columns).toHaveLength(2);
    expect(columns[0]!.textContent).toContain('MIKE');
    expect(columns[1]!.textContent).toContain('CELESTE');

    // Off again, and the two speeches are back in sequence.
    fireEvent.click(screen.getAllByLabelText('Print beside the speech above')[1]!);
    expect(container.querySelectorAll('.dual-row')).toHaveLength(0);
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

    fireEvent.click(screen.getByLabelText('Page options'));
    fireEvent.click(screen.getByLabelText('Scene headings'));
    expect(container.querySelector('.script-sheet.no-headings')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Page breaks'));
    expect(container.querySelectorAll('.page-break')).toHaveLength(0);
  });

  it('deals the script out onto sheets of paper, and carries a beat over the leaf', () => {
    const long = longScript();
    const { container } = render(<Harness initial={long} />);
    const pages = pageCount(long);
    expect(pages).toBeGreaterThan(1);

    fireEvent.click(screen.getByLabelText('Page options'));
    fireEvent.change(screen.getByLabelText('Script layout'), { target: { value: 'pages' } });

    // One sheet per printed page — the paginator's pages, not a guess.
    expect(container.querySelectorAll('.page-sheet')).toHaveLength(pages);
    expect(screen.getByLabelText('Page 2')).toBeDefined();
    // The rules are gone: a sheet's edge is where the page ends now.
    expect(container.querySelectorAll('.page-break')).toHaveLength(0);

    // The one beat runs over the leaf, so it is drawn in a run on each sheet
    // it reaches — and every one of its elements is still on the page
    // somewhere, exactly once.
    const first = within(screen.getByLabelText('Page 1')).getAllByRole('textbox');
    const second = within(screen.getByLabelText('Page 2')).getAllByRole('textbox');
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.page-sheet textarea')).toHaveLength(
      long.beats[0]!.manuscript.elements.length,
    );

    // And it is still written in: the sheets are the manuscript, not a print.
    fireEvent.change(second[0] as HTMLElement, { target: { value: 'Over the leaf.' } });
    expect(screen.getByDisplayValue('Over the leaf.')).toBeDefined();
  });

  it('goes back to one continuous page, with the rules again', () => {
    const { container } = render(<Harness initial={longScript()} />);
    fireEvent.click(screen.getByLabelText('Page options'));
    fireEvent.change(screen.getByLabelText('Script layout'), { target: { value: 'pages' } });
    expect(container.querySelectorAll('.page-sheet').length).toBeGreaterThan(1);

    // The gear stays open while it is being used, so it is still there.
    fireEvent.change(screen.getByLabelText('Script layout'), { target: { value: 'flow' } });
    expect(container.querySelectorAll('.page-sheet')).toHaveLength(0);
    expect(container.querySelector('.script-sheet')).toBeDefined();
    expect(container.querySelectorAll('.page-break').length).toBeGreaterThan(0);
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
        includeChapterPages
        onToggleChapterPages={() => undefined}
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
        includeChapterPages
        onToggleChapterPages={() => undefined}
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
