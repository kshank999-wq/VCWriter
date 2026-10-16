// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createProjectFile, type ProjectFile, type ProjectFormat } from '@vcwriter/domain';
import { DEFAULT_PRINT_SETUP, PageSetup } from '../components/PageSetup';
import { Preferences } from '../components/Preferences';

/**
 * **The stage play's house styles, where a writer can reach them** (addendum
 * 37, from Ken: *when you select stage play, you need a dropdown or some type
 * of preference that can select the proper formatting for you*).
 *
 * What is pinned is the **gesture** (addendum 20 §15a): the six presets work
 * in the domain either way, and a play whose menu still offers four screen
 * formats reads exactly like the feature never having been built.
 */

afterEach(cleanup);

const project = (format: ProjectFormat): ProjectFile => createProjectFile({ title: 'The Lamp', format });

function Harness({ start, onFile }: { start: ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return (
    <PageSetup
      file={file}
      open
      onClose={() => undefined}
      setup={DEFAULT_PRINT_SETUP}
      onSetup={() => undefined}
      onEditTitlePage={() => undefined}
      onParagraphStyle={() => undefined}
      onScriptFormat={(scriptFormat) =>
        setFile((current) => ({ ...current, settings: { ...current.settings, scriptFormat } }))
      }
      onActBreaks={() => undefined}
      onSectionNumbering={() => undefined}
      pages={1}
      onPrint={() => undefined}
      onExportPdf={() => undefined}
      busy={false}
    />
  );
}

const choices = (): string[] =>
  Array.from(document.querySelectorAll('input[name="script-format"]')).map(
    (el) => el.getAttribute('aria-label') ?? '',
  );

describe('the menu a stage play is given', () => {
  it('offers the stage house styles and not one screen format', () => {
    render(<Harness start={project('stage_play')} />);
    expect(choices()).toEqual([
      'US modern play',
      'US traditional play',
      'US publisher reading copy',
      'UK BBC stage',
      'UK contemporary play',
      'Continental reading copy',
      // The musical (addendum 38 §3).
      'US musical',
    ]);
  });

  it('leaves a screenplay’s own four exactly as they were', () => {
    render(<Harness start={project('screenplay')} />);
    expect(choices()).toEqual(['US single-camera', 'US multi-camera', 'BBC drama', 'BBC taped']);
  });

  it('opens on the modern play rather than on a film, with nothing stored', () => {
    // A play carrying `us` was never offered a stage preset: it is the
    // fallthrough rather than anybody's choice, so what is lit is the page
    // the play is actually set on.
    render(<Harness start={project('stage_play')} />);
    const lit = document.querySelector('input[name="script-format"]:checked');
    expect(lit?.getAttribute('aria-label')).toBe('US modern play');
  });

  it('writes the one the writer picks', () => {
    let latest: ProjectFile | null = null;
    render(<Harness start={project('stage_play')} onFile={(file) => (latest = file)} />);
    fireEvent.click(screen.getByRole('radio', { name: 'UK BBC stage' }));
    expect((latest as unknown as ProjectFile).settings.scriptFormat).toBe('stage_uk_bbc');
  });
});

describe('where a writer looks first', () => {
  it('says in Preferences where a script’s format is set, that being the project’s', () => {
    // Ken looked here. It is the right instinct and the wrong record — this
    // dialog's own footer says preferences are kept on the computer — so it
    // is a route rather than a second control.
    render(
      <Preferences
        open
        onClose={() => undefined}
        scheme="gold"
        onScheme={() => undefined}
        paper={false}
        onPaper={() => undefined}
        format="stage_play"
      />,
    );
    expect(screen.getByRole('heading', { name: /Script format/i })).toBeTruthy();
    expect(screen.getByText(/File ▸ Page setup/)).toBeTruthy();
    // And there is no second control here: a dialog that set it would be two
    // answers about how one play is laid out.
    expect(document.querySelectorAll('input[name="script-format"]')).toHaveLength(0);
  });

  it('says nothing about it on a book, which has no house style to set', () => {
    render(
      <Preferences
        open
        onClose={() => undefined}
        scheme="gold"
        onScheme={() => undefined}
        paper={false}
        onPaper={() => undefined}
        format="novel"
      />,
    );
    expect(screen.queryByRole('heading', { name: /Script format/i })).toBeNull();
  });
});
