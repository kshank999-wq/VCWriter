// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  createProjectFile,
  setTitlePage,
  updateBeat,
  updateUnit,
  type ProjectFile,
} from '@vcwriter/domain';
import { MasterPanel } from '../components/MasterPanel';
import { paneNamesFor, scriptWordFor } from '../panes';

/**
 * Short form's document is the AV sheet, in place of the Script (addendum 05).
 *
 * The sheet's own arithmetic is tested in the domain. What these cover is the
 * part a writer meets: that short form gets the sheet rather than the script,
 * that the rows and the figures are there, and that the masthead is the title
 * page's rather than anything typed on the sheet.
 */

afterEach(cleanup);

const line = (text: string) => ({
  id: `e-${text.slice(0, 6)}` as never,
  type: 'dialogue' as const,
  text,
  characterId: null,
  attributes: {},
});

const commercial = (): ProjectFile => {
  let file = createProjectFile({ title: 'Commercial 1', format: 'short_form' });
  file = updateUnit(file, file.units[0]!.id, {
    title: 'Know your enemy...',
    summary: 'More important to know who is not your enemy',
  });
  file = updateBeat(file, file.beats[0]!.id, {
    manuscript: { elements: [line('Sun Tzu said "know your enemy"')] },
    visual: 'nerdy kid walking down the street',
    seconds: 4,
  });
  const second = addBeat(file, { unitId: file.units[0]!.id, title: 'Two' });
  return updateBeat(second.file, second.beat.id, {
    manuscript: { elements: [line('In this era - almost everyone is the enemy...')] },
    visual: 'Kid continues walking.',
    seconds: 5,
  });
};

const panel = (file: ProjectFile, onOpenBeat?: (beatId: string) => void) =>
  render(
    <MasterPanel
      file={file}
      selectedBeatId={null}
      onSelectBeat={() => undefined}
      onUpdate={() => undefined}
      focusMode={false}
      focusTitleBeatId={null}
      onTitleFocused={() => undefined}
      dictationShortcut={null}
      {...(onOpenBeat ? { onOpenBeat: onOpenBeat as never } : {})}
    />,
  );

describe('the sheet in place of the script', () => {
  it('is what a short-form project shows, and the section is called Sheet', () => {
    panel(commercial());
    expect(document.querySelector('.av-sheet')).toBeTruthy();
    expect(document.querySelector('.story-view')).toBeNull();
    expect(paneNamesFor('short_form').script).toBe('Sheet');
    expect(scriptWordFor('short_form')).toBe('sheet');
  });

  it('leaves every other format alone', () => {
    panel(createProjectFile({ title: 'Lighthouse', format: 'screenplay' }));
    expect(document.querySelector('.av-sheet')).toBeNull();
    expect(paneNamesFor('screenplay').script).toBe('Script');
    expect(paneNamesFor('novel').script).toBe('Manuscript');
  });

  it('lays the rows out with their numbers, words and times', () => {
    panel(commercial());
    const rows = document.querySelectorAll('.av-row');
    expect(rows).toHaveLength(2);

    const first = within(rows[0] as HTMLElement);
    expect(first.getByText('1.1')).toBeTruthy();
    expect(first.getByText('6 words')).toBeTruthy();
    expect(first.getByText('Sun Tzu said "know your enemy"')).toBeTruthy();
    expect(first.getByText('nerdy kid walking down the street')).toBeTruthy();
    expect(first.getAllByText('00:04').length).toBeGreaterThan(0);
  });

  it('names the segment from the scene and closes it with its figures', () => {
    panel(commercial());
    // The name is at the head of the segment, and again at its foot.
    expect(screen.getAllByText('Know your enemy...')).toHaveLength(2);
    expect(screen.getByText('More important to know who is not your enemy')).toBeTruthy();

    const foot = document.querySelector('.av-segment-foot') as HTMLElement;
    const figures = within(foot);
    expect(figures.getByText('Segment RT')).toBeTruthy();
    expect(figures.getByText('Segment words')).toBeTruthy();
    // Two rows: four seconds and five, six words and nine.
    expect(figures.getAllByText('00:09').length).toBe(2);
    expect(figures.getAllByText('15').length).toBe(2);
  });

  it('takes the masthead from the title page, not from the sheet', () => {
    let file = commercial();
    panel(file);
    expect(screen.getByText('Commercial 1')).toBeTruthy();
    expect(screen.getByText('v1')).toBeTruthy();
    expect(screen.getByText(/Total RT 00:09 • Total Words: 15/)).toBeTruthy();

    cleanup();
    file = setTitlePage(file, { title: 'Know Your Enemy', revision: 'v3' });
    panel(file);
    expect(screen.getByText('Know Your Enemy')).toBeTruthy();
    expect(screen.getByText('v3')).toBeTruthy();
  });

  it('opens a row in the writing screen everything else opens in', () => {
    let file = commercial();
    const opened: string[] = [];
    panel(file, (beatId) => opened.push(beatId));
    fireEvent.click(screen.getByRole('button', { name: '1.2' }));
    expect(opened).toEqual([file.beats.at(-1)?.id]);
  });

  it('says so plainly when there is nothing on the board yet', () => {
    const empty = createProjectFile({ title: 'Untitled', format: 'short_form' });
    panel({ ...empty, beats: [] });
    expect(screen.getByText(/Nothing on the board yet/)).toBeTruthy();
  });

  it('says when a row has more words than its time holds, and nothing else', () => {
    let file = commercial();
    file = updateBeat(file, file.beats[0]!.id, { seconds: 1 });
    panel(file);
    expect(screen.getByText(/More words than 00:01 holds/)).toBeTruthy();
    // The other row is comfortable, so nothing is said about it.
    expect(screen.queryByText(/More words than 00:05/)).toBeNull();
  });
});
