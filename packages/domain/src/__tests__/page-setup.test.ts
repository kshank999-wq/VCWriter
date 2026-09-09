import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addEpisode,
  addUnit,
  createProjectFile,
  linkEntities,
  paginateProject,
  printedPageCount,
  renderPrintDocumentHtml,
  updateBeat,
  updateUnit,
  type ProjectFile,
} from '../index.js';

/**
 * What a printing carries, and what it does not (addendum 02 §13).
 *
 * Everything optional is off unless it belongs in the delivered manuscript.
 * A script sent out is headings, action and dialogue; the annotations are a
 * reference copy the writer prints for themselves.
 */

const scene = (file: ProjectFile, heading: string, line: string) => {
  const made = addUnit(file, { laneId: file.lanes[0]!.id, title: heading });
  const beat = addBeat(made.file, { unitId: made.unit.id, title: 'The turn' });
  return {
    file: updateBeat(beat.file, beat.beat.id, {
      manuscript: {
        elements: [
          { id: `${beat.beat.id}-h` as never, type: 'scene_heading', text: heading, characterId: null, attributes: {} },
          { id: `${beat.beat.id}-a` as never, type: 'action', text: line, characterId: null, attributes: {} },
        ],
      },
    }),
    unitId: made.unit.id,
  };
};

const project = () => {
  let file = createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });
  file = { ...file, units: [], beats: [] };
  const first = scene(file, 'INT. LIGHTHOUSE - NIGHT', 'She climbs.');
  const second = scene(first.file, 'EXT. HARBOUR - DAWN', 'Rain on the water.');
  return { file: second.file, first: first.unitId, second: second.unitId };
};

/** Every line of every page, as text. */
const printed = (file: ProjectFile, options = {}): string =>
  paginateProject(file, options)
    .flatMap((page) => page.lines.map((line) => line.text))
    .join('\n');

describe('what prints', () => {
  it('is the manuscript and nothing else, by default', () => {
    const { file } = project();
    const text = printed(file);
    expect(text).toContain('INT. LIGHTHOUSE - NIGHT');
    expect(text).toContain('She climbs.');
    // The beat's internal title is authoring metadata (spec §5.3, §19).
    expect(text).not.toContain('The turn');
  });

  it('can leave the sluglines out, for a read-through', () => {
    const { file } = project();
    const text = printed(file, { includeSceneHeadings: false });
    expect(text).not.toContain('INT. LIGHTHOUSE - NIGHT');
    expect(text).toContain('She climbs.');
  });

  it('numbers the scenes when asked, in the margins rather than the column', () => {
    const { file } = project();
    const plain = paginateProject(file);
    const numbered = paginateProject(file, { includeSceneNumbers: true });

    // The marks are beside the sluglines, in story order.
    const marks = numbered.flatMap((page) => page.lines.filter((line) => line.mark).map((line) => line.mark));
    expect(marks).toEqual(['1', '2']);
    // And the text itself is untouched — the number takes no room from it.
    expect(plain.flatMap((page) => page.lines.map((line) => line.text))).toEqual(
      numbered.flatMap((page) => page.lines.map((line) => line.text)),
    );
  });

  it('prints a scene summary under its heading when asked, and never above it', () => {
    const { file, first } = project();
    const withSummary = updateUnit(file, first, { summary: 'She finds the lamp out.' });

    expect(printed(withSummary)).not.toContain('She finds the lamp out.');
    const text = printed(withSummary, { includeSceneSummary: true });
    expect(text).toContain('[She finds the lamp out.]');
    // A note above the slugline would read as belonging to the scene before.
    expect(text.indexOf('INT. LIGHTHOUSE')).toBeLessThan(text.indexOf('She finds the lamp out.'));
  });

  it('prints what a scene is linked to when asked', () => {
    const { file, first, second } = project();
    const linked = linkEntities(file, {
      from: { type: 'unit', id: first },
      to: { type: 'unit', id: second },
      type: 'pays_off',
    });

    expect(printed(linked)).not.toContain('EXT. HARBOUR - DAWN\n[');
    const text = printed(linked, { includeSceneLinks: true });
    expect(text).toMatch(/\[pays off: .*HARBOUR/);
  });

  it('prints the beat labels only for a reference copy, under the slugline', () => {
    const { file } = project();
    const text = printed(file, { includeBeatTitles: true });
    expect(text).toContain('[The turn]');
    // Above the heading it would read as belonging to the scene before.
    expect(text.indexOf('INT. LIGHTHOUSE')).toBeLessThan(text.indexOf('[The turn]'));
  });

  it('puts the scene’s own notes above the beat’s, since the scene holds it', () => {
    const { file, first } = project();
    const text = printed(updateUnit(file, first, { summary: 'She finds the lamp out.' }), {
      includeBeatTitles: true,
      includeSceneSummary: true,
    });
    expect(text.indexOf('INT. LIGHTHOUSE')).toBeLessThan(text.indexOf('[She finds the lamp out.]'));
    expect(text.indexOf('[She finds the lamp out.]')).toBeLessThan(text.indexOf('[The turn]'));
  });
});

describe('the printed document', () => {
  it('leaves the browser no margin to draw a date or a page number of its own in', () => {
    const { file } = project();
    const html = renderPrintDocumentHtml(file);
    expect(html).toContain('@page { size: letter; margin: 0; }');
    // The manuscript's own margin is the page's padding, which the print
    // rules must not zero away.
    expect(html).toMatch(/\.page \{[^}]*padding: 1in 1in 1in 1\.5in/);
  });

  it('does not date the document unless it is asked to, and then on every page', () => {
    const { file } = project();
    // The rule is always in the stylesheet; the element is what is optional.
    expect(renderPrintDocumentHtml(file)).not.toContain('<div class="printed-at">');

    const dated = renderPrintDocumentHtml(file, { includePrintedAt: true, includeTitlePage: false });
    const pages = paginateProject(file).length;
    // Pages get separated, so the date goes on each rather than once at the end.
    expect(dated.split('<div class="printed-at">').length - 1).toBe(pages);
  });

  it('numbers the pages unless told not to', () => {
    let file = project().file;
    // Enough text for a second page, which is where numbering starts.
    const beat = file.beats[0]!;
    file = updateBeat(file, beat.id, {
      manuscript: {
        elements: Array.from({ length: 80 }, (_, index) => ({
          id: `x${index}` as never,
          type: 'action' as const,
          text: `Line ${index} of the thing that goes on and on.`,
          characterId: null,
          attributes: {},
        })),
      },
    });
    expect(paginateProject(file).length).toBeGreaterThan(1);
    expect(renderPrintDocumentHtml(file)).toContain('class="page-number"');
    expect(renderPrintDocumentHtml(file, { includePageNumbers: false })).not.toContain('class="page-number"');
  });

  it('sets a scene number at both edges of the page', () => {
    const { file } = project();
    const html = renderPrintDocumentHtml(file, { includeSceneNumbers: true });
    expect(html).toContain('<span class="scene-number left">1</span>');
    expect(html).toContain('<span class="scene-number right">1</span>');
  });
});

/**
 * The front pages of a series (spec §6.1, addendum 02 §17): one for each
 * episode, at the head of its own run, rather than one for the season at the
 * front of the stack.
 */
describe('the front pages a series prints', () => {
  const seriesOf = (count: number): ProjectFile => {
    let file = createProjectFile({ title: 'The Lighthouse', format: 'series', author: 'K. Shank' });
    for (let n = 1; n <= count; n += 1) {
      const made = addEpisode(file, { title: `Episode ${n}` });
      file = updateBeat(made.file, made.episode.beats[0]!.id, {
        manuscript: {
          elements: [
            { id: `${made.episode.marker.id}-a` as never, type: 'action', text: 'The lamp turns.', characterId: null, attributes: {} },
          ],
        },
      });
    }
    return file;
  };

  it('sets one for each episode, naming the episode and carrying the series’ credit', () => {
    const html = renderPrintDocumentHtml(seriesOf(2));
    expect(html.split('class="page title-page"').length - 1).toBe(2);
    expect(html).toContain('Episode 1');
    expect(html).toContain('Episode 2');
    // The series' own answers are filled in on each page (§17).
    expect(html.split('K. Shank').length - 1).toBe(2);
  });

  it('does not set the project’s page in front of the first episode’s', () => {
    // Episode one opens at the first scene, so its page is the front of the
    // document; the series' would say very nearly the same thing again.
    const html = renderPrintDocumentHtml(seriesOf(1));
    expect(html.split('class="page title-page"').length - 1).toBe(1);
    expect(printedPageCount(seriesOf(1))).toBe(paginateProject(seriesOf(1)).length);
  });

  it('keeps the project’s page when there is a script ahead of the first episode', () => {
    // The scene the project was made with sits before any episode marker.
    let file = createProjectFile({ title: 'The Lighthouse', format: 'series' });
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: {
        elements: [{ id: 'a0' as never, type: 'action', text: 'Cold open.', characterId: null, attributes: {} }],
      },
    });
    file = addEpisode(file, { title: 'Pilot' }).file;

    const html = renderPrintDocumentHtml(file);
    // The series' page, then the cold open, then the pilot's own page.
    expect(html.split('class="page title-page"').length - 1).toBe(2);
    expect(printedPageCount(file)).toBe(paginateProject(file).length + 1);
  });

  it('prints none of them when the title page is switched off', () => {
    const html = renderPrintDocumentHtml(seriesOf(2), { includeTitlePage: false });
    expect(html).not.toContain('class="page title-page"');
  });

  it('numbers the manuscript straight through, and the front pages not at all', () => {
    const pages = paginateProject(seriesOf(3));
    const fronts = pages.filter((page) => page.titlePage);
    expect(fronts).toHaveLength(3);
    expect(fronts.every((page) => page.number === 0)).toBe(true);
    expect(pages.filter((page) => !page.titlePage).map((page) => page.number)).toEqual([1, 2, 3]);
  });
});
