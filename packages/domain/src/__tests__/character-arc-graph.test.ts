import { describe, expect, it } from 'vitest';
import {
  ARC_KEY,
  addArcPoint,
  addBeat,
  addCharacter,
  addMarker,
  addUnit,
  arcGraph,
  arcRuler,
  beginArc,
  createProjectFile,
  describeArcDisagreement,
  fromRows,
  linkEntities,
  pinUsage,
  ref,
  toRows,
  tracksInOrder,
  updateArc,
  type ArcPointId,
  type CharacterArcId,
  type CharacterId,
  type ProjectFile,
  type StructuralUnitId,
} from '../index.js';

/**
 * The arc as a picture (addendum 25 §5, stage 5).
 *
 * Two claims: **the intention is never the answer** — `arcShape` goes on
 * reading the points and the screen says so where the two part — and
 * **everything else on the graph is a reading**, so moving a scene moves a
 * mark and cutting the link takes it off the line with nothing run.
 */

interface World {
  file: ProjectFile;
  silas: CharacterId;
  arcId: CharacterArcId;
  units: StructuralUnitId[];
  beats: string[];
}

const world = (): World => {
  let file = createProjectFile({ title: 'The Ledger', format: 'novel' });
  file = addCharacter(file, { name: 'Silas Crane' });
  const silas = file.characters[file.characters.length - 1]!.id;

  const track = tracksInOrder(file)[0]!;
  const units: StructuralUnitId[] = [];
  const beats: string[] = [];
  for (const title of ['The Counting House', "Nell's Invitation", "The Clerk's Coat", 'The Thaw']) {
    const unit = addUnit(file, { trackId: track.id, title });
    file = unit.file;
    units.push(unit.unit.id);
    const beat = addBeat(file, { unitId: unit.unit.id, title: `${title} — opening` });
    file = beat.file;
    beats.push(beat.beat.id as string);
  }
  const started = beginArc(file, silas);
  return { file: started.file, silas, arcId: started.arc!.id, units, beats };
};

/** A point, and where in the story it happens. */
const point = (
  file: ProjectFile,
  arcId: CharacterArcId,
  kind: Parameters<typeof addArcPoint>[1]['kind'],
  text: string,
  beatId?: string,
): { file: ProjectFile; id: ArcPointId } => {
  const made = addArcPoint(file, { arcId, kind, text });
  const id = made.point!.id;
  if (!beatId) return { file: made.file, id };
  return {
    file: pinUsage(made.file, { ownerKind: 'arc_point', ownerId: id as string, beatId: beatId as never }).file,
    id,
  };
};

describe('the ruler', () => {
  it('is the divisions where there are any', () => {
    const { file, units } = world();
    const marked = addMarker(file, { unitId: units[0]!, title: '', kind: 'chapter' }).file;
    const both = addMarker(marked, { unitId: units[2]!, title: '', kind: 'chapter' }).file;
    const ruler = arcRuler(both);
    expect(ruler.ticks.map((tick) => tick.label)).toEqual(['Chapter 1', 'Chapter 2']);
    expect(ruler.noun).toBe('Chapter');
  });

  it('is the scenes where there are none, so a script with no acts still has a spine', () => {
    const { file } = world();
    const ruler = arcRuler(file);
    // The seeded scene plus the four written ones.
    expect(ruler.ticks).toHaveLength(5);
    expect(ruler.scenes).toBe(5);
  });
});

describe('the marks', () => {
  it('stand where the story puts them, and move when the story does', () => {
    const { file, silas, arcId, beats } = world();
    const first = point(file, arcId, 'movement', 'Counts the coal', beats[1]);
    const second = point(first.file, arcId, 'turning_point', 'Pays the doctor', beats[3]);

    const graph = arcGraph({ characterId: silas as string, file: second.file });
    const places = graph.marks.map((mark) => mark.at);
    expect(places[0]).toBeLessThan(places[1]!);

    // **Nothing is stored**: unpinning it from the scene takes it off the
    // line and leaves it waiting, with nothing run.
    const links = second.file.usageLinks.filter((link) => link.ownerId !== (second.id as string));
    const cut = { ...second.file, usageLinks: links };
    const after = arcGraph({ characterId: silas as string, file: cut });
    expect(after.marks).toHaveLength(1);
    expect(after.onDeck.map((mark) => mark.text)).toEqual(['Pays the doctor']);
    // On deck is **not** a position of zero: unplaced and at-the-start are
    // different things.
    expect(after.onDeck[0]!.at).toBeNull();
  });

  it('rises and falls with what the words mean, never with a score anybody typed', () => {
    const { file, silas, arcId, beats } = world();
    const a = point(file, arcId, 'setback', 'Evicts the widow', beats[1]);
    const b = point(a.file, arcId, 'turning_point', 'Pays the doctor', beats[3]);

    const graph = arcGraph({ characterId: silas as string, file: b.file });
    // A setback then a turning point: the low point first, the high after.
    expect(graph.marks[0]!.height).toBe(0);
    expect(graph.marks[1]!.height).toBe(1);
    // And there is nowhere for a number to be written down.
    expect(Object.keys(b.file.arcPoints[0]!)).not.toContain('height');
  });

  it('puts one point in the middle rather than at either end', () => {
    const { file, silas, arcId, beats } = world();
    const only = point(file, arcId, 'discovery', "Reads Ada's letter", beats[1]);
    const graph = arcGraph({ characterId: silas as string, file: only.file });
    // One mark says nothing about a rise or a fall, so it makes no claim.
    expect(graph.marks[0]!.height).toBe(0.5);
  });

  it('names the division each one falls in', () => {
    const { file, silas, arcId, units, beats } = world();
    const marked = addMarker(file, { unitId: units[0]!, title: '', kind: 'chapter' }).file;
    const made = point(marked, arcId, 'movement', 'Counts the coal', beats[1]);
    expect(arcGraph({ characterId: silas as string, file: made.file }).marks[0]!.division).toBe(
      'Chapter 1',
    );
  });
});

describe('the intention beside the reading', () => {
  it('never decides the shape', () => {
    const { file, silas, arcId, beats } = world();
    const refused = point(file, arcId, 'refusal', 'Calls in the debt', beats[1]);
    // The writer says *Grows*; a refusal is in the writing.
    const said = updateArc(refused.file, arcId, { intent: 'positive' });
    const graph = arcGraph({ characterId: silas as string, file: said });
    expect(graph.intent).toBe('positive');
    // **The reading is unmoved.** A control that could label a refusal
    // *Grows* would be a control that lies.
    expect(graph.read).toBe('refused');
    expect(graph.disagreement).toContain('Grows');
    expect(graph.disagreement).toContain('refuses it');
  });

  it('says nothing while they agree, or while there is nothing to compare', () => {
    // An arc with no points has no shape, which is the moment the intention
    // is worth having — so this is the one state that must stay quiet.
    expect(describeArcDisagreement('refused', 'unstarted')).toBeNull();
    expect(describeArcDisagreement(null, 'positive')).toBeNull();
    expect(describeArcDisagreement('positive', 'positive')).toBeNull();
    expect(describeArcDisagreement('refused', 'refused')).toBeNull();
  });

  it('says which way it is unread where the points say nothing yet', () => {
    expect(describeArcDisagreement('negative', 'flat')).toContain('Nothing written yet');
  });

  it('is carried to the rows and back, and starts as not said', () => {
    const { file, arcId } = world();
    expect(file.characterArcs[0]!.intent).toBeNull();
    const said = updateArc(file, arcId, { intent: 'negative' });
    expect(fromRows(toRows(said)).characterArcs[0]!.intent).toBe('negative');
  });
});

describe('the arcs joined to this one', () => {
  it('appears because of the links, and goes when the last one is cut', () => {
    let { file, silas, arcId, beats } = world();
    file = addCharacter(file, { name: 'Victor Marsh' });
    const victor = file.characters[file.characters.length - 1]!.id;
    const his = beginArc(file, victor);
    file = his.file;

    const mine = point(file, arcId, 'turning_point', 'Pays the doctor', beats[3]);
    const theirs = point(mine.file, his.arc!.id, 'refusal', 'Calls in the debt', beats[1]);
    const joined = linkEntities(theirs.file, {
      from: ref('arc_point', theirs.id as string),
      to: ref('arc_point', mine.id as string),
      type: 'causes',
    });

    const graph = arcGraph({ characterId: silas as string, file: joined });
    expect(graph.connected.map((one) => one.name)).toEqual(['Victor Marsh']);
    expect(graph.connected[0]!.joins).toBe(1);
    expect(graph.connected[0]!.marks[0]!.text).toBe('Calls in the debt');
    // And it is on the mark too, which is what puts the label on the line.
    expect(graph.marks[0]!.effects[0]).toMatchObject({ verb: 'causes', otherName: 'Victor Marsh' });

    // **Read from the links**: cutting the last one takes the row away with
    // nothing run.
    const cut = { ...joined, links: [] };
    expect(arcGraph({ characterId: silas as string, file: cut }).connected).toHaveLength(0);
  });

  it('leaves out somebody who has no arc of their own', () => {
    let { file, silas, arcId, beats } = world();
    file = addCharacter(file, { name: 'Nell Crane' });
    const nell = file.characters[file.characters.length - 1]!.id;
    // Nell gets a point but no arc is possible without one, so give her one
    // and then take it away — the link survives, the row does not.
    const hers = beginArc(file, nell);
    const theirs = point(hers.file, hers.arc!.id, 'movement', 'Asks him to forgive it', beats[0]);
    const mine = point(theirs.file, arcId, 'decision', 'Says no', beats[1]);
    const joined = linkEntities(mine.file, {
      from: ref('arc_point', theirs.id as string),
      to: ref('arc_point', mine.id as string),
      type: 'challenges',
    });
    expect(arcGraph({ characterId: silas as string, file: joined }).connected).toHaveLength(1);

    const noArc = { ...joined, characterArcs: joined.characterArcs.filter((one) => one.characterId !== nell) };
    expect(arcGraph({ characterId: silas as string, file: noArc }).connected).toHaveLength(0);
  });
});

describe('the key', () => {
  it('reads the same tables the marks do', () => {
    // A key written out beside the drawing is a second answer to what a shape
    // means; this one names the kinds, so a renamed kind renames the key.
    expect(ARC_KEY.map((row) => row.mark)).toContain('refusal');
    expect(ARC_KEY.find((row) => row.mark === 'refusal')!.words).toBe('Refuses it');
  });
});
