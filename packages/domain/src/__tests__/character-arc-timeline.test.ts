import { describe, expect, it } from 'vitest';
import {
  addArcPoint,
  addBeat,
  addCharacter,
  addTheme,
  addUnit,
  arcTimeline,
  beginArc,
  createProjectFile,
  describeArcTimeline,
  insertArcPoint,
  linkEntities,
  pinUsage,
  updateArc,
  type ProjectFile,
} from '../index.js';

/**
 * The arc as a line you fill in (addendum 25 §4e).
 *
 * What the tests are about is the shape rather than the drawing: the two ends
 * are always there, a point goes in where it was asked for, a pinned point
 * stands where the manuscript puts it, and a link hangs on a moment and never
 * on a state.
 */

const world = () => {
  let file: ProjectFile = createProjectFile({ title: 'The Ledger', format: 'screenplay' });
  file = addCharacter(file, { name: 'SILAS' });
  const silas = file.characters[file.characters.length - 1]!.id;

  const unit = addUnit(file, { trackId: file.tracks[0]!.id, title: 'The Counting House' });
  const beat = addBeat(unit.file, { unitId: unit.unit.id, title: 'The coal bill' });
  file = beat.file;

  const begun = beginArc(file, silas);
  file = begun.file;
  const arc = begun.arc!;
  return { file, silas, arc, beatId: beat.beat.id };
};

describe('the arc as a line', () => {
  it('has two ends the moment there is an arc, with nothing between', () => {
    const { file, silas } = world();
    const stops = arcTimeline({ characterId: silas as string, file });
    expect(stops.map((stop) => stop.kind)).toEqual(['beginning', 'ending']);
    expect(stops.map((stop) => stop.title)).toEqual(['Begins', 'Becomes']);
    // They carry what the arc says, and the arc's own fields are where it lives.
    expect(stops[0]!.text).toBe('');
    expect(describeArcTimeline(stops)).toContain('Double-click the line');
  });

  it('carries the words the arc already had', () => {
    const { file, silas, arc } = world();
    const said = updateArc(file, arc.id, { beginning: 'Keeps score.', ending: 'Counts faster.' });
    const stops = arcTimeline({ characterId: silas as string, file: said });
    expect(stops[0]!.text).toBe('Keeps score.');
    expect(stops.at(-1)!.text).toBe('Counts faster.');
  });

  it('puts a point where the double-click asked for it', () => {
    const { file, silas, arc } = world();
    let next = addArcPoint(file, { arcId: arc.id, text: 'She refuses the coal' }).file;
    next = addArcPoint(next, { arcId: arc.id, text: 'She is offered it back' }).file;

    // Between the two, which is index 1.
    const put = insertArcPoint(next, { arcId: arc.id, index: 1, text: 'The clerk asks twice' });
    expect(put.point).toBeTruthy();

    const stops = arcTimeline({ characterId: silas as string, file: put.file });
    expect(stops.map((stop) => stop.text)).toEqual([
      '',
      'She refuses the coal',
      'The clerk asks twice',
      'She is offered it back',
      '',
    ]);
    // And at the head of the line.
    const first = insertArcPoint(put.file, { arcId: arc.id, index: 0, text: 'She counts the till' });
    expect(arcTimeline({ characterId: silas as string, file: first.file })[1]!.text).toBe(
      'She counts the till',
    );
  });

  it('refuses a point with nothing written in it, and an arc that is not there', () => {
    const { file, arc } = world();
    expect(insertArcPoint(file, { arcId: arc.id, index: 0, text: '   ' }).point).toBeNull();
    expect(insertArcPoint(file, { arcId: 'nope' as never, index: 0, text: 'x' }).point).toBeNull();
  });

  it('keeps the writer\u2019s order and carries the manuscript\u2019s answer on each stop', () => {
    const { file, silas, arc, beatId } = world();
    let next = addArcPoint(file, { arcId: arc.id, text: 'On deck still' }).file;
    const placed = addArcPoint(next, { arcId: arc.id, text: 'She refuses the coal' });
    next = placed.file;
    next = pinUsage(next, { ownerKind: 'arc_point', ownerId: placed.point!.id as string, beatId }).file;

    const stops = arcTimeline({ characterId: silas as string, file: next });
    const points = stops.filter((stop) => stop.kind === 'point');
    // **The writer's order**, not the board's split: the one still on deck
    // was written first and stands first. Ordered the board's way, a moment
    // inserted between two boxes landed at the far end, which is a gesture
    // that does not work.
    expect(points.map((stop) => stop.text)).toEqual(['On deck still', 'She refuses the coal']);
    // And the manuscript's answer travels with each stop rather than
    // deciding where it stands.
    expect(points[0]!.colour).toBe('red');
    expect(points[1]!.colour).toBe('green');
    expect(points[1]!.where).toBe('The Counting House');
    expect(describeArcTimeline(stops)).toContain('1 of them in the writing');
  });

  it('hangs a link on a moment and never on a state', () => {
    const { file, silas, arc } = world();
    const made = addArcPoint(file, { arcId: arc.id, text: 'She refuses the coal' });
    let next = addTheme(made.file, { name: 'Miserliness' }).file;
    const theme = next.themes[next.themes.length - 1]!;
    next = linkEntities(next, {
      from: { type: 'arc_point', id: made.point!.id as string },
      to: { type: 'theme', id: theme.id as string },
      type: 'relates_to',
    });

    const stops = arcTimeline({ characterId: silas as string, file: next });
    const point = stops.find((stop) => stop.kind === 'point')!;
    expect(point.linkable).toBe(true);
    expect(point.links.map((link) => `${link.label} · ${link.detail}`)).toEqual(['Miserliness · theme']);

    // The two ends are the arc rather than moments in it: a link from *who
    // they are at the start* would be a link from the whole character.
    expect(stops[0]!.linkable).toBe(false);
    expect(stops.at(-1)!.linkable).toBe(false);
  });

  it('says a link to something cut is gone rather than dropping it', () => {
    const { file, silas, arc } = world();
    const made = addArcPoint(file, { arcId: arc.id, text: 'She refuses the coal' });
    const next = linkEntities(made.file, {
      from: { type: 'arc_point', id: made.point!.id as string },
      to: { type: 'motif', id: '00000000-0000-4000-8000-000000000000' },
      type: 'relates_to',
    });
    const point = arcTimeline({ characterId: silas as string, file: next }).find(
      (stop) => stop.kind === 'point',
    )!;
    expect(point.links).toHaveLength(1);
    expect(point.links[0]!.exists).toBe(false);
  });

  /**
   * **The correction** (§4f). This used to return nothing without an arc
   * record — and since every character starts without one, the Arc tab drew a
   * *Start an arc* button and the timeline was absent from the only state a
   * writer ever meets it in.
   */
  it('still draws the two ends where there is no arc at all', () => {
    let file: ProjectFile = createProjectFile({ title: 'The Ledger', format: 'screenplay' });
    file = addCharacter(file, { name: 'NELL' });
    const nell = file.characters[file.characters.length - 1]!.id;

    const stops = arcTimeline({ characterId: nell as string, file });
    expect(stops.map((stop) => stop.kind)).toEqual(['beginning', 'ending']);
    expect(stops.every((stop) => stop.text === '')).toBe(true);
    // And nothing has been written down to draw them.
    expect(file.characterArcs).toHaveLength(0);

    // **The placeholder names the question rather than answering it.** The
    // first draft put an example sentence in each box, which on the real
    // screen read as content — and named a pronoun, so a character with no
    // arc opened on somebody else's sentence about *her*.
    expect(stops.map((stop) => stop.placeholder)).toEqual([
      'Who they are when we meet them',
      'Who they are by the end',
    ]);
  });
});
