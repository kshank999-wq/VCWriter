// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  createProjectFile,
  setRowFrame,
  setTitlePage,
  updateBeat,
  updateUnit,
  type ProjectFile,
} from '@vcwriter/domain';
import { MasterPanel } from '../components/MasterPanel';
import { paneNamesFor, scriptWordFor } from '../panes';
import { MAX_EDGE, isPicture, pictureFrom } from '../frames';

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
    expect(first.getByLabelText('Action before the line in shot 1.1')).toHaveProperty('value', '00:00');
    expect(first.getByLabelText('What is heard in row 1.1')).toHaveProperty(
      'value',
      'Sun Tzu said "know your enemy"',
    );
    expect(first.getByLabelText('What is seen in row 1.1')).toHaveProperty(
      'value',
      'nerdy kid walking down the street',
    );
    expect(first.getByLabelText('How long the line in shot 1.1 takes')).toHaveProperty('value', '00:04');
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
    expect(document.querySelector('.av-totals')?.textContent).toContain('Total RT');
    expect(document.querySelector('.av-totals')?.textContent).toContain('00:09');
    expect(document.querySelector('.av-totals')?.textContent).toContain('Total Words: 15');

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
    const box = () => screen.getByLabelText('How long the line in shot 1.1 takes');
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
    fireEvent.click(screen.getAllByRole('button', { name: '+ Shot' })[0]!);
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

describe('narration, dialogue and the stripped workspace', () => {
  it('puts a line in quotation marks on Tab, and takes them off again', () => {
    panel(commercial());
    const box = () => screen.getByLabelText('What is heard in row 1.1') as HTMLTextAreaElement;
    fireEvent.change(box(), { target: { value: 'You are always late' } });

    box().setSelectionRange(0, 0);
    fireEvent.keyDown(box(), { key: 'Tab' });
    expect(box()).toHaveProperty('value', '"You are always late"');

    // The same key changes its mind, because it is the same decision.
    box().setSelectionRange(0, 0);
    fireEvent.keyDown(box(), { key: 'Tab' });
    expect(box()).toHaveProperty('value', 'You are always late');
  });

  it('marks only the line the caret is on', () => {
    panel(commercial());
    const audio = screen.getByLabelText('What is heard in row 1.1') as HTMLTextAreaElement;
    fireEvent.change(audio, { target: { value: 'The bell rings.\nYou came.' } });

    const box = screen.getByLabelText('What is heard in row 1.1') as HTMLTextAreaElement;
    box.setSelectionRange(box.value.length, box.value.length);
    fireEvent.keyDown(box, { key: 'Tab' });
    expect(screen.getByLabelText('What is heard in row 1.1')).toHaveProperty(
      'value',
      'The bell rings.\n"You came."',
    );
  });

  it('says Segment and puts the name beside the number', () => {
    panel(commercial());
    expect(screen.getByText('Segment 1')).toBeTruthy();
    expect(screen.getByLabelText('Name of segment 1')).toHaveProperty('value', 'Know your enemy...');
    // The visual column has no Tab of its own: it is not spoken.
    const visual = screen.getByLabelText('What is seen in row 1.1') as HTMLTextAreaElement;
    const was = visual.value;
    fireEvent.keyDown(visual, { key: 'Tab' });
    expect(screen.getByLabelText('What is seen in row 1.1')).toHaveProperty('value', was);
  });
});

describe('storyboard frames on the sheet', () => {
  const picture = 'data:image/png;base64,iVBORw0KGgo=';

  it('offers a plate to drop a frame on, one to a row', () => {
    panel(commercial());
    expect(screen.getByLabelText('Add a frame to row 1.1')).toBeTruthy();
    expect(screen.getByLabelText('Add a frame to row 1.2')).toBeTruthy();
    expect(screen.getAllByText('Drop a frame')).toHaveLength(2);
  });

  it('shows the frame a row already has, and lets it go', () => {
    let file = commercial();
    file = setRowFrame(file, file.beats[0]!.id, { name: 'open.png', data: picture, width: 800, height: 450 }).file;
    panel(file);

    const frame = document.querySelector('.av-plate.filled img') as HTMLImageElement;
    expect(frame.getAttribute('src')).toBe(picture);
    // And the plate says it would replace rather than add.
    expect(screen.getByLabelText('Replace the frame for row 1.1')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Remove the frame from row 1.1'));
    expect(document.querySelector('.av-plate.filled')).toBeNull();
    expect(screen.getByLabelText('Add a frame to row 1.1')).toBeTruthy();
  });

  it('lines the audio up with the frames, because a row is one row', () => {
    let file = commercial();
    file = setRowFrame(file, file.beats[0]!.id, { data: picture }).file;
    panel(file);

    // The frame and the words it belongs to are cells of the same row: the
    // alignment is the layout, not a thing computed on top of it.
    const row = document.querySelectorAll('.av-row')[0] as HTMLElement;
    expect(within(row).getByLabelText('What is heard in row 1.1')).toBeTruthy();
    expect(row.querySelector('.av-plate.filled img')).toBeTruthy();
  });

  it('reads a picture, scales it, and refuses what is not one', async () => {
    // The scaling itself needs a canvas, which jsdom has none of; what is
    // tested here is that a picture is told from anything else.
    expect(isPicture(new File([''], 'a.png', { type: 'image/png' }))).toBe(true);
    expect(isPicture(new File([''], 'a.txt', { type: 'text/plain' }))).toBe(false);
    expect(MAX_EDGE).toBe(960);

    const list = {
      0: new File([''], 'note.txt', { type: 'text/plain' }),
      1: new File([''], 'frame.png', { type: 'image/png' }),
      length: 2,
      item: (index: number) => (index === 0 ? list[0] : list[1]),
    } as unknown as FileList;
    expect(pictureFrom(list)?.name).toBe('frame.png');
    expect(pictureFrom(null)).toBeNull();
  });
});

describe('a shot’s three times', () => {
  it('calls it a shot, and takes the count off the number', () => {
    panel(commercial());
    expect(screen.getByText('Shot')).toBeTruthy();
    expect(screen.queryByText('Row')).toBeNull();
    // The words and the running time used to sit under the number; the
    // duration is on the other side of the image, so they have gone.
    const number = document.querySelectorAll('.av-row th')[0] as HTMLElement;
    expect(number.textContent).toBe('1.1');
  });

  it('gives the duration three lines, and the words their own column', () => {
    panel(commercial());
    const row = within(document.querySelectorAll('.av-row')[0] as HTMLElement);
    expect(row.getByText('Header')).toBeTruthy();
    expect(row.getByText('Dialogue')).toBeTruthy();
    expect(row.getByText('Tail')).toBeTruthy();
    expect(screen.getByText('Words +/−')).toBeTruthy();
    expect(row.getByText('6 words')).toBeTruthy();
  });

  it('sets the header and the tail, and adds them to the shot', () => {
    panel(commercial());
    const head = screen.getByLabelText('Action before the line in shot 1.1');
    fireEvent.change(head, { target: { value: '2' } });
    fireEvent.blur(head);
    const tail = screen.getByLabelText('Action after the line in shot 1.1');
    fireEvent.change(tail, { target: { value: '3' } });
    fireEvent.blur(tail);

    expect(screen.getByLabelText('Action before the line in shot 1.1')).toHaveProperty('value', '00:02');
    expect(screen.getByLabelText('Action after the line in shot 1.1')).toHaveProperty('value', '00:03');
    // Four for the line, plus two and three, plus the second shot's five:
    // the masthead says fourteen, and so do the segment's two figures.
    expect(screen.getAllByText('00:14')).toHaveLength(3);
  });

  it('hands the line back to its words when the box is cleared', () => {
    panel(commercial());
    const box = () => screen.getByLabelText('How long the line in shot 1.1 takes');
    expect(box().className).not.toContain('estimated');

    fireEvent.change(box(), { target: { value: '' } });
    fireEvent.blur(box());
    // Six words at two and a half a second: three seconds, and drawn as the
    // estimate it is.
    expect(box()).toHaveProperty('value', '00:03');
    expect((box().closest('.av-time-line') as HTMLElement).className).toContain('estimated');
  });

  it('offers a segment where the last one ended, not only at the bottom', () => {
    panel(commercial());
    expect(screen.getAllByRole('button', { name: '+ Segment' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '+ Segment' }));
    expect(screen.getAllByRole('button', { name: '+ Segment' })).toHaveLength(2);
    expect(screen.getByLabelText('Name of segment 2')).toBeTruthy();
  });
});

describe('the slot it has to fit', () => {
  it('offers a box for it, empty until one is set', () => {
    panel(commercial());
    expect(screen.getByText('Time constraint')).toBeTruthy();
    expect(screen.getByLabelText('The time this has to fit')).toHaveProperty('value', '00:00');
  });

  it('turns the total red and says by how much when the board runs over', () => {
    panel(commercial());
    const limit = screen.getByLabelText('The time this has to fit');
    fireEvent.change(limit, { target: { value: '30' } });
    fireEvent.blur(limit);

    // Nine seconds in a thirty: nothing to say.
    expect(document.querySelector('.av-over')).toBeNull();
    expect(screen.queryByText(/Over by/)).toBeNull();

    const head = screen.getByLabelText('Action before the line in shot 1.1');
    fireEvent.change(head, { target: { value: '40' } });
    fireEvent.blur(head);

    expect(document.querySelector('.av-over')?.textContent).toBe('00:49');
    expect(screen.getByText('Over by 00:19')).toBeTruthy();
  });

  it('refuses nothing, and says so with the words still there', () => {
    panel(commercial());
    const limit = screen.getByLabelText('The time this has to fit');
    fireEvent.change(limit, { target: { value: '2' } });
    fireEvent.blur(limit);
    expect(screen.getByText(/Over by/)).toBeTruthy();
    // Every word of it still on the sheet.
    expect(screen.getByLabelText('What is heard in row 1.1')).toBeTruthy();
  });
});
