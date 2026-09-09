// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { addBeat, createProjectFile, updateBeat, type ProjectFile, type ProjectFormat } from '@vcwriter/domain';
import { MENUS, matchesAccelerator, menusFor, prettyAccelerator, type CommandId } from '../menus';
import { MenuBar } from '../components/MenuBar';
import { FindPanel } from '../components/FindPanel';
import { PageSetup, DEFAULT_PRINT_SETUP, type PrintSetup } from '../components/PageSetup';

/**
 * The menu bar and what hangs off it (addendum 02 §13).
 */

afterEach(cleanup);

describe('the menu list', () => {
  it('has the three menus the workspace is driven from, and no command twice', () => {
    expect(MENUS.map((menu) => menu.label)).toEqual(['File', 'Editor', 'Reports', 'Window', 'Help']);
    const commands = MENUS.flatMap((menu) => menu.items.filter(Boolean).map((item) => item!.command));
    expect(new Set(commands).size).toBe(commands.length);
    // A series adds an item, and must not repeat one either.
    const series = menusFor('series').flatMap((menu) => menu.items.filter(Boolean).map((item) => item!.command));
    expect(new Set(series).size).toBe(series.length);
  });

  it('offers one way to start a project, not a list of nouns', () => {
    const file = MENUS.find((menu) => menu.id === 'file')!;
    const starting = file.items.filter(Boolean).filter((item) => item!.command.startsWith('file.new'));
    expect(starting.map((item) => item!.label)).toEqual(['New project…']);
  });

  it('never gives two items the same accelerator', () => {
    const keys = menusFor('series')
      .flatMap((menu) => menu.items.filter(Boolean))
      .map((item) => item!.accelerator)
      .filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('writes an accelerator the way each platform writes it', () => {
    expect(prettyAccelerator('CmdOrCtrl+S', true)).toBe('⌘S');
    expect(prettyAccelerator('CmdOrCtrl+S', false)).toBe('Ctrl+S');
    expect(prettyAccelerator('CmdOrCtrl+Shift+P', true)).toBe('⌘⇧P');
  });

  it('matches a keystroke against an accelerator, modifiers and all', () => {
    const press = (init: Partial<KeyboardEvent>) => new KeyboardEvent('keydown', init as KeyboardEventInit);
    expect(matchesAccelerator(press({ key: 's', metaKey: true }), 'CmdOrCtrl+S')).toBe(true);
    expect(matchesAccelerator(press({ key: 's', ctrlKey: true }), 'CmdOrCtrl+S')).toBe(true);
    // Without the modifier it is just a letter being typed.
    expect(matchesAccelerator(press({ key: 's' }), 'CmdOrCtrl+S')).toBe(false);
    // And Shift is part of the chord, not decoration.
    expect(matchesAccelerator(press({ key: 's', metaKey: true, shiftKey: true }), 'CmdOrCtrl+S')).toBe(false);
    expect(matchesAccelerator(press({ key: 's', metaKey: true, shiftKey: true }), 'CmdOrCtrl+Shift+S')).toBe(true);
  });
});

describe('the menu bar', () => {
  const bar = (props: Partial<React.ComponentProps<typeof MenuBar>> = {}) => {
    const onCommand = vi.fn();
    render(<MenuBar onCommand={onCommand} checked={new Set()} mac={false} {...props} />);
    return onCommand;
  };

  it('opens a menu and runs what is chosen', () => {
    const onCommand = bar();
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(within(screen.getByRole('menu', { name: 'File' })).getByText('Page setup…'));
    expect(onCommand).toHaveBeenCalledWith('file.pageSetup');
    // …and the menu puts itself away afterwards.
    expect(screen.queryByRole('menu', { name: 'File' })).toBeNull();
  });

  it('ticks what is on, so Window says which sections are out', () => {
    bar({ checked: new Set<CommandId>(['window.script', 'window.focus']) });
    fireEvent.click(screen.getByText('Window'));
    const menu = within(screen.getByRole('menu', { name: 'Window' }));
    expect(menu.getByText('Script in its own window').closest('button')).toHaveProperty('ariaChecked', 'true');
    expect(menu.getByText('Plot lanes in its own window').closest('button')).toHaveProperty('ariaChecked', 'false');
  });

  it('greys a command that cannot be run rather than hiding it', () => {
    const onCommand = bar({ disabled: new Set<CommandId>(['file.save']) });
    fireEvent.click(screen.getByText('File'));
    const save = within(screen.getByRole('menu', { name: 'File' })).getByText('Save').closest('button')!;
    expect(save).toHaveProperty('disabled', true);
    fireEvent.click(save);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('runs an accelerator with the cursor anywhere, unless a native menu owns it', () => {
    const onCommand = bar();
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(onCommand).toHaveBeenCalledWith('file.save');

    cleanup();
    const native = vi.fn();
    render(<MenuBar onCommand={native} checked={new Set()} mac native />);
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    // The system menu has it; handling it twice would be worse than not at all.
    expect(native).not.toHaveBeenCalled();
    expect(screen.queryByRole('menubar')).toBeNull();
  });
});

// ------------------------------------------------------------------- find

const script = (): ProjectFile => {
  let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  file = updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [
        { id: 'f1' as never, type: 'action', text: 'The lamp turns. The lamp answers.', characterId: null, attributes: {} },
      ],
    },
  });
  const second = addBeat(file, { unitId: file.units[0]!.id, title: 'Second' });
  return updateBeat(second.file, second.beat.id, {
    manuscript: {
      elements: [{ id: 'f2' as never, type: 'action', text: 'A lamp, unlit.', characterId: null, attributes: {} }],
    },
  });
};

function Find({ replacing = true }: { replacing?: boolean }) {
  const [file, setFile] = useState(script());
  const [went, setWent] = useState('');
  return (
    <>
      <p data-testid="went">{went}</p>
      <p data-testid="text">{file.beats.flatMap((beat) => beat.manuscript.elements.map((e) => e.text)).join(' | ')}</p>
      <FindPanel
        file={file}
        open
        replacing={replacing}
        onClose={() => undefined}
        onUpdate={(mutate) => setFile((current) => mutate(current))}
        onGoTo={(beatId) => setWent(beatId)}
        step={0}
      />
    </>
  );
}

describe('find and replace', () => {
  it('counts what it found and steps through it, taking the selection along', () => {
    render(<Find />);
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'lamp' } });
    expect(screen.getByText('1 of 3')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Next match'));
    expect(screen.getByText('2 of 3')).toBeDefined();
    // The third match is in the other beat, and going to it selects that beat.
    fireEvent.click(screen.getByLabelText('Next match'));
    expect(screen.getByText('3 of 3')).toBeDefined();
    expect(screen.getByTestId('went').textContent).not.toBe('');
  });

  it('says so plainly when there is nothing', () => {
    render(<Find />);
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'zebra' } });
    expect(screen.getByText('No matches')).toBeDefined();
  });

  it('replaces the one in hand, and then all of them', () => {
    render(<Find />);
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'lamp' } });
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'beacon' } });

    fireEvent.click(screen.getByText('Replace'));
    expect(screen.getByTestId('text').textContent).toBe('The beacon turns. The lamp answers. | A lamp, unlit.');

    fireEvent.click(screen.getByText('Replace all'));
    expect(screen.getByTestId('text').textContent).toBe('The beacon turns. The beacon answers. | A beacon, unlit.');
    expect(screen.getByText('Replaced 2.')).toBeDefined();
  });

  it('offers no replacing at all when it was opened only to find', () => {
    render(<Find replacing={false} />);
    expect(screen.queryByLabelText('Replace with')).toBeNull();
  });
});

// -------------------------------------------------------------- page setup

describe('page setup', () => {
  function Setup({ format = 'screenplay' }: { format?: ProjectFormat }) {
    const [setup, setSetup] = useState<PrintSetup>(DEFAULT_PRINT_SETUP);
    return (
      <>
        <p data-testid="setup">{JSON.stringify(setup)}</p>
        <PageSetup
          file={createProjectFile({ title: 'T', format })}
          open
          onClose={() => undefined}
          setup={setup}
          onSetup={setSetup}
          pages={12}
          onPrint={() => undefined}
          onExportPdf={() => undefined}
          busy={false}
        />
      </>
    );
  }

  it('holds what a printing carries, in one place', () => {
    render(<Setup />);
    fireEvent.click(screen.getByLabelText('Title page'));
    fireEvent.click(screen.getByLabelText('Beat titles'));
    fireEvent.change(screen.getByLabelText('Watermark'), { target: { value: 'DRAFT' } });

    const setup = JSON.parse(screen.getByTestId('setup').textContent as string) as PrintSetup;
    expect(setup.includeTitlePage).toBe(false);
    expect(setup.includeBeatTitles).toBe(true);
    expect(setup.watermark).toBe('DRAFT');
  });

  it('offers every switch the writer asked for, in two groups', () => {
    render(<Setup />);
    for (const label of [
      'Title page',
      'Scene headings',
      'Page numbers',
      'Scene numbers',
      'Beat titles',
      'Scene summary',
      'Links in the scene',
      'Date and time',
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('starts as the delivered manuscript: no notes, no date, no scene numbers', () => {
    render(<Setup />);
    const off = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).checked;
    expect(off('Title page')).toBe(true);
    expect(off('Scene headings')).toBe(true);
    expect(off('Page numbers')).toBe(true);
    // None of these is the writing, so none of them prints by accident.
    expect(off('Scene numbers')).toBe(false);
    expect(off('Beat titles')).toBe(false);
    expect(off('Scene summary')).toBe(false);
    expect(off('Links in the scene')).toBe(false);
    expect(off('Date and time')).toBe(false);
  });

  it('records each switch as it is thrown', () => {
    render(<Setup />);
    fireEvent.click(screen.getByLabelText('Scene numbers'));
    fireEvent.click(screen.getByLabelText('Scene summary'));
    fireEvent.click(screen.getByLabelText('Links in the scene'));
    fireEvent.click(screen.getByLabelText('Page numbers'));

    const setup = JSON.parse(screen.getByTestId('setup').textContent as string) as PrintSetup;
    expect(setup.includeSceneNumbers).toBe(true);
    expect(setup.includeSceneSummary).toBe(true);
    expect(setup.includeSceneLinks).toBe(true);
    expect(setup.includePageNumbers).toBe(false);
  });

  it('does not offer scene numbers to a book, which has no scenes to number', () => {
    render(<Setup format="novel" />);
    expect(screen.queryByLabelText('Scene numbers')).toBeNull();
    expect(screen.getByLabelText('Scene headings')).toBeTruthy();
  });

  it('does not offer chapter pages to a format that has none', () => {
    render(<Setup format="screenplay" />);
    expect(screen.queryByLabelText('Chapter pages')).toBeNull();
    cleanup();
    render(<Setup format="novel" />);
    expect(screen.getByLabelText('Chapter pages')).toBeDefined();
  });
});
