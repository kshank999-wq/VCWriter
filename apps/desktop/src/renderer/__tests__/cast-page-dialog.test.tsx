// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { castPageOf, createProjectFile, notedCast, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { CastPageDialog } from '../components/CastPageDialog';
import { DEFAULT_PRINT_SETUP, PageSetup } from '../components/PageSetup';

/**
 * **The cast page, where a writer can reach it** (addendum 38 §4): File →
 * Cast page… and Page setup's tick, on a play and nowhere else.
 */

afterEach(cleanup);

const el = (type: string, text: string) => ({
  id: crypto.randomUUID() as never,
  type: type as never,
  text,
  characterId: null,
  attributes: {},
});

const play = (): ProjectFile => {
  const file = createProjectFile({ title: 'The Lamp', format: 'stage_play' });
  return notedCast(
    updateBeat(file, file.beats[0]!.id, {
      manuscript: { elements: [el('character', 'TOM'), el('dialogue', 'Well.'), el('character', 'SARAH')] },
    }),
  );
};

function Harness({ start, onFile }: { start: ProjectFile; onFile(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile(file);
  return <CastPageDialog file={file} open onClose={() => undefined} onUpdate={(mutate) => setFile(mutate)} />;
}

describe('the cast page dialog', () => {
  it('lists the roles in the order they enter and draws the page as it is typed', () => {
    let latest = play();
    render(<Harness start={latest} onFile={(file) => (latest = file)} />);
    const legends = [...document.querySelectorAll('.cast-role legend')].map((one) => one.textContent?.trim());
    expect(legends).toEqual(['TOM', 'SARAH']);

    fireEvent.change(screen.getByLabelText('TOM: the line under the name'), { target: { value: 'a lighthouse keeper' } });
    expect(document.querySelector('.cast-page-sheet')?.textContent).toContain('TOM, a lighthouse keeper');
    // A draft: nothing is in the document until Update page.
    expect(castPageOf(latest).roles[0]?.description).toBe('');

    fireEvent.click(screen.getByLabelText('List SARAH'));
    fireEvent.change(screen.getByLabelText('Place'), { target: { value: 'A lighthouse.' } });
    fireEvent.click(screen.getByText('Update page'));
    expect(castPageOf(latest)).toMatchObject({
      roles: [{ name: 'TOM', description: 'a lighthouse keeper' }],
      place: 'A lighthouse.',
    });
  });
});

describe('page setup', () => {
  const setup = (file: ProjectFile) =>
    render(
      <PageSetup
        file={file}
        open
        onClose={() => undefined}
        setup={DEFAULT_PRINT_SETUP}
        onSetup={() => undefined}
        onEditTitlePage={() => undefined}
        onEditCastPage={() => undefined}
        onParagraphStyle={() => undefined}
        onScriptFormat={() => undefined}
        onActBreaks={() => undefined}
        onSectionNumbering={() => undefined}
        pages={1}
        onPrint={() => undefined}
        onExportPdf={() => undefined}
        busy={false}
      />,
    );

  it('offers the cast page on a play', () => {
    setup(play());
    expect(screen.getByLabelText('Print the cast page')).toBeTruthy();
  });

  it('does not on a screenplay', () => {
    setup(createProjectFile({ title: 'Film', format: 'screenplay' }));
    expect(screen.queryByLabelText('Print the cast page')).toBeNull();
  });
});
