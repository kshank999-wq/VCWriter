import { describe, expect, it } from 'vitest';
import {
  UP_NEXT_LIMIT,
  addArcPoint,
  addBeat,
  addCharacter,
  addCharacterization,
  addTrait,
  addUnit,
  beginArc,
  characterGlance,
  createProjectFile,
  describeUpNext,
  glancePills,
  pinUsage,
  relate,
  removeCharacterization,
  tracksInOrder,
  updateBeat,
  updateCharacterization,
  updateRelationship,
  upNext,
  type BeatId,
  type CharacterId,
  type ProjectFile,
} from '../index.js';

/**
 * *At a glance* and *Up next* (addendum 25 §3, stage 2).
 *
 * The claim both make is the module's oldest: **nothing here is stored**. A
 * bar written down would go on saying *3 used* after the scene was cut, and a
 * to-do list written down would go on asking for something already done — so
 * every test here does the work and asserts the line goes by itself.
 */

interface World {
  file: ProjectFile;
  silas: CharacterId;
  nell: CharacterId;
  beatId: BeatId;
}

const world = (): World => {
  let file = createProjectFile({ title: 'The Ledger', format: 'novel' });
  file = addCharacter(file, { name: 'Silas Crane' });
  file = addCharacter(file, { name: 'Nell Crane' });
  const silas = file.characters[file.characters.length - 2]!.id;
  const nell = file.characters[file.characters.length - 1]!.id;

  const track = tracksInOrder(file)[0]!;
  const unit = addUnit(file, { trackId: track.id, title: 'The Counting House' });
  file = unit.file;
  const beat = addBeat(file, { unitId: unit.unit.id, title: 'The coal bill' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [
        { id: 'p-1' as never, type: 'paragraph', text: 'He counted it twice.', characterId: null, attributes: {} },
      ],
    },
  } as never);
  return { file, silas, nell, beatId: beat.beat.id };
};

/** A trait with one way to show it, still on deck. */
const withTrait = (file: ProjectFile, characterId: CharacterId, name: string, text: string) => {
  const trait = addTrait(file, { characterId, name });
  const item = addCharacterization(trait.file, { characterId, traitId: trait.trait!.id, text });
  return { file: item.file, traitId: trait.trait!.id, itemId: item.item!.id };
};

describe('at a glance', () => {
  it('counts what is in the writing against what is waiting, and follows a pin', () => {
    const { file, silas, beatId } = world();
    const made = withTrait(file, silas, 'Miserly', "Argues over a ha'penny");
    expect(characterGlance({ characterId: silas as string, file: made.file }).moments).toEqual({
      used: 0,
      onDeck: 1,
      setAside: 0,
    });

    const pinned = pinUsage(made.file, {
      ownerKind: 'characterization',
      ownerId: made.itemId as string,
      beatId,
    }).file;
    expect(characterGlance({ characterId: silas as string, file: pinned }).moments).toMatchObject({
      used: 1,
      onDeck: 0,
    });

    // **And back again with nothing run**: cutting the moment takes the count
    // with it, which is what makes the bar worth believing.
    const cut = removeCharacterization(pinned, made.itemId);
    expect(characterGlance({ characterId: silas as string, file: cut }).moments).toMatchObject({
      used: 0,
      onDeck: 0,
    });
  });

  it('keeps a retired moment out of both halves', () => {
    const { file, silas } = world();
    const made = withTrait(file, silas, 'Miserly', 'Cries at the funeral');
    const retired = updateCharacterization(made.file, made.itemId, { retired: true });
    const glance = characterGlance({ characterId: silas as string, file: retired });
    expect(glance.moments).toEqual({ used: 0, onDeck: 0, setAside: 1 });
  });

  it('draws the arc as a line of placed points and then what is waiting', () => {
    const { file, silas, beatId } = world();
    const arc = beginArc(file, silas);
    let next = arc.file;
    const first = addArcPoint(next, { arcId: arc.arc.id, kind: 'movement', text: 'Notices the coat' });
    next = first.file;
    const second = addArcPoint(next, { arcId: arc.arc.id, kind: 'turning_point', text: 'Pays the doctor' });
    next = second.file;
    // Nothing placed yet: two dots, both waiting.
    expect(characterGlance({ characterId: silas as string, file: next }).arc).toMatchObject({
      placed: 0,
      total: 2,
      dots: ['red', 'red'],
    });

    const pinned = pinUsage(next, { ownerKind: 'arc_point', ownerId: first.point!.id as string, beatId }).file;
    const after = characterGlance({ characterId: silas as string, file: pinned }).arc;
    expect(after).toMatchObject({ placed: 1, total: 2 });
    // The placed one leads, which is the only honest order for a journey.
    expect(after.dots).toEqual(['green', 'red']);
  });

  it('names everybody once, whichever way the reading runs', () => {
    const { file, silas, nell } = world();
    const one = relate(file, { fromCharacterId: silas, toCharacterId: nell, kind: 'family' });
    // The other direction is a second record (addendum 08 §7) and the same person.
    const both = relate(one.file, { fromCharacterId: nell, toCharacterId: silas, kind: 'family' });
    const glance = characterGlance({ characterId: silas as string, file: both.file });
    expect(glance.people).toHaveLength(1);
    expect(glance.people[0]!.name).toBe('Nell Crane');
    expect(glance.people[0]!.colour).toMatch(/^#/);
  });

  it('says nothing about an arc nobody has started', () => {
    const { file, silas } = world();
    const glance = characterGlance({ characterId: silas as string, file });
    expect(glancePills(glance).arc).toBeNull();
    expect(glancePills(glance).onDeck).toBe('0 on deck');
  });
});

describe('up next', () => {
  it('names the trait rather than counting across all of them', () => {
    const { file, silas } = world();
    let next = withTrait(file, silas, 'Miserly', "Argues over a ha'penny").file;
    const second = addTrait(next, { characterId: silas, name: 'Secretly sentimental' });
    next = addCharacterization(second.file, {
      characterId: silas,
      traitId: second.trait!.id,
      text: "Keeps Ada's letters",
    }).file;
    next = addCharacterization(next, {
      characterId: silas,
      traitId: second.trait!.id,
      text: "Hums their mother's hymn",
    }).file;

    const steps = upNext({ characterId: silas as string, file: next });
    // The one with the most waiting leads, and it is named: *5 on deck* over
    // four traits tells a writer nothing about where to go.
    expect(steps[0]!.kind).toBe('on_deck');
    expect(steps[0]!.text).toContain('Secretly sentimental');
    expect(steps[0]!.text).toContain('2 moments');
    expect(steps[0]!.act).toBe('Place one');
    expect(steps[0]!.where).toEqual({ tab: 'traits', traitId: second.trait!.id });
    // And the singular reads as a sentence rather than as *1 ways*.
    expect(steps[1]!.text).toMatch(/^One moment for/);
  });

  it('offers rather than warns, and goes when the work is done', () => {
    const { file, silas, beatId } = world();
    const made = withTrait(file, silas, 'Miserly', "Argues over a ha'penny");
    expect(upNext({ characterId: silas as string, file: made.file })).toHaveLength(1);
    const pinned = pinUsage(made.file, {
      ownerKind: 'characterization',
      ownerId: made.itemId as string,
      beatId,
    }).file;
    const after = upNext({ characterId: silas as string, file: pinned });
    expect(after).toHaveLength(0);
    // The empty card says so out loud: a blank box looks broken.
    expect(describeUpNext(after)).toMatch(/Nothing waiting/);
  });

  it('asks about a moment nobody has filed, without calling it a mistake', () => {
    const { file, silas } = world();
    // A trait is optional on purpose (addendum 08 §8): somebody can notice a
    // thing before deciding what it shows.
    const loose = addCharacterization(file, { characterId: silas, traitId: null, text: 'Hoards the tongs' });
    const steps = upNext({ characterId: silas as string, file: loose.file });
    const unfiled = steps.find((step) => step.kind === 'unfiled')!;
    expect(unfiled.text).toBe('One moment is not under a trait yet.');
    expect(unfiled.waiting).toBe(false);
    expect(unfiled.where).toEqual({ tab: 'traits', traitId: null });
  });

  it('names an arc point with nowhere to be, and a relationship with nothing said', () => {
    const { file, silas, nell } = world();
    const arc = beginArc(file, silas);
    const point = addArcPoint(arc.file, {
      arcId: arc.arc.id,
      kind: 'movement',
      text: 'Laughs at himself',
    });
    const joined = relate(point.file, { fromCharacterId: silas, toCharacterId: nell, kind: 'family' });

    const steps = upNext({ characterId: silas as string, file: joined.file });
    expect(steps.map((step) => step.kind)).toEqual(['arc_on_deck', 'unanswered']);
    expect(steps[0]!.text).toContain('Laughs at himself');
    expect(steps[1]!.text).toContain('Nell Crane');

    // Saying where it stands answers it, with nothing run.
    const said = updateRelationship(joined.file, joined.relationship!.id, { state: 'He keeps her at arm’s length.' });
    expect(upNext({ characterId: silas as string, file: said }).map((step) => step.kind)).toEqual(['arc_on_deck']);
  });

  it('says how many more there are rather than showing them all', () => {
    const { file, silas } = world();
    let next = file;
    for (const name of ['Miserly', 'Lonely', 'Sharp-tongued', 'Kind once']) {
      const trait = addTrait(next, { characterId: silas, name });
      next = addCharacterization(trait.file, {
        characterId: silas,
        traitId: trait.trait!.id,
        text: `a way to show ${name}`,
      }).file;
    }
    const steps = upNext({ characterId: silas as string, file: next });
    expect(steps).toHaveLength(4);
    expect(describeUpNext(steps)).toBe(`${4 - UP_NEXT_LIMIT} more.`);
  });
});
