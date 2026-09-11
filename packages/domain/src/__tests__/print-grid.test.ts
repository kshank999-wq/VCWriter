import { describe, expect, it } from 'vitest';
import {
  addMarker,
  addUnit,
  createProjectFile,
  renderGridDocumentHtml,
  setSceneCommandment,
  setSceneGrid,
  setStoryCommandments,
  setStoryGrid,
  setTitlePage,
  suggestedGridFileName,
  unitsInStoryOrder,
  updateUnit,
  type ProjectFile,
} from '../index.js';

/**
 * The Story Grid, printed (addendum 04 §8 stage 6): the tab as a document.
 */

/** The document without its stylesheet, so a count is a count of the markup. */
const bodyOf = (html: string): string => html.slice(html.indexOf('<body>'));

const gridded = (): ProjectFile => {
  let file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  file = updateUnit(file, file.units[0]!.id, { title: 'The stair' });
  for (const title of ['The corner', 'The lamp', 'The door']) {
    file = addUnit(file, { laneId: file.lanes[0]!.id, title }).file;
  }
  const order = unitsInStoryOrder(file);
  file = addMarker(file, { unitId: order[0]!.id, title: 'Setup', kind: 'act' }).file;
  file = addMarker(file, { unitId: order[2]!.id, title: 'Confrontation', kind: 'act' }).file;

  // The genre is chosen first and offers its own value; typing one over it
  // keeps the writer's, which is stage 1's rule and worth printing faithfully.
  file = setStoryGrid(file, { genre: 'thriller', controllingIdea: 'Courage costs.' });
  file = setStoryGrid(file, { value: 'life / death' });
  file = setStoryCommandments(file, { inciting: 'The lamp goes out.' });
  file = setSceneGrid(file, order[0]!.id, { polarity: 'down', event: 'She climbs.', value: 'fear / courage' });
  file = setSceneGrid(file, order[1]!.id, { polarity: 'down' });
  file = setSceneGrid(file, order[2]!.id, { polarity: 'up' });
  return setSceneCommandment(file, order[0]!.id, 'crisis', 'Climb blind, or leave the boats.');
};

describe('the grid as a document', () => {
  it('is landscape, because twelve columns read across', () => {
    expect(renderGridDocumentHtml(gridded())).toContain('size: letter landscape');
  });

  it('prints what the story is, and what it owes', () => {
    const html = renderGridDocumentHtml(gridded());
    expect(html).toContain('What the story is');
    expect(html).toContain('Thriller');
    expect(html).toContain('life / death');
    expect(html).toContain('Courage costs.');
    // A thriller's checklist arrives with the genre, so it prints with it.
    expect(html).toContain('What it owes');
  });

  it('prints the five at the story and act scales', () => {
    const html = renderGridDocumentHtml(gridded());
    expect(html).toContain('The five commandments');
    expect(html).toContain('The lamp goes out.');
    expect(html).toContain('ACT I');
    expect(html).toContain('ACT II');
  });

  it('says so where there are no act breaks to ask about', () => {
    let file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    file = setStoryGrid(file, { genre: 'crime' });
    expect(renderGridDocumentHtml(file)).toContain('No act breaks are marked');
  });

  it('prints a row for every scene, with what is measured and what is not', () => {
    const body = bodyOf(renderGridDocumentHtml(gridded()));
    expect(body).toContain('The stair');
    expect(body).toContain('The door');
    expect(body).toContain('She climbs.');
    expect(body).toContain('Climb blind, or leave the boats.');
    // Four scenes, and the head row above them.
    expect(body.split('<tr>').length - 1).toBeGreaterThanOrEqual(4);
  });

  it('draws an empty cell rather than leaving it blank, because the gaps are the finding', () => {
    const body = bodyOf(renderGridDocumentHtml(gridded()));
    expect(body).toContain('grid-empty');
  });

  it('draws the value graph from the same geometry the tab draws', () => {
    const html = renderGridDocumentHtml(gridded());
    expect(html).toContain('value-line');
    expect(html).toContain('value-base');
    // Three answered, one not: the unanswered point is drawn hollow.
    expect(bodyOf(html)).toContain('value-point unsaid');
  });

  it('leaves the graph out of a story too short to have a line', () => {
    let file = createProjectFile({ title: 'One', format: 'screenplay' });
    file = setSceneGrid(file, file.units[0]!.id, { polarity: 'up' });
    // The class names are in the stylesheet either way; the drawing is not.
    expect(bodyOf(renderGridDocumentHtml(file))).not.toContain('value-line');
    expect(bodyOf(renderGridDocumentHtml(gridded()))).toContain('value-line');
  });

  it('opens with a title page, and without one where the setup says so', () => {
    expect(renderGridDocumentHtml(gridded())).toContain('<section class="page title-page">');
    expect(renderGridDocumentHtml(gridded(), { includeTitlePage: false })).not.toContain(
      '<section class="page title-page">',
    );
  });

  it('escapes what a writer typed rather than letting it become markup', () => {
    const file = setStoryGrid(gridded(), { controllingIdea: '<script>alert(1)</script>' });
    const html = renderGridDocumentHtml(file);
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;');
  });

  it('keeps a scene on one sheet and repeats the heads on the next', () => {
    const html = renderGridDocumentHtml(gridded());
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('table-header-group');
  });

  it('is named for the piece, and apart from the script', () => {
    expect(suggestedGridFileName(setTitlePage(gridded(), { title: 'Blackout' }))).toBe('Blackout story grid.pdf');
  });

  it('grades nothing: there is no score anywhere in it (§7)', () => {
    const body = bodyOf(renderGridDocumentHtml(gridded())).toLowerCase();
    expect(body).not.toContain('score');
    // No "68% complete", and nothing out of ten.
    expect(body).not.toMatch(/\d+\s*%/);
    expect(body).not.toMatch(/\d+\s*\/\s*10\b/);
  });
});
