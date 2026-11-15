// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { addBeat, createProjectFile, updateBeat, type BeatId, type ProjectFile } from '@vcwriter/domain';
import { MasterPanel } from '../components/MasterPanel';

/**
 * A beat chosen in the plot tracks is not only scrolled to in the Script or
 * Sheet: it is marked there in gold, and flashes as it arrives (from Ken,
 * 15 November: *it needs to not just pop to it, but highlight… or have that
 * little side left hand gold line*).
 */

afterEach(cleanup);

const line = (text: string) => ({ id: `e-${text}` as never, type: 'action' as const, text, characterId: null, attributes: {} });

const project = (format: 'screenplay' | 'short_form'): { file: ProjectFile; ids: BeatId[] } => {
  let file = createProjectFile({ title: 'Lighthouse', format });
  const ids: BeatId[] = [file.beats[0]!.id];
  for (const title of ['Two', 'Three']) {
    const added = addBeat(file, { unitId: file.units[0]!.id, title });
    file = added.file;
    ids.push(added.beat.id);
  }
  ids.forEach((id, index) => {
    file = updateBeat(file, id, { inScript: true, manuscript: { elements: [line(`Line ${index + 1}`)] } } as never);
  });
  return { file, ids };
};

/** The tracks stand outside the panel: a button per beat picks it, as a click there would. */
function Harness({ initial, ids }: { initial: ProjectFile; ids: BeatId[] }) {
  const [file, setFile] = useState(initial);
  const [selected, setSelected] = useState<BeatId | null>(null);
  return (
    <>
      {ids.map((id, index) => (
        <button key={id} type="button" onClick={() => setSelected(id)}>
          track {index + 1}
        </button>
      ))}
      <MasterPanel
        file={file}
        selectedBeatId={selected}
        onSelectBeat={setSelected}
        onUpdate={(mutate) => setFile((current) => mutate(current))}
        focusMode={false}
        focusTitleBeatId={null}
        onTitleFocused={() => undefined}
        dictationShortcut={null}
      />
    </>
  );
}

describe('the beat chosen in the tracks, found at a glance', () => {
  it('is marked in the Script, flashes as it arrives, and its scene keeps a thinner line', () => {
    const { file, ids } = project('screenplay');
    const view = render(<Harness initial={file} ids={ids} />);
    fireEvent.click(view.getByRole('button', { name: 'track 2' }));
    const selected = document.querySelectorAll('.beat-block.selected');
    expect(selected).toHaveLength(1);
    expect(selected[0]!.classList.contains('arrived')).toBe(true);
    expect(selected[0]!.textContent).toContain('Line 2');
    expect(document.querySelectorAll('.beat-block.in-selected-scene')).toHaveLength(2);
  });

  it('is marked in the short-form Sheet, and flashes as it arrives', () => {
    const { file, ids } = project('short_form');
    const view = render(<Harness initial={file} ids={ids} />);
    fireEvent.click(view.getByRole('button', { name: 'track 3' }));
    const row = document.querySelector('tr.av-selected');
    expect(row?.getAttribute('data-av-row')).toBe(ids[2]);
    expect(row?.classList.contains('arrived')).toBe(true);
    expect(document.querySelectorAll('tr.av-selected')).toHaveLength(1);
  });
});
