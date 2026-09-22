import { describe, expect, it } from 'vitest';
import {
  addItem,
  beatsForUnit,
  canPromote,
  divisionSpan,
  createOutline,
  createProjectFile,
  findOutline,
  findOutlineItem,
  followOutline,
  fromRows,
  indentItem,
  isPromoted,
  moveItem,
  nudgeItem,
  promoteRow,
  promotedOf,
  removeMarker,
  removeUnit,
  rowOutOfStep,
  toRows,
  unitsInStoryOrder,
  unpromoteRow,
  updateItem,
  updateMarker,
  whatGoesWithRows,
  type Outline,
  type OutlineItemId,
  type ProjectFile,
} from '../index.js';

/**
 * The Chapter row (addendum 19 §2), stage 1.
 *
 * **A chapter is a page, not a container.** Nothing is written in one; it
 * announces the subject and the writing begins at the first section — which
 * is what a `chapter` story marker already is. So what is worth testing is
 * that promoting a Chapter row makes exactly that: its sections as units, a
 * marker on the first of them, and the two joined the way a scene and its
 * row are joined.
 */

const live = (file: ProjectFile, outline: Outline): Outline => findOutline(file, outline.id) as Outline;

/** A textbook with an empty manuscript and one chapter of two sections. */
const textbook = (): {
  file: ProjectFile;
  outline: Outline;
  chapter: OutlineItemId;
  light: OutlineItemId;
  lenses: OutlineItemId;
} => {
  let file = createProjectFile({ title: 'Teaching Optics', format: 'instructional' });
  // The starter section a new project carries would be a stray unit before
  // the first chapter; the outline is the whole of the book here.
  for (const unit of [...file.units]) file = removeUnit(file, unit.id);
  const made = createOutline(file);
  const id = made.outline.id;
  const chapter = addItem(made.file, id, { kind: 'chapter', title: 'Geometric optics' });
  const light = addItem(chapter.file, id, { parentId: chapter.itemId, kind: 'scene', title: 'Light' });
  const refraction = addItem(light.file, id, { parentId: light.itemId, kind: 'beat', title: 'Refraction' });
  const reflection = addItem(refraction.file, id, { parentId: light.itemId, kind: 'beat', title: 'Reflection' });
  const lenses = addItem(reflection.file, id, { parentId: chapter.itemId, kind: 'scene', title: 'Lenses' });
  const note = addItem(lenses.file, id, { parentId: chapter.itemId, kind: 'note', title: 'Ask about diagrams' });
  return {
    file: note.file,
    outline: made.outline,
    chapter: chapter.itemId as OutlineItemId,
    light: light.itemId as OutlineItemId,
    lenses: lenses.itemId as OutlineItemId,
  };
};

describe('where a chapter may sit', () => {
  it('is the top level, and nowhere else', () => {
    const { file, outline, light } = textbook();
    // Under a section: refused outright rather than put somewhere else.
    const nested = addItem(file, outline.id, { parentId: light, kind: 'chapter', title: 'Inside' });
    expect(nested.itemId).toBeNull();
    expect(live(nested.file, outline).items).toHaveLength(live(file, outline).items.length);
  });

  it('cannot be dragged or indented under anything', () => {
    const { file, outline, chapter, light } = textbook();
    const second = addItem(file, outline.id, { kind: 'chapter', title: 'Wave optics' });
    const dragged = moveItem(second.file, outline.id, second.itemId!, { parentId: light });
    expect(findOutlineItem(live(dragged, outline), second.itemId!)?.parentId).toBeNull();
    // Tab would put it under the chapter above it, and nothing happens.
    const tabbed = indentItem(second.file, outline.id, second.itemId!);
    expect(findOutlineItem(live(tabbed, outline), second.itemId!)?.parentId).toBeNull();
    // Among its siblings it moves like any row.
    const nudged = nudgeItem(second.file, outline.id, second.itemId!, -1);
    const top = live(nudged, outline).items.filter((item) => item.parentId === null).sort((a, b) =>
      a.orderKey < b.orderKey ? -1 : 1,
    );
    expect(top.map((item) => item.id)).toEqual([second.itemId, chapter]);
  });

  it('is not what a nested row can be retyped into', () => {
    const { file, outline, light } = textbook();
    const retyped = updateItem(file, outline.id, light, { kind: 'chapter', title: 'Still light' });
    const row = findOutlineItem(live(retyped, outline), light)!;
    expect(row.kind).toBe('scene');
    // The rest of what was typed alongside still landed.
    expect(row.title).toBe('Still light');
  });
});

describe('what a chapter can become', () => {
  it('is refused, in a sentence, while it has no section', () => {
    const { file, outline } = textbook();
    const empty = addItem(file, outline.id, { kind: 'chapter', title: 'Wave optics' });
    const back = live(empty.file, outline);
    expect(canPromote(empty.file, back, findOutlineItem(back, empty.itemId!)!)).toBe(
      'a chapter starts on a section, and this one has none yet',
    );
    // And nothing is made for it: no marker, no section invented to hang one on.
    const sent = promoteRow(empty.file, outline.id, empty.itemId!);
    expect(sent.markerId).toBeNull();
    expect(sent.file.markers).toHaveLength(0);
    expect(sent.file.units).toHaveLength(0);
  });

  it('is a marker on its first section, with its sections as units', () => {
    const { file, outline, chapter, light, lenses } = textbook();
    const back = live(file, outline);
    expect(canPromote(file, back, findOutlineItem(back, chapter)!)).toBeNull();

    const sent = promoteRow(file, outline.id, chapter);
    expect(sent.markerId).not.toBeNull();

    // Two sections, in the outline's order, and Light's two subsections.
    const order = unitsInStoryOrder(sent.file);
    expect(order.map((unit) => unit.title)).toEqual(['Light', 'Lenses']);
    expect(beatsForUnit(sent.file, order[0]!.id).map((beat) => beat.title)).toEqual(['Refraction', 'Reflection']);
    expect(sent.beats).toHaveLength(2);

    // One marker, of the chapter kind, on the first section, titled as the row.
    expect(sent.file.markers).toHaveLength(1);
    const marker = sent.file.markers[0]!;
    expect(marker.kind).toBe('chapter');
    expect(marker.unitId).toBe(order[0]!.id);
    expect(marker.title).toBe('Geometric optics');

    // The row is the marker; the sections are their units.
    const grown = live(sent.file, outline);
    expect(findOutlineItem(grown, chapter)?.boundMarkerId).toBe(marker.id);
    expect(promotedOf(sent.file, findOutlineItem(grown, chapter)!)).toMatchObject({ kind: 'marker' });
    expect(isPromoted(findOutlineItem(grown, light)!)).toBe(true);
    expect(isPromoted(findOutlineItem(grown, lenses)!)).toBe(true);
    // The note stayed a note.
    expect(grown.items.filter((item) => item.kind === 'note').every((item) => !isPromoted(item))).toBe(true);

    // Sent again, it is refused rather than made twice.
    expect(canPromote(sent.file, grown, findOutlineItem(grown, chapter)!)).toBe('already in the script');
    expect(promoteRow(sent.file, outline.id, chapter).markerId).toBeNull();
  });

  it('leaves a section already in the book where it is, and still marks the first', () => {
    const { file, outline, chapter, light } = textbook();
    const first = promoteRow(file, outline.id, light);
    const sent = promoteRow(first.file, outline.id, chapter);
    expect(unitsInStoryOrder(sent.file).map((unit) => unit.title)).toEqual(['Light', 'Lenses']);
    expect(sent.file.markers[0]?.unitId).toBe(first.unitId);
  });

  it('lands a second chapter after the whole of the first, not inside it', () => {
    const { file, outline, chapter } = textbook();
    const second = addItem(file, outline.id, { kind: 'chapter', title: 'Wave optics' });
    const waves = addItem(second.file, outline.id, { parentId: second.itemId, kind: 'scene', title: 'Waves' });
    const one = promoteRow(waves.file, outline.id, chapter);
    const two = promoteRow(one.file, outline.id, second.itemId!);

    expect(unitsInStoryOrder(two.file).map((unit) => unit.title)).toEqual(['Light', 'Lenses', 'Waves']);
    expect(divisionSpan(two.file, one.markerId!).map((unit) => unit.title)).toEqual(['Light', 'Lenses']);
    expect(divisionSpan(two.file, two.markerId!).map((unit) => unit.title)).toEqual(['Waves']);
  });

  it('puts a section added to a promoted chapter after that chapter’s last section', () => {
    const { file, outline, chapter } = textbook();
    const second = addItem(file, outline.id, { kind: 'chapter', title: 'Wave optics' });
    const waves = addItem(second.file, outline.id, { parentId: second.itemId, kind: 'scene', title: 'Waves' });
    const one = promoteRow(waves.file, outline.id, chapter);
    const two = promoteRow(one.file, outline.id, second.itemId!);

    // A third section under the first chapter, promoted on its own: it goes
    // after Lenses and before Waves, because that is where the outline has it.
    const mirrors = addItem(two.file, outline.id, { parentId: chapter, kind: 'scene', title: 'Mirrors' });
    const three = promoteRow(mirrors.file, outline.id, mirrors.itemId!);
    expect(unitsInStoryOrder(three.file).map((unit) => unit.title)).toEqual(['Light', 'Lenses', 'Mirrors', 'Waves']);
  });
});

describe('the row and the marker are one thing', () => {
  it('renames both ways', () => {
    const { file, outline, chapter } = textbook();
    const sent = promoteRow(file, outline.id, chapter);

    const fromRow = updateItem(sent.file, outline.id, chapter, { title: 'Rays and lenses' });
    expect(fromRow.markers[0]?.title).toBe('Rays and lenses');

    const fromMarker = updateMarker(fromRow, sent.markerId!, { title: 'Rays' });
    expect(findOutlineItem(live(fromMarker, outline), chapter)?.title).toBe('Rays');
  });

  it('comes apart without touching the marker', () => {
    const { file, outline, chapter } = textbook();
    const sent = promoteRow(file, outline.id, chapter);
    const loose = unpromoteRow(sent.file, outline.id, chapter);
    expect(findOutlineItem(live(loose, outline), chapter)?.boundMarkerId).toBeNull();
    expect(loose.markers).toHaveLength(1);
    // The sections stay in the book, being their own rows' business.
    expect(unitsInStoryOrder(loose).map((unit) => unit.title)).toEqual(['Light', 'Lenses']);
  });

  it('goes back to a plan when the marker goes', () => {
    const { file, outline, chapter } = textbook();
    const sent = promoteRow(file, outline.id, chapter);
    const gone = removeMarker(sent.file, sent.markerId!);
    expect(findOutlineItem(live(gone, outline), chapter)?.boundMarkerId).toBeNull();
  });

  it('keeps the marker when its first section goes, and lets go when they all do', () => {
    const { file, outline, chapter } = textbook();
    const sent = promoteRow(file, outline.id, chapter);
    const [light, lenses] = unitsInStoryOrder(sent.file);

    // The marker moves to the next section, as markers always have.
    const oneGone = removeUnit(sent.file, light!.id);
    expect(oneGone.markers[0]?.unitId).toBe(lenses!.id);
    expect(findOutlineItem(live(oneGone, outline), chapter)?.boundMarkerId).toBe(sent.markerId);

    // With no section left there is nothing to start on, so the marker goes
    // and the row is a plan again.
    const allGone = removeUnit(oneGone, lenses!.id);
    expect(allGone.markers).toHaveLength(0);
    expect(findOutlineItem(live(allGone, outline), chapter)?.boundMarkerId).toBeNull();
  });

  it('counts as promoted where the Outliner asks', () => {
    const { file, outline, chapter } = textbook();
    const sent = promoteRow(file, outline.id, chapter);
    const going = whatGoesWithRows(live(sent.file, outline), [chapter]);
    // The chapter, its two sections and Light's two subsections are real;
    // the note is not.
    expect(going).toMatchObject({ rows: 6, promoted: 5 });
  });

  it('survives the round trip through the database', () => {
    const { file, outline, chapter } = textbook();
    const sent = promoteRow(file, outline.id, chapter);
    const back = fromRows(toRows(sent.file));
    expect(findOutlineItem(live(back, outline), chapter)?.boundMarkerId).toBe(sent.markerId);
  });
});

describe('when the outline and the book disagree about chapters', () => {
  /** Two promoted chapters, then the second dragged above the first in the outline. */
  const swapped = () => {
    const { file, outline, chapter } = textbook();
    const second = addItem(file, outline.id, { kind: 'chapter', title: 'Wave optics' });
    const waves = addItem(second.file, outline.id, { parentId: second.itemId, kind: 'scene', title: 'Waves' });
    const one = promoteRow(waves.file, outline.id, chapter);
    const two = promoteRow(one.file, outline.id, second.itemId!);
    const moved = nudgeItem(two.file, outline.id, second.itemId!, -1);
    return { file: moved, outline, first: chapter, second: second.itemId as OutlineItemId };
  };

  it('is said, in the words the sentence uses', () => {
    const { file, outline, second } = swapped();
    const step = rowOutOfStep(file, live(file, outline), second);
    expect(step).toMatchObject({ outlineFirst: true, otherTitle: 'Geometric optics' });
  });

  it('moves the whole chapter to match, and only when asked', () => {
    const { file, outline, second } = swapped();
    // Nothing moved by the drag itself.
    expect(unitsInStoryOrder(file).map((unit) => unit.title)).toEqual(['Light', 'Lenses', 'Waves']);

    const followed = followOutline(file, outline.id, second);
    expect(unitsInStoryOrder(followed).map((unit) => unit.title)).toEqual(['Waves', 'Light', 'Lenses']);
    expect(rowOutOfStep(followed, live(followed, outline), second)).toBeNull();
  });

  it('moves every section the chapter covers, as one block', () => {
    const { file, outline, first, second } = swapped();
    // The first chapter, moved below the second: Light and Lenses go together.
    const followed = followOutline(file, outline.id, first);
    expect(unitsInStoryOrder(followed).map((unit) => unit.title)).toEqual(['Waves', 'Light', 'Lenses']);
    expect(rowOutOfStep(followed, live(followed, outline), first)).toBeNull();
    expect(rowOutOfStep(followed, live(followed, outline), second)).toBeNull();
  });

  it('is measured against a section beside it as well', () => {
    const { file, outline, chapter } = textbook();
    // A section before the first chapter, promoted after it.
    const preface = addItem(file, outline.id, { kind: 'scene', title: 'Preface' });
    const one = promoteRow(preface.file, outline.id, chapter);
    const two = promoteRow(one.file, outline.id, preface.itemId!);
    // The preface row sits after the chapter in the outline, so it lands after it.
    expect(unitsInStoryOrder(two.file).map((unit) => unit.title)).toEqual(['Light', 'Lenses', 'Preface']);

    const moved = nudgeItem(two.file, outline.id, preface.itemId!, -1);
    expect(rowOutOfStep(moved, live(moved, outline), preface.itemId!)).toMatchObject({ outlineFirst: true });
    const followed = followOutline(moved, outline.id, preface.itemId!);
    expect(unitsInStoryOrder(followed).map((unit) => unit.title)).toEqual(['Preface', 'Light', 'Lenses']);
  });
});

describe('a chapter needs somewhere to go', () => {
  it('is refused without a track, like a section', () => {
    // A project with its tracks gone has nowhere to put a section.
    const file = createProjectFile({ title: 'Teaching Optics', format: 'instructional' });
    const made = createOutline({ ...file, tracks: [], units: [], beats: [] });
    const chapter = addItem(made.file, made.outline.id, { kind: 'chapter', title: 'One' });
    const section = addItem(chapter.file, made.outline.id, { parentId: chapter.itemId, kind: 'scene', title: 'A' });
    const back = live(section.file, made.outline);
    expect(canPromote(section.file, back, findOutlineItem(back, chapter.itemId!)!)).toBe(
      'there is no track to put a scene in',
    );
  });
});
