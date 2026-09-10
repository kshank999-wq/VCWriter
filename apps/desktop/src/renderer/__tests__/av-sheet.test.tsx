// @vitest-environment jsdom
import { useState } from 'react';
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

function Harness({ initial, onOpenBeat }: { initial: ProjectFile; onOpenBeat?(beatId: string): void }) {
  const [file, setFile] = useState(initial);
  return (
    <MasterPanel
      file={file}
      selectedBeatId={null}
      onSelectBeat={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      focusMode={false}
      focusTitleBeatId={null}
      onTitleFocused={() => undefined}
      dictationShortcut={null}
      {...(onOpenBeat ? { onOpenBeat: onOpenBeat as never } : {})}
    />
  );
}

const panel = (file: ProjectFile, onOpenBeat?: (beatId: string) => void) =>
  render(<Harness initial={file} {...(onOpenBeat ? { onOpenBeat } : {})} />);

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
    expect(first.getByLabelText('What is heard in row 1.1')).toHaveProperty(
      'value',
      'Sun Tzu said "know your enemy"',
    );
    expect(first.getByLabelText('What is seen in row 1.1')).toHaveProperty(
      'value',
      'nerdy kid walking down the street',
    );
    expect(first.getByLabelText('How long row 1.1 runs')).toHaveProperty('value', '00:04');
  });

  it('names the segment from the scene and closes it with its figures', () => {
    panel(commercial());
    // The name is typed at the head of the segment, and printed at its foot.
    expect(screen.getByLabelText('Name of segment 1')).toHaveProperty('value', 'Know your enemy...');
    expect(screen.getByLabelText('What segment 1 is for')).toHaveProperty(
      'value',
      'More important to know who is not your enemy',
    );
    expect(screen.getByText('Know your enemy...')).toBeTruthy();

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
    panel({ ...empty, beats: [], units: [] });
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

describe('writing in the sheet', () => {
  it('types the audio and the visual in place', () => {
    panel(commercial());
    const audio = screen.getByLabelText('What is heard in row 1.1');
    fireEvent.change(audio, { target: { value: 'This is not for you...' } });
    expect(screen.getByLabelText('What is heard in row 1.1')).toHaveProperty('value', 'This is not for you...');
    // And the count follows what was typed, because it is the same words.
    expect(within(document.querySelectorAll('.av-row')[0] as HTMLElement).getByText('5 words')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('What is seen in row 1.1'), { target: { value: 'The kid nods' } });
    expect(screen.getByLabelText('What is seen in row 1.1')).toHaveProperty('value', 'The kid nods');
  });

  it('takes a time the way it is typed, and puts it back the way it prints', () => {
    panel(commercial());
    const box = () => screen.getByLabelText('How long row 1.1 runs');
    fireEvent.change(box(), { target: { value: '1:02' } });
    fireEvent.blur(box());
    expect(box()).toHaveProperty('value', '01:02');

    // Anything that is not a time leaves the row with the one it had.
    fireEvent.change(box(), { target: { value: 'soon' } });
    fireEvent.blur(box());
    expect(box()).toHaveProperty('value', '01:02');
  });

  it('names the segment and says what it is for', () => {
    panel(commercial());
    fireEvent.change(screen.getByLabelText('Name of segment 1'), { target: { value: 'The tag' } });
    // Which the foot of the segment says too, because it is one name.
    expect(screen.getByText('The tag')).toBeTruthy();
  });

  it('adds a row at the foot of the segment, and it is numbered in place', () => {
    panel(commercial());
    expect(document.querySelectorAll('.av-row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '+ Row' }));
    expect(document.querySelectorAll('.av-row')).toHaveLength(3);
    expect(screen.getByLabelText('What is heard in row 1.3')).toBeTruthy();
  });

  it('moves a row up and down, and removes one', () => {
    panel(commercial());
    fireEvent.click(screen.getByLabelText('Move row 1.2 up'));
    expect(screen.getByLabelText('What is heard in row 1.1')).toHaveProperty(
      'value',
      'In this era - almost everyone is the enemy...',
    );

    fireEvent.click(screen.getByLabelText('Remove row 1.1'));
    expect(document.querySelectorAll('.av-row')).toHaveLength(1);
    expect(screen.getByLabelText('What is heard in row 1.1')).toHaveProperty(
      'value',
      'Sun Tzu said "know your enemy"',
    );
  });

  it('starts a segment, with a row in it to write on', () => {
    panel(commercial());
    fireEvent.click(screen.getByRole('button', { name: '+ Segment' }));
    expect(screen.getByLabelText('Name of segment 2')).toBeTruthy();
    expect(screen.getByLabelText('What is heard in row 2.1')).toBeTruthy();
  });

  it('starts a board from nothing at all', () => {
    const empty = createProjectFile({ title: 'Untitled', format: 'short_form' });
    panel({ ...empty, beats: [], units: [] });
    fireEvent.click(screen.getByRole('button', { name: '+ Segment' }));
    expect(screen.queryByText(/Nothing on the board yet/)).toBeNull();
    expect(screen.getByLabelText('What is heard in row 1.1')).toBeTruthy();
  });
});
