import { describe, expect, it } from 'vitest';
import {
  ARC_SHAPE_WORDS,
  USAGE_WORDS,
  addBeat,
  addUnit,
  arcInStoryOrder,
  arcPointSchema,
  arcShape,
  characterArcSchema,
  characterTraitSchema,
  characterizationItemSchema,
  characterizationOf,
  createProjectFile,
  isUsed,
  newId,
  onDeckNote,
  stillOnDeck,
  unfiledItems,
  usageColour,
  usageLinkSchema,
  usageStanding,
  updateBeat,
  type ArcPoint,
  type CharacterArc,
  type CharacterTrait,
  type CharacterizationItem,
  type ProjectFile,
  type UsageLink,
} from '../index.js';

/**
 * The Character Creator's vocabulary (addendum 08, stage 0).
 *
 * Two claims carry the module and both are tested hardest:
 *
 * **Used is a reading, never a stored flag.** Delete the beat and the item goes
 * red by itself; move the scene and nothing changes at all. Nothing sets it, so
 * nothing can set it wrongly.
 *
 * **A rewritten line is not a broken link.** The quote and the manuscript
 * diverge the moment the writer improves the sentence, and going red there
 * would punish somebody for writing.
 */

const AT = '2026-09-12T00:00:00.000Z';

// Real uuids, because the ids are branded and validated as such — which is the
// point of branding them: a trait id can never be handed an item's.
const uid = (): string => newId() as string;
const PROJECT = uid();
const CHAR = uid();
const TRAIT = uid();
const ITEM = uid();
const ARC = uid();

const trait = (over: Partial<CharacterTrait>): CharacterTrait =>
  characterTraitSchema.parse({
    id: TRAIT,
    projectId: PROJECT,
    characterId: CHAR,
    name: 'Greedy',
    orderKey: 'a0',
    createdAt: AT,
    updatedAt: AT,
    ...over,
  });

const item = (over: Partial<CharacterizationItem>): CharacterizationItem =>
  characterizationItemSchema.parse({
    id: ITEM,
    projectId: PROJECT,
    characterId: CHAR,
    traitId: TRAIT,
    text: 'Leaves a very poor tip at dinner.',
    orderKey: 'a0',
    createdAt: AT,
    updatedAt: AT,
    ...over,
  });

const link = (over: Partial<UsageLink>): UsageLink =>
  usageLinkSchema.parse({
    id: uid(),
    projectId: PROJECT,
    ownerKind: 'characterization',
    ownerId: ITEM,
    beatId: uid(),
    createdAt: AT,
    updatedAt: AT,
    ...over,
  });

/** A project with one scene, one beat and one line in it. */
const written = (): { file: ProjectFile; beatId: string; elementId: string } => {
  let file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  file = { ...file, units: [], beats: [] };
  const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. DINER - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
  const elementId = newId();
  const done = updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [
        { id: elementId, type: 'action', text: 'He counts out four coins.', characterId: null, attributes: {} },
      ],
    },
  });
  return { file: done, beatId: beat.beat.id as string, elementId: elementId as string };
};

describe('used is a reading, never a stored flag', () => {
  it('is green when the link still points at something', () => {
    const { file, beatId } = written();
    const links = [link({ beatId })];
    expect(isUsed({ kind: 'characterization', id: ITEM }, links, file)).toBe(true);
  });

  it('goes red by itself when the beat is deleted — nothing updates anything', () => {
    const { file, beatId } = written();
    const links = [link({ beatId })];
    expect(isUsed({ kind: 'characterization', id: ITEM }, links, file)).toBe(true);

    // The writer cuts the beat. No code runs against the characterization item;
    // it is red the next time anybody looks, which is §17 for free.
    const cut: ProjectFile = { ...file, beats: [] };
    expect(isUsed({ kind: 'characterization', id: ITEM }, links, cut)).toBe(false);
  });

  it('changes nothing at all when the scene is moved, because the link is to an id', () => {
    const { file, beatId } = written();
    const links = [link({ beatId })];
    const moved: ProjectFile = {
      ...file,
      units: file.units.map((unit) => ({ ...unit, orderKey: 'z9' })),
    };
    expect(isUsed({ kind: 'characterization', id: ITEM }, links, moved)).toBe(true);
  });

  it('stays green while one valid link remains, and only then goes red', () => {
    // §6: a single item may be used more than once.
    const { file, beatId } = written();
    const links = [link({ beatId }), link({ beatId: uid() })];
    expect(isUsed({ kind: 'characterization', id: ITEM }, links, file)).toBe(true);
    expect(isUsed({ kind: 'characterization', id: ITEM }, [links[1]!], file)).toBe(false);
  });

  it('keeps an arc point’s links separate from a characterization item’s', () => {
    const { file, beatId } = written();
    const point = uid();
    const links = [link({ ownerKind: 'arc_point', ownerId: point, beatId })];
    expect(isUsed({ kind: 'arc_point', id: point }, links, file)).toBe(true);
    // Same id, different owner kind — an arc point and an item never share a link.
    expect(isUsed({ kind: 'characterization', id: point }, links, file)).toBe(false);
  });
});

describe('a rewritten line is not a broken link', () => {
  it('says the words changed, and stays used', () => {
    const { file, beatId, elementId } = written();
    const one = link({ beatId, elementId, quote: 'He counts out four coins.' });
    expect(usageStanding(one, file)).toBe('used');

    const better: ProjectFile = {
      ...file,
      beats: file.beats.map((beat) => ({
        ...beat,
        manuscript: {
          elements: beat.manuscript.elements.map((element) => ({
            ...element,
            text: 'He counts out three coins, then puts one back.',
          })),
        },
      })),
    };
    // Rewritten, not gone — and still green, because punishing somebody for
    // improving a line is the wrong thing for this module to do.
    expect(usageStanding(one, better)).toBe('rewritten');
    expect(isUsed({ kind: 'characterization', id: ITEM }, [one], better)).toBe(true);
  });

  it('is gone only when the thing it points at is not there', () => {
    const { file, beatId, elementId } = written();
    expect(usageStanding(link({ beatId, elementId: uid() }), file)).toBe('gone');
    expect(usageStanding(link({ beatId: uid() }), file)).toBe('gone');
  });

  it('has nothing to compare when the link is to a whole beat', () => {
    const { file, beatId } = written();
    expect(usageStanding(link({ beatId, quote: 'anything at all' }), file)).toBe('used');
  });
});

describe('red, green, and the third colour', () => {
  it('is on deck until it is written, which is a normal state and not an error', () => {
    expect(usageColour({ retired: false, used: false })).toBe('red');
    expect(USAGE_WORDS.red).toBe('On deck');
  });

  it('is set aside when the writer decided against it, which no reading can know', () => {
    expect(usageColour({ retired: true, used: false })).toBe('grey');
    // Retired wins even over used: the writer's decision about their own work
    // outranks what the manuscript happens to contain.
    expect(usageColour({ retired: true, used: true })).toBe('grey');
  });
});

describe('a trait is a folder for the ways it is shown', () => {
  const { file, beatId } = written();

  it('returns a trait with its items, not items with a trait', () => {
    const [folder] = characterizationOf({
      characterId: CHAR,
      traits: [trait({})],
      items: [item({}), item({ id: uid(), text: 'Argues over a minor charge.', orderKey: 'a1' })],
      links: [link({ ownerId: ITEM, beatId })],
      file,
    });

    expect(folder!.trait.name).toBe('Greedy');
    expect(folder!.items.map((one) => one.colour)).toEqual(['green', 'red']);
    expect(folder!.unshown).toBe(false);
  });

  it('marks a trait with nothing under it — an unfinished thought, not an error', () => {
    const [folder] = characterizationOf({
      characterId: CHAR,
      traits: [trait({})],
      items: [],
      links: [],
      file,
    });
    expect(folder!.unshown).toBe(true);
  });

  it('keeps somewhere for characterization noticed before it was filed', () => {
    // The right-click workflow (§7) makes one of these in a second without
    // asking for a trait first, so the fast path must not be the lossy one.
    const loose = item({ id: uid(), traitId: null, text: 'Takes the last of the bread.' });
    expect(unfiledItems({ characterId: CHAR, items: [item({}), loose] }).map((one) => one.id)).toEqual([
      loose.id,
    ]);
  });
});

describe('what is still on deck', () => {
  const { file, beatId } = written();
  const waiting = uid();

  it('leaves out what is written and what was set aside', () => {
    const onDeck = stillOnDeck({
      characterId: CHAR,
      items: [item({}), item({ id: waiting }), item({ id: uid(), retired: true })],
      points: [],
      links: [link({ ownerId: ITEM, beatId })],
      file,
    });
    expect(onDeck.characterization.map((one) => one.id)).toEqual([waiting]);
    expect(onDeckNote(onDeck)).toBe('1 way to show them still on deck.');
  });

  it('says so plainly when there is nothing left', () => {
    expect(onDeckNote({ characterization: [], arc: [] })).toContain('Everything planned is in the writing');
  });
});

describe('the arc does not assume anybody improves', () => {
  const arc = (over: Partial<CharacterArc> = {}): CharacterArc =>
    characterArcSchema.parse({
      id: ARC,
      projectId: PROJECT,
      characterId: CHAR,
      beginning: 'Miserly, joyless.',
      ending: 'Charitable, engaged.',
      createdAt: AT,
      updatedAt: AT,
      ...over,
    });

  const point = (over: Partial<ArcPoint>): ArcPoint =>
    arcPointSchema.parse({
      id: uid(),
      projectId: PROJECT,
      arcId: ARC,
      characterId: CHAR,
      text: 'Something happens.',
      orderKey: 'a0',
      createdAt: AT,
      updatedAt: AT,
      ...over,
    });

  it('reads the shape back rather than asking the writer to declare it', () => {
    expect(arcShape({ arc: arc(), points: [point({ kind: 'turning_point' })] })).toBe('positive');
    expect(arcShape({ arc: arc(), points: [point({ kind: 'setback' })] })).toBe('negative');
  });

  it('calls it refused the moment a refusal exists, whatever else is there', () => {
    // §9: the refusal is the defining dramatic event once it happens, so it
    // outranks every other point in the reading.
    const points = [
      point({ kind: 'opportunity' }),
      point({ kind: 'refusal' }),
      point({ kind: 'turning_point' }),
    ];
    expect(arcShape({ arc: arc(), points })).toBe('refused');
    expect(arcShape({ arc: arc(), points: [point({ kind: 'doubling_down' })] })).toBe('refused');
    expect(ARC_SHAPE_WORDS.refused).toContain('refuses it');
  });

  it('names the character who stays who they are rather than calling it unfinished', () => {
    expect(arcShape({ arc: arc({ ending: '' }), points: [point({})] })).toBe('flat');
    expect(arcShape({ arc: arc({ beginning: 'Someone.', ending: '' }), points: [] })).toBe('flat');
    expect(arcShape({ arc: null, points: [] })).toBe('unstarted');
  });

  it('reads the arc in the story’s order, not the order the points were thought of', () => {
    const { file } = written();
    const second = addUnit(file, { laneId: file.lanes[0]!.id, title: 'EXT. DOCKS' });
    const secondBeat = addBeat(second.file, { unitId: second.unit.id, title: 'Later' });
    const whole = secondBeat.file;

    const first = whole.beats[0]!;
    const later = secondBeat.beat;
    // The writer thought of the docks point first and the diner point second.
    const docks = uid();
    const diner = uid();
    const ondeck = uid();
    const points = [
      point({ id: docks, orderKey: 'a0' }),
      point({ id: diner, orderKey: 'a1' }),
      point({ id: ondeck, orderKey: 'a2' }),
    ];
    const links = [
      link({ ownerKind: 'arc_point', ownerId: docks, beatId: later.id as string }),
      link({ ownerKind: 'arc_point', ownerId: diner, beatId: first.id as string }),
    ];

    const ordered = arcInStoryOrder({ points, links, file: whole });
    // Diner first because its scene is first; what is still on deck comes last.
    expect(ordered.map((one) => one.point.id)).toEqual([diner, docks, ondeck]);
    expect(ordered[2]!.where).toBe(null);
  });
});
