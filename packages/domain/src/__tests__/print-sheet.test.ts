import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addUnit,
  createProjectFile,
  renderBoardDocumentHtml,
  renderSheetDocumentHtml,
  setMaxSeconds,
  setRowFrame,
  setRowHead,
  setTitlePage,
  suggestedBoardFileName,
  suggestedSheetFileName,
  updateBeat,
  updateUnit,
  type ProjectFile,
} from '../index.js';
import { newId } from '../ids.js';
import type { ManuscriptElementId } from '../ids.js';

/**
 * Printing a board (addendum 05 §8): the sheet as it is on screen, and the
 * frames on their own for a wall.
 */

const line = (text: string) => ({
  id: newId<ManuscriptElementId>(),
  type: 'dialogue' as const,
  text,
  characterId: null,
  attributes: {},
});

const picture = 'data:image/png;base64,iVBORw0KGgo=';
const clip = 'data:video/mp4;base64,AAAA';

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

describe('the sheet as a document', () => {
  it('prints the masthead the sheet shows, from the title page', () => {
    const html = renderSheetDocumentHtml(setTitlePage(commercial(), { title: 'Know Your Enemy', revision: 'v3' }));
    expect(html).toContain('Know Your Enemy');
    expect(html).toContain('v3');
    // Four and five: nine seconds, fifteen words.
    expect(html).toContain('00:09');
    expect(html).toContain('Total Words: 15');
  });

  it('gives every shot its four times, named', () => {
    const html = renderSheetDocumentHtml(commercial());
    expect(html).toContain('>Header<');
    expect(html).toContain('>Dialogue<');
    expect(html).toContain('>Tail<');
    expect(html).toContain('>Video<');
  });

  it('closes each segment on its own four figures', () => {
    const html = renderSheetDocumentHtml(commercial());
    expect(html).toContain('End of segment 1');
    expect(html).toContain('Segment RT');
    expect(html).toContain('Segment words');
    expect(html).toContain('Total RT');
    expect(html).toContain('Total words');
  });

  it('says the slot, and says when the board is over it', () => {
    expect(renderSheetDocumentHtml(setMaxSeconds(commercial(), 30))).toContain('Time constraint: 00:30');
    const over = renderSheetDocumentHtml(setMaxSeconds(commercial(), 5));
    expect(over).toContain('over by 00:04');
    expect(over).toContain('sheet-over');
  });

  it('opens with a title page, and without one where the setup says so', () => {
    // The class name is in the stylesheet either way; the page itself is not.
    expect(renderSheetDocumentHtml(commercial())).toContain('<section class="page title-page">');
    expect(renderSheetDocumentHtml(commercial(), { includeTitlePage: false })).not.toContain(
      '<section class="page title-page">',
    );
  });

  it('prints a picture as the picture', () => {
    const file = commercial();
    const made = setRowFrame(file, file.beats[0]!.id, { data: picture, width: 800, height: 450 });
    expect(renderSheetDocumentHtml(made.file)).toContain(`src="${picture}"`);
  });

  it('prints a clip as what it is, because there is no frame to pull out of it', () => {
    const file = commercial();
    const made = setRowFrame(file, file.beats[0]!.id, {
      data: clip,
      kind: 'video',
      name: 'street.mp4',
      seconds: 11,
    });
    const html = renderSheetDocumentHtml(made.file);
    expect(html).toContain('street.mp4');
    expect(html).toContain('00:11');
    // Not the clip's own bytes: a board is paper.
    expect(html).not.toContain(clip);
  });

  it('says "holds" where the picture outlasts the sound', () => {
    const file = commercial();
    const made = setRowFrame(file, file.beats[0]!.id, { data: clip, kind: 'video', seconds: 20 });
    expect(renderSheetDocumentHtml(made.file)).toContain('holds');
    expect(renderSheetDocumentHtml(commercial())).not.toContain('>holds<');
  });

  it('escapes what a writer typed rather than letting it become markup', () => {
    let file = commercial();
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: { elements: [line('<script>alert(1)</script>')] },
    });
    const html = renderSheetDocumentHtml(file);
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;');
  });

  it('says so plainly when there is nothing on the board', () => {
    const empty = createProjectFile({ title: 'Untitled', format: 'short_form' });
    const html = renderSheetDocumentHtml({ ...empty, beats: [], units: [] });
    expect(html).toContain('Nothing on the board yet');
  });

  it('lets the browser paginate, and keeps a shot on one sheet', () => {
    const html = renderSheetDocumentHtml(commercial());
    expect(html).toContain('break-inside: avoid');
    // The column heads print again at the top of every page a segment runs on.
    expect(html).toContain('table-header-group');
  });
});

describe('the board as a document', () => {
  it('gives every shot a panel, with its number, its time and its line', () => {
    const html = renderBoardDocumentHtml(commercial());
    expect(html).toContain('board-panel');
    expect(html).toContain('>1.1<');
    expect(html).toContain('>1.2<');
    expect(html).toContain('Sun Tzu said &quot;know your enemy&quot;');
    expect(html).toContain('nerdy kid walking down the street');
  });

  it('heads each run of frames with its segment and how long it runs', () => {
    const html = renderBoardDocumentHtml(commercial());
    expect(html).toContain('Segment 1 — Know your enemy...');
    expect(html).toContain('00:09');
  });

  it('keeps a panel whole and keeps a shot with no picture in its place', () => {
    const html = renderBoardDocumentHtml(commercial());
    expect(html).toContain('sheet-plate empty');
    expect(html).toContain('break-inside: avoid');
  });

  it('runs the panels in the story order the sheet has them in', () => {
    let file = commercial();
    const made = addUnit(file, { laneId: file.lanes[0]!.id, title: 'Second' });
    file = addBeat(made.file, { unitId: made.unit.id, title: 'Three' }).file;
    const html = renderBoardDocumentHtml(file);
    expect(html.indexOf('Segment 1')).toBeLessThan(html.indexOf('Segment 2'));
    expect(html.indexOf('>1.2<')).toBeLessThan(html.indexOf('>2.1<'));
  });

  it('is named for the piece, and apart from the sheet', () => {
    const file = setTitlePage(commercial(), { title: 'Know Your Enemy' });
    expect(suggestedSheetFileName(file)).toBe('Know Your Enemy sheet.pdf');
    expect(suggestedBoardFileName(file)).toBe('Know Your Enemy board.pdf');
  });

  it('carries a shot whose header and tail put it past its line', () => {
    const file = commercial();
    const html = renderBoardDocumentHtml(setRowHead(file, file.beats[0]!.id, 6));
    // Six of header over four of line: a ten-second shot on the wall.
    expect(html).toContain('00:10');
  });
});
