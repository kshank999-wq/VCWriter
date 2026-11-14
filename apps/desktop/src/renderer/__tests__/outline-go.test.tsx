// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addItem, beatsForUnit, createOutline, createProjectFile, promoteRow } from '@vcwriter/domain';
import { OutlinerWindow } from '../components/OutlinerWindow';

/** Go: from the chosen outline row to where it is written (from Ken, 13 November). */

afterEach(cleanup);

const planned = () => {
  const start = createOutline(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  const id = start.outline.id;
  const scene = addItem(start.file, id, { kind: 'scene', title: 'Warehouse' });
  const enters = addItem(scene.file, id, { parentId: scene.itemId, kind: 'beat', title: 'Mara enters.' });
  const loose = addItem(enters.file, id, { kind: 'note', title: 'Loose plan' });
  const sent = promoteRow(loose.file, id, scene.itemId!);
  return { file: sent.file, beat: beatsForUnit(sent.file, sent.unitId!)[0]! };
};

describe('Go in the Outliner', () => {
  it('shows on the chosen row only, opens the writing screen at its beat, and is greyed out off the track', () => {
    const { file, beat } = planned();
    const go = vi.fn();
    render(<OutlinerWindow file={file} open onClose={() => {}} onUpdate={() => {}} onGoToWriting={go} />);
    expect(screen.queryByRole('button', { name: /Go/ })).toBeNull();

    const row = document.querySelector(`.outline-row[data-beat="${beat.id}"]`) as HTMLElement;
    fireEvent.pointerDown(row);
    fireEvent.click(screen.getByRole('button', { name: 'Go ▸' }));
    expect(go).toHaveBeenCalledWith(beat.id);

    const plan = Array.from(document.querySelectorAll('.outline-row')).find((one) => one.textContent?.includes('Loose plan')) as HTMLElement;
    fireEvent.pointerDown(plan);
    expect((screen.getByRole('button', { name: 'Go ▸' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
