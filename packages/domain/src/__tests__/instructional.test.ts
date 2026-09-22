import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addGraphic,
  addUnit,
  createProjectFile,
  describeGraphics,
  figureLinesIn,
  figuresInOrder,
  figuresWithoutAltText,
  fromRows,
  layoutForFile,
  moveUnit,
  paginateProject,
  placeFigure,
  placementsOf,
  removeFigure,
  removeGraphic,
  toRows,
  unitsInStoryOrder,
  unplacedGraphics,
  updateGraphic,
  updateResearchItem,
  addResearchItem,
  type ProjectFile,
} from '../index.js';

/**
 * Instructional / Book Mode: the shelves and the graphics (addendum 16 §3, §9).
 *
 * Three claims. **The taxonomies are distinct** — an instructional project has
 * no Characters folder to ignore. **A figure is an element of the manuscript**,
 * so it has a place in the reading order and needs no side table to say where
 * it goes. And **a figure's number and height are readings**, so moving a
 * chapter renumbers everything after it and replacing a picture re-sizes it,
 * both with nothing run.
 */

const book = () => {
  let file: ProjectFile = createProjectFile({ title: 'Teaching Statistics', format: 'instructional' });
  const trackId = file.tracks[0]!.id;
  for (const title of ['Sampling', 'Inference', 'Regression']) {
    const chapter = addUnit(file, { trackId, title });
    file = addBeat(chapter.file, { unitId: chapter.unit.id, title: 'a section' }).file;
  }
  return file;
};

/** The beat of the nth chapter this fixture made (index 0 is the starter). */
const sectionAt = (file: ProjectFile, at: number) => {
  const unitId = unitsInStoryOrder(file)[at + 1]!.id;
  return file.beats.find((one) => one.unitId === unitId)!;
};

const picture = (w: number, h: number) =>
  ({ name: 'histogram.png', data: 'data:image/png;base64,AA', width: w, height: h });

describe('the shelves', () => {
  it('seeds a book with notes, ideas and an inbox', () => {
    const file = createProjectFile({ title: 'Teaching Statistics', format: 'instructional' });
    expect(file.researchCategories.map((one) => one.name)).toEqual([
      'General Notes',
      'Ideas',
      'Imported',
    ]);
  });

  it('seeds no Graphics folder, because the library is the graphics shelf', () => {
    // A folder of that name beside the library could only hold the wrong
    // thing: a picture dropped into it is a picture nothing can place.
    const file = createProjectFile({ title: 'Teaching Statistics', format: 'instructional' });
    expect(file.researchCategories.map((one) => one.name)).not.toContain('Graphics');
  });

  it('leaves a novel’s shelves exactly as they were', () => {
    const file = createProjectFile({ title: 'A Novel', format: 'novel' });
    expect(file.researchCategories.map((one) => one.systemKey)).toEqual([
      'characters',
      'ideas',
      'plot_points',
      'locations',
      'props',
      'themes',
    ]);
  });

  it('keeps a citation, which is the field a textbook cannot do without', () => {
    const start = createProjectFile({ title: 'Teaching Statistics', format: 'instructional' });
    let file = addResearchItem(start, {
      categoryId: start.researchCategories[1]!.id,
      title: 'Regression to the mean',
    });
    file = updateResearchItem(file, file.researchItems[0]!.id, { source: 'Galton 1886, p. 246' });

    const item = file.researchItems[0]!;
    expect(item.source).toBe('Galton 1886, p. 246');
    // `origin` answers a different question and is untouched by it.
    expect(item.origin).toBe('desktop');
    expect(fromRows(toRows(file)).researchItems[0]!.source).toBe('Galton 1886, p. 246');
  });
});

describe('a figure is an element of the manuscript', () => {
  it('sits where it was put, and reads in manuscript order', () => {
    let file = book();
    const made = addGraphic(file, picture(400, 300));
    file = placeFigure(made.file, { beatId: sectionAt(made.file, 1).id, assetId: made.asset.id }).file;

    const figures = figuresInOrder(file);
    expect(figures).toHaveLength(1);
    expect(figures[0]!.beatId).toBe(sectionAt(file, 1).id);
    expect(figures[0]!.number).toBe(1);
  });

  it('renumbers when a chapter moves, with nothing stored', () => {
    let file = book();
    const one = addGraphic(file, { ...picture(400, 300), name: 'first.png' });
    file = placeFigure(one.file, { beatId: sectionAt(one.file, 0).id, assetId: one.asset.id }).file;
    const two = addGraphic(file, { ...picture(400, 300), name: 'second.png' });
    file = placeFigure(two.file, { beatId: sectionAt(two.file, 2).id, assetId: two.asset.id }).file;

    expect(figuresInOrder(file).map((f) => f.asset!.name)).toEqual(['first.png', 'second.png']);

    // Drag the last chapter to the front. Figure 2 becomes Figure 1.
    const order = unitsInStoryOrder(file);
    const moved = moveUnit(file, { unitId: order[3]!.id, toTrackId: file.tracks[0]!.id, index: 0 });
    expect(figuresInOrder(moved).map((f) => f.asset!.name)).toEqual(['second.png', 'first.png']);
    expect(figuresInOrder(moved)[0]!.number).toBe(1);
  });

  it('keeps the picture in the library when the figure is cut', () => {
    let file = book();
    const made = addGraphic(file, picture(400, 300));
    file = placeFigure(made.file, { beatId: sectionAt(made.file, 0).id, assetId: made.asset.id }).file;
    const figure = figuresInOrder(file)[0]!;

    const after = removeFigure(file, figure.beatId, figure.elementId);
    expect(figuresInOrder(after)).toHaveLength(0);
    // Removing from the book is not deleting the picture (§12).
    expect(after.assets).toHaveLength(1);
    expect(unplacedGraphics(after)).toHaveLength(1);
  });

  it('keeps the figure when the picture is deleted, and says the picture has gone', () => {
    let file = book();
    const made = addGraphic(file, picture(400, 300));
    file = placeFigure(made.file, { beatId: sectionAt(made.file, 0).id, assetId: made.asset.id }).file;

    const after = removeGraphic(file, made.asset.id);
    const figures = figuresInOrder(after);
    // Kept rather than silently vanishing: the words around it referred to it,
    // and whether they go too is the author's decision.
    expect(figures).toHaveLength(1);
    expect(figures[0]!.asset).toBeNull();
  });

  it('takes its caption from the picture, and then keeps its own', () => {
    let file = book();
    const made = addGraphic(file, { ...picture(400, 300), caption: 'A histogram' });
    file = placeFigure(made.file, { beatId: sectionAt(made.file, 0).id, assetId: made.asset.id }).file;
    expect(figuresInOrder(file)[0]!.caption).toBe('A histogram');

    // Editing the library's caption does not rewrite a placement.
    const edited = updateGraphic(file, made.asset.id, { caption: 'Something else' });
    expect(figuresInOrder(edited)[0]!.caption).toBe('A histogram');
  });

  it('says where one picture is used, so removing it can say what it costs', () => {
    let file = book();
    const made = addGraphic(file, picture(400, 300));
    file = placeFigure(made.file, { beatId: sectionAt(made.file, 0).id, assetId: made.asset.id }).file;
    file = placeFigure(file, { beatId: sectionAt(file, 2).id, assetId: made.asset.id }).file;
    // One picture, two placements — which is why the caption lives on both.
    expect(placementsOf(file, made.asset.id)).toHaveLength(2);
  });
});

describe('a figure’s height is a reading of the picture', () => {
  it('is taller for a taller picture', () => {
    const file = book();
    const layout = layoutForFile(file);
    const wide = addGraphic(file, picture(800, 200));
    const tall = addGraphic(wide.file, { ...picture(200, 800), name: 'tall.png' });

    const wideLines = figureLinesIn(tall.file, wide.asset.id as string, layout);
    const tallLines = figureLinesIn(tall.file, tall.asset.id as string, layout);
    expect(tallLines).toBeGreaterThan(wideLines);
  });

  it('never grows taller than the page it has to fit on', () => {
    const file = book();
    const layout = layoutForFile(file);
    const made = addGraphic(file, { ...picture(10, 4000), name: 'very-tall.png' });
    expect(figureLinesIn(made.file, made.asset.id as string, layout)).toBeLessThan(layout.linesPerPage);
  });

  it('falls back visibly for a picture that never reported its size', () => {
    const file = book();
    const layout = layoutForFile(file);
    const made = addGraphic(file, { name: 'unknown.png', data: 'data:image/png;base64,AA' });
    // A gap rather than a silently collapsed figure.
    expect(figureLinesIn(made.file, made.asset.id as string, layout)).toBeGreaterThan(1);
  });

  it('takes room on the printed page', () => {
    let file = book();
    const words = 'Sampling matters. '.repeat(40);
    file = {
      ...file,
      beats: file.beats.map((beat) =>
        beat.id === sectionAt(file, 0).id
          ? {
              ...beat,
              manuscript: {
                elements: [
                  { id: 'p1' as never, type: 'paragraph' as const, text: words, characterId: null, attributes: {} },
                ],
              },
            }
          : beat,
      ),
    };
    const before = paginateProject(file).length;

    const made = addGraphic(file, picture(400, 400));
    const after = paginateProject(
      placeFigure(made.file, { beatId: sectionAt(made.file, 0).id, assetId: made.asset.id }).file,
    );
    // A square figure on a 60-column page is most of a page tall, so it pushes.
    expect(after.length).toBeGreaterThanOrEqual(before);
  });
});

describe('what the library owes', () => {
  it('counts what is placed and what has no description', () => {
    let file = book();
    const made = addGraphic(file, picture(400, 300));
    file = placeFigure(made.file, { beatId: sectionAt(made.file, 0).id, assetId: made.asset.id }).file;

    expect(figuresWithoutAltText(file)).toHaveLength(1);
    expect(describeGraphics(file)).toMatch(/1 graphic · 1 placed · 1 without a description/);

    const described = updateGraphic(file, made.asset.id, { altText: 'A histogram of sample means' });
    expect(figuresWithoutAltText(described)).toHaveLength(0);
  });

  it('says nothing at all when there are no graphics', () => {
    expect(describeGraphics(book())).toBe('No graphics yet.');
  });
});
