import { describe, expect, it } from 'vitest';
import {
  addArcPoint,
  addBeat,
  addCharacter,
  addCharacterization,
  addTrait,
  addUnit,
  arcContinuity,
  beginArc,
  createProjectFile,
  describeRow,
  linkEntities,
  pinUsage,
  ref,
  relate,
  reviewRows,
  castNeverSpoken,
  cuesWithoutCharacter,
  scriptPresence,
  unusedCharacterMaterial,
  updateBeat,
  updateCharacterization,
  type ProjectFile,
} from '../index.js';

/**
 * Search, filters and the review modes (addendum 08, stage 10 — §18).
 *
 * The claim the whole file rests on: **story order, and never a judgement.**
 * A review mode is for reading a character the way an audience meets them, and
 * a flag is something checkable against the manuscript rather than an opinion
 * about whether somebody is written thinly.
 */

const staged = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });

  const one = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. DINER - NIGHT' });
  const beatOne = addBeat(one.file, { unitId: one.unit.id, title: 'The bill' });
  const two = addUnit(beatOne.file, { laneId: file.lanes[0]!.id, title: 'EXT. LOT - LATER' });
  const beatTwo = addBeat(two.file, { unitId: two.unit.id, title: 'The walk' });
  file = beatTwo.file;

  file = addCharacter(file, { name: 'MARA' });
  const mara = file.characters[file.characters.length - 1]!.id;
  file = addCharacter(file, { name: 'DEAKINS' });
  const deakins = file.characters[file.characters.length - 1]!.id;

  const greedy = addTrait(file, { characterId: mara, name: 'Greedy' });
  const tip = addCharacterization(greedy.file, {
    characterId: mara,
    traitId: greedy.trait!.id,
    text: 'Leaves a small tip.',
  });
  const receipt = addCharacterization(tip.file, {
    characterId: mara,
    traitId: greedy.trait!.id,
    text: 'Keeps every receipt.',
  });
  const his = addCharacterization(receipt.file, {
    characterId: deakins,
    text: 'Leaves his coat on the stool.',
  });

  return {
    file: his.file,
    mara,
    deakins,
    traitId: greedy.trait!.id,
    tipId: tip.item!.id,
    receiptId: receipt.item!.id,
    hisId: his.item!.id,
    unitOne: one.unit.id,
    unitTwo: two.unit.id,
    beatOne: beatOne.beat.id,
    beatTwo: beatTwo.beat.id,
    laneId: file.lanes[0]!.id,
  };
};

describe('everything, in the order the story tells it', () => {
  it('puts what is written first, by scene, and what is not at the end', () => {
    const { file, tipId, receiptId, beatOne, beatTwo } = staged();
    const later = pinUsage(file, { ownerKind: 'characterization', ownerId: receiptId, beatId: beatTwo });
    const earlier = pinUsage(later.file, {
      ownerKind: 'characterization',
      ownerId: tipId,
      beatId: beatOne,
    });

    const rows = reviewRows(earlier.file);
    expect(rows.map((row) => row.work.text)).toEqual([
      'Leaves a small tip.',
      'Keeps every receipt.',
      'Leaves his coat on the stool.',
    ]);
    expect(rows[0]!.unitTitle).toContain('INT. DINER - NIGHT');
    expect(rows[2]!.where).toBeNull();
  });

  it('says where each one stands', () => {
    const { file, tipId, receiptId, beatOne } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: tipId, beatId: beatOne });
    const aside = updateCharacterization(pinned.file, receiptId, { retired: true });

    const standings = new Map(reviewRows(aside).map((row) => [row.work.text, row.standing]));
    expect(standings.get('Leaves a small tip.')).toBe('in_the_writing');
    expect(standings.get('Keeps every receipt.')).toBe('set_aside');
    expect(standings.get('Leaves his coat on the stool.')).toBe('on_deck');
  });
});

describe('the filters', () => {
  it('searches the trait’s name as well as the work', () => {
    // Somebody looking for "greedy" wants what it makes her do, and the trait
    // is the only place that word appears.
    const { file } = staged();
    expect(reviewRows(file, { query: 'greedy' })).toHaveLength(2);
    expect(reviewRows(file, { query: 'coat' }).map((row) => row.work.characterName)).toEqual(['DEAKINS']);
    expect(reviewRows(file, { query: 'MARA' })).toHaveLength(2);
  });

  it('filters by character, trait and standing', () => {
    const { file, mara, traitId, tipId, beatOne } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: tipId, beatId: beatOne });

    expect(reviewRows(pinned.file, { characterId: mara })).toHaveLength(2);
    expect(reviewRows(pinned.file, { traitId })).toHaveLength(2);
    expect(reviewRows(pinned.file, { standing: 'in_the_writing' })).toHaveLength(1);
    expect(reviewRows(pinned.file, { standing: 'on_deck' })).toHaveLength(2);
  });

  it('filters by scene and by plot lane, and drops what is not written', () => {
    const { file, tipId, beatOne, unitOne, unitTwo, laneId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: tipId, beatId: beatOne });

    expect(reviewRows(pinned.file, { unitId: unitOne })).toHaveLength(1);
    expect(reviewRows(pinned.file, { unitId: unitTwo })).toHaveLength(0);
    // A lane holds both scenes, but only one piece of work is on the page.
    expect(reviewRows(pinned.file, { laneId })).toHaveLength(1);
  });

  it('filters by arc stage', () => {
    const { file, mara } = staged();
    const arc = beginArc(file, mara);
    const refusal = addArcPoint(arc.file, {
      arcId: arc.arc!.id,
      kind: 'refusal',
      text: 'Takes the money anyway.',
    });
    const move = addArcPoint(refusal.file, { arcId: arc.arc!.id, text: 'Counts it twice.' });

    expect(reviewRows(move.file, { arcKind: 'refusal' }).map((row) => row.work.text)).toEqual([
      'Takes the money anyway.',
    ]);
  });

  it('filters by who somebody has a relationship with', () => {
    const { file, mara, deakins } = staged();
    const joined = relate(file, { fromCharacterId: mara, toCharacterId: deakins, kind: 'friend' });

    // Asked about Mara's people: Deakins' work, and not her own.
    const rows = reviewRows(joined.file, { relatedTo: mara });
    expect(rows.map((row) => row.work.characterName)).toEqual(['DEAKINS']);
  });
});

describe('the unused character material report', () => {
  it('groups what is on deck by person, and leaves out what was set aside', () => {
    const { file, tipId, receiptId, beatOne } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: tipId, beatId: beatOne });
    const aside = updateCharacterization(pinned.file, receiptId, { retired: true });

    const report = unusedCharacterMaterial(aside);
    expect(report.map((group) => group.characterName)).toEqual(['DEAKINS']);
    expect(report[0]!.rows.map((row) => row.work.text)).toEqual(['Leaves his coat on the stool.']);
  });

  it('says nothing when everything planned is on the page', () => {
    const { file, tipId, receiptId, hisId, beatOne } = staged();
    let next = pinUsage(file, { ownerKind: 'characterization', ownerId: tipId, beatId: beatOne }).file;
    next = pinUsage(next, { ownerKind: 'characterization', ownerId: receiptId, beatId: beatOne }).file;
    next = pinUsage(next, { ownerKind: 'characterization', ownerId: hisId, beatId: beatOne }).file;

    expect(unusedCharacterMaterial(next)).toHaveLength(0);
  });
});

describe('the arc continuity review', () => {
  const arced = () => {
    const base = staged();
    const hers = beginArc(base.file, base.mara);
    const his = beginArc(hers.file, base.deakins);
    const refusal = addArcPoint(his.file, {
      arcId: hers.arc!.id,
      kind: 'refusal',
      text: 'Takes the money anyway.',
    });
    const decision = addArcPoint(refusal.file, {
      arcId: his.arc!.id,
      kind: 'decision',
      text: 'Stops covering for her.',
    });
    return { ...base, file: decision.file, refusalId: refusal.point!.id, decisionId: decision.point!.id };
  };

  it('flags a cause written after its effect, which is checkable and not an opinion', () => {
    const { file, refusalId, decisionId, beatOne, beatTwo } = arced();
    const linked = linkEntities(file, {
      from: ref('arc_point', refusalId as string),
      to: ref('arc_point', decisionId as string),
      type: 'causes',
    });
    // The cause is in the second scene and the effect in the first.
    const one = pinUsage(linked, { ownerKind: 'arc_point', ownerId: refusalId, beatId: beatTwo });
    const two = pinUsage(one.file, { ownerKind: 'arc_point', ownerId: decisionId, beatId: beatOne });

    const review = arcContinuity(two.file);
    expect(review.notes.filter((note) => note.kind === 'cause_after_effect')).toHaveLength(1);
    expect(review.notes[0]!.text).toContain('written later in the story');
  });

  it('says nothing when the cause comes first', () => {
    const { file, refusalId, decisionId, beatOne, beatTwo } = arced();
    const linked = linkEntities(file, {
      from: ref('arc_point', refusalId as string),
      to: ref('arc_point', decisionId as string),
      type: 'causes',
    });
    const one = pinUsage(linked, { ownerKind: 'arc_point', ownerId: refusalId, beatId: beatOne });
    const two = pinUsage(one.file, { ownerKind: 'arc_point', ownerId: decisionId, beatId: beatTwo });

    expect(arcContinuity(two.file).notes.filter((note) => note.kind === 'cause_after_effect')).toHaveLength(
      0,
    );
  });

  it('flags a refusal the arc never offered, which is §9’s own logic', () => {
    const { file, mara } = arced();
    const review = arcContinuity(file, mara);
    expect(review.notes.map((note) => note.kind)).toContain('refusal_never_offered');

    // Give her the chance, and the note goes.
    const arc = file.characterArcs.find((one) => (one.characterId as string) === (mara as string))!;
    const offered = addArcPoint(file, {
      arcId: arc.id,
      kind: 'opportunity',
      text: 'Her sister asks her to come home.',
    });
    expect(arcContinuity(offered.file, mara).notes).toHaveLength(0);
  });

  it('puts the arc points in manuscript order', () => {
    const { file, refusalId, decisionId, beatOne, beatTwo } = arced();
    const one = pinUsage(file, { ownerKind: 'arc_point', ownerId: decisionId, beatId: beatTwo });
    const two = pinUsage(one.file, { ownerKind: 'arc_point', ownerId: refusalId, beatId: beatOne });

    const review = arcContinuity(two.file);
    expect(review.inOrder.map((row) => row.work.text)).toEqual([
      'Takes the money anyway.',
      'Stops covering for her.',
    ]);
    expect(describeRow(review.inOrder[0]!)).toBe('Refuses it: Takes the money anyway.');
  });
});

/**
 * What the script says by itself (addendum 08, stage 13).
 *
 * The review, like the map before it, showed only what somebody had written
 * down — so on a finished screenplay with no Creator records it said *nothing
 * matches that*, which was true and useless. The manuscript can answer a real
 * question: **where is this person across the story.**
 *
 * Every number here is countable. Whether a fifteen-scene absence is a problem
 * is the writer's to decide, which is why these are reports and not warnings.
 */
describe('the review reading the script', () => {
  const cue = (text: string) => ({
    id: crypto.randomUUID(),
    type: 'character' as const,
    text,
    characterId: null,
    attributes: {},
  });

  /** A screenplay whose scenes are named by who speaks in them. */
  const screenplay = (scenes: string[][]) => {
    let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    for (const name of ['MARA', 'DEAKINS', 'SAL']) file = addCharacter(file, { name });

    scenes.forEach((cues, index) => {
      const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: `SCENE ${index + 1}` });
      const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'A beat' });
      file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: cues.map(cue) } });
    });
    return file;
  };

  it('says how many scenes and how many speeches, with nothing written down', () => {
    const file = screenplay([['MARA', 'MARA', 'DEAKINS'], ['MARA']]);
    const rows = scriptPresence(file);

    const mara = rows.find((row) => row.characterName === 'MARA')!;
    expect(mara.scenes).toBe(2);
    expect(mara.speeches).toBe(3);
    expect(mara.appearances.map((one) => one.speeches)).toEqual([2, 1]);
    // Busiest first, because that is the order the question is usually asked in.
    expect(rows[0]!.characterName).toBe('MARA');
  });

  it('names the longest stretch somebody is away, between two appearances', () => {
    const file = screenplay([['MARA'], ['DEAKINS'], ['DEAKINS'], ['DEAKINS'], ['MARA']]);
    const mara = scriptPresence(file).find((row) => row.characterName === 'MARA')!;

    expect(mara.gap!.scenes).toBe(3);
    expect(mara.gap!.after.unitTitle).toContain('SCENE 1');
    expect(mara.gap!.before.unitTitle).toContain('SCENE 5');
  });

  it('does not call arriving late or leaving early a gap', () => {
    // A character who comes in at scene 4 and stays has not been away from
    // anything; saying so would be the software inventing a problem.
    const file = screenplay([['MARA'], ['MARA'], ['MARA'], ['SAL'], ['SAL']]);
    const rows = scriptPresence(file);

    expect(rows.find((row) => row.characterName === 'SAL')!.gap).toBeNull();
    expect(rows.find((row) => row.characterName === 'MARA')!.gap).toBeNull();
  });

  it('reads a cue with its extension as the same person', () => {
    const file = screenplay([['MARA'], ['MARA (V.O.)'], ["MARA (CONT'D)"]]);
    const mara = scriptPresence(file).find((row) => row.characterName === 'MARA')!;
    expect(mara.scenes).toBe(3);
  });

  it('does not read MARABEL as MARA, which the old rule did', () => {
    const file = screenplay([['MARABEL'], ['MARABEL']]);
    expect(scriptPresence(file).find((row) => row.characterName === 'MARA')).toBeUndefined();
  });

  it('reports a cue that matches nobody, and where it first speaks', () => {
    const file = screenplay([['MARA'], ['MAEVE'], ['MAEVE (V.O.)']]);
    const unknown = cuesWithoutCharacter(file);

    expect(unknown).toHaveLength(1);
    expect(unknown[0]!.cue).toBe('MAEVE');
    // The extension is stripped, so one person is one row rather than two.
    expect(unknown[0]!.speeches).toBe(2);
    expect(unknown[0]!.firstUnitTitle).toContain('SCENE 2');
  });

  it('says who is in the cast and never speaks, rather than leaving them out', () => {
    const file = screenplay([['MARA'], ['DEAKINS']]);
    const silent = castNeverSpoken(file);

    expect(silent).toHaveLength(1);
    expect(file.characters.find((one) => one.id === silent[0])!.name).toBe('SAL');
  });

  it('narrows to one person, and to one plot', () => {
    const file = screenplay([['MARA', 'DEAKINS']]);
    const mara = file.characters.find((one) => one.name === 'MARA')!;

    expect(scriptPresence(file, { characterId: mara.id })).toHaveLength(1);
    expect(scriptPresence(file, { laneId: file.lanes[0]!.id }).length).toBeGreaterThan(0);
    expect(scriptPresence(file, { query: 'deak' }).map((row) => row.characterName)).toEqual(['DEAKINS']);
  });

  it('empties when the writing goes, because nothing was stored', () => {
    const file = screenplay([['MARA', 'DEAKINS']]);
    expect(scriptPresence(file).length).toBe(2);
    expect(scriptPresence({ ...file, beats: [] })).toHaveLength(0);
  });
});
