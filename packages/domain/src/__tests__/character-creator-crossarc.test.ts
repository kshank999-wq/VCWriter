import { describe, expect, it } from 'vitest';
import {
  addArcPoint,
  addBeat,
  addCharacter,
  addUnit,
  arcEffectsOf,
  arcsTurningIn,
  beginArc,
  createProjectFile,
  isArcVerb,
  linkEntities,
  otherArcPoints,
  pinUsage,
  ref,
  relatedEntities,
  removeArcPoint,
  resolveRef,
  unlink,
  updateCharacter,
  type ProjectFile,
} from '../index.js';

/**
 * Cross-character arc links (addendum 08, stage 9 — §13).
 *
 * **A cross-arc link is exactly a story link**, which §3.1 decided two stages
 * before this one: two references, a verb and a note. So the test that matters
 * is not that a new record works — there is no new record — but that the old one
 * carries this without being bent: an arc point resolves like any other entity,
 * and the Related Elements box shows the link without being told about arcs.
 */

const staged = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. DINER - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
  file = beat.file;

  file = addCharacter(file, { name: 'MARA' });
  const mara = file.characters[file.characters.length - 1]!.id;
  file = addCharacter(file, { name: 'DEAKINS' });
  const deakins = file.characters[file.characters.length - 1]!.id;

  const hers = beginArc(file, mara);
  const his = beginArc(hers.file, deakins);
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

  return {
    file: decision.file,
    mara,
    deakins,
    refusalId: refusal.point!.id,
    decisionId: decision.point!.id,
    beatId: beat.beat.id,
  };
};

describe('one arc moving another', () => {
  it('is an ordinary story link, and nothing else', () => {
    // §13's example made real: one character's refusal to change becomes
    // another character's catalyst.
    const { file, refusalId, decisionId } = staged();
    const linked = linkEntities(file, {
      from: ref('arc_point', refusalId as string),
      to: ref('arc_point', decisionId as string),
      type: 'causes',
    });

    expect(linked.links).toHaveLength(1);
    expect(linked.links[0]!.type).toBe('causes');
    expect(isArcVerb('causes')).toBe(true);
    expect(isArcVerb('relates_to')).toBe(false);
  });

  it('resolves an arc point like any other entity, so Related Elements draws it', () => {
    const { file, refusalId, decisionId } = staged();
    const linked = linkEntities(file, {
      from: ref('arc_point', refusalId as string),
      to: ref('arc_point', decisionId as string),
      type: 'causes',
    });

    const resolved = resolveRef(linked, ref('arc_point', decisionId as string));
    expect(resolved.exists).toBe(true);
    expect(resolved.label).toBe('Stops covering for her.');
    expect(resolved.detail).toBe("DEAKINS's arc");

    // The panel that draws links asked nothing about arcs to show this.
    const related = relatedEntities(linked, ref('arc_point', refusalId as string));
    expect(related).toHaveLength(1);
    expect(related[0]!.other.label).toBe('Stops covering for her.');
  });

  it('follows a rename through the id, like every other link', () => {
    const { file, deakins, refusalId, decisionId } = staged();
    const linked = linkEntities(file, {
      from: ref('arc_point', refusalId as string),
      to: ref('arc_point', decisionId as string),
      type: 'causes',
    });
    const renamed = updateCharacter(linked, deakins, { name: 'ROURKE' });

    expect(resolveRef(renamed, ref('arc_point', decisionId as string)).detail).toBe("ROURKE's arc");
  });
});

describe('whose arcs are affected', () => {
  it('reads both directions, because being moved is a fact about a journey too', () => {
    const { file, refusalId, decisionId } = staged();
    const linked = linkEntities(file, {
      from: ref('arc_point', refusalId as string),
      to: ref('arc_point', decisionId as string),
      type: 'causes',
    });

    const hers = arcEffectsOf(linked, refusalId);
    expect(hers).toHaveLength(1);
    expect(hers[0]!.outward).toBe(true);
    expect(hers[0]!.verb).toBe('causes');
    expect(hers[0]!.otherCharacterName).toBe('DEAKINS');

    const his = arcEffectsOf(linked, decisionId);
    expect(his).toHaveLength(1);
    expect(his[0]!.outward).toBe(false);
    expect(his[0]!.otherCharacterName).toBe('MARA');
  });

  it('says nothing about a link that is not an arc verb', () => {
    const { file, refusalId, decisionId } = staged();
    const linked = linkEntities(file, {
      from: ref('arc_point', refusalId as string),
      to: ref('arc_point', decisionId as string),
      type: 'relates_to',
    });
    expect(arcEffectsOf(linked, refusalId)).toHaveLength(0);
  });

  it('drops the effect when the point at the other end is deleted', () => {
    const { file, refusalId, decisionId } = staged();
    const linked = linkEntities(file, {
      from: ref('arc_point', refusalId as string),
      to: ref('arc_point', decisionId as string),
      type: 'causes',
    });
    const gone = removeArcPoint(linked, decisionId);
    expect(arcEffectsOf(gone, refusalId)).toHaveLength(0);
  });

  it('unlinking takes the effect and leaves both arcs alone', () => {
    const { file, refusalId, decisionId } = staged();
    const linked = linkEntities(file, {
      from: ref('arc_point', refusalId as string),
      to: ref('arc_point', decisionId as string),
      type: 'causes',
    });
    const after = unlink(linked, linked.links[0]!.id);

    expect(arcEffectsOf(after, refusalId)).toHaveLength(0);
    expect(after.arcPoints).toHaveLength(2);
  });

  it('offers other people’s points and never this arc’s own', () => {
    const { file, mara } = staged();
    const offered = otherArcPoints(file, mara);
    expect(offered).toHaveLength(1);
    expect(offered[0]!.characterName).toBe('DEAKINS');
    expect(offered[0]!.points.map((point) => point.text)).toEqual(['Stops covering for her.']);
  });
});

describe('several arcs turning on one event', () => {
  it('lists a link only when both ends are in the same beat', () => {
    const { file, refusalId, decisionId, beatId } = staged();
    const linked = linkEntities(file, {
      from: ref('arc_point', refusalId as string),
      to: ref('arc_point', decisionId as string),
      type: 'causes',
    });

    // One end pinned here: a real link, but not one dramatic event.
    const half = pinUsage(linked, { ownerKind: 'arc_point', ownerId: refusalId, beatId });
    expect(arcsTurningIn(half.file, beatId)).toHaveLength(0);

    const both = pinUsage(half.file, { ownerKind: 'arc_point', ownerId: decisionId, beatId });
    const turning = arcsTurningIn(both.file, beatId);
    expect(turning).toHaveLength(1);
    expect(turning[0]!.fromName).toBe('MARA');
    expect(turning[0]!.toName).toBe('DEAKINS');
    expect(turning[0]!.verb).toBe('causes');
  });
});
