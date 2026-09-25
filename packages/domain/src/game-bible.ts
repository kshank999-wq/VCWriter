import { allConditions, allEffects, conditionsIn, resourcesOf, statesOf } from './narrative.js';
import { mechanicsOf, objectsOf, puzzlesOf } from './narrative-world.js';
import { locationsInOrder } from './locations.js';
import { objectiveConditions, questSteps, questsOf } from './narrative-objectives.js';
import { behaviourConditions } from './narrative-scene.js';
import type { ProjectFile } from './project-file.js';

/**
 * The Game Bible's own sections (addendum 25 §4.1).
 *
 * On a game, **Research is the Game Bible**. The audit a ninth time: its side
 * menu already holds the cast, the locations, the plots, setups and payoffs,
 * themes and motifs, the character map and the graveyard — most of what the
 * spec's §4 lists — so a second room beside it would be a second place to
 * look for the same people and places. What a game adds is a group of its
 * own: what the player carries, the state the story keeps, and the quests.
 *
 * Every card's **Used / Not yet used** is a reading, as research's own usage
 * is for a note: a resource or a state is *used* when some rule reads or
 * changes it, a quest when it has a step. Nothing is stored.
 */

export type BibleSection = 'resources' | 'states' | 'objects' | 'puzzles' | 'environments' | 'quests';

export const BIBLE_SECTIONS: { section: BibleSection; label: string }[] = [
  { section: 'resources', label: 'Items & resources' },
  { section: 'states', label: 'State' },
  { section: 'objects', label: 'Interactive objects' },
  { section: 'puzzles', label: 'Puzzles' },
  { section: 'environments', label: 'Environments' },
  { section: 'quests', label: 'Quests & objectives' },
];

export interface BibleEntry {
  id: string;
  name: string;
  /** What kind of thing it is, in the designer's words. */
  kind: string;
  /** How many rules read or change it; steps, for a quest. */
  uses: number;
  used: boolean;
}

/** Every id some rule mentions, and how often: conditions, effects and objectives. */
const mentions = (file: ProjectFile): Map<string, number> => {
  const count = new Map<string, number>();
  const add = (id: string) => count.set(id, (count.get(id) ?? 0) + 1);
  for (const { condition } of allConditions(file)) add(condition.subjectId);
  for (const { condition } of objectiveConditions(file)) add(condition.subjectId);
  for (const { condition } of behaviourConditions(file)) add(condition.subjectId);
  for (const { effect } of allEffects(file)) add(effect.targetId);
  return count;
};

const RESOURCE_WORDS: Record<string, string> = {
  weapon: 'Weapon',
  ammunition: 'Ammunition',
  consumable: 'Consumable',
  currency: 'Currency',
  key_item: 'Key item',
  ability: 'Ability',
  upgrade: 'Upgrade',
  collectible: 'Collectible',
};

const STATE_WORDS: Record<string, string> = {
  flag: 'Flag',
  number: 'Number',
  enum: 'One of a list',
  text: 'Text',
};

/** The cards in one section, in the designer's order. */
export const bibleEntries = (file: ProjectFile, section: BibleSection): BibleEntry[] => {
  if (section === 'objects') {
    // Used once it is somewhere the player can use it.
    return objectsOf(file).map((one) => {
      const uses = one.verbs.length;
      return { id: one.id as string, name: one.name, kind: 'Object', uses, used: one.placedAt.length > 0 && uses > 0 };
    });
  }
  if (section === 'puzzles') {
    // Used once it is in a scene with a solution written.
    return puzzlesOf(file).map((one) => {
      const uses = conditionsIn(one.solution).length;
      return { id: one.id as string, name: one.name, kind: 'Puzzle', uses, used: one.unitId !== null && uses > 0 };
    });
  }
  if (section === 'environments') {
    // Every place, and how many mechanics the game gives it.
    return locationsInOrder(file).map((one) => {
      const uses = mechanicsOf(file, one.id).length;
      return { id: one.id as string, name: one.name, kind: 'Place', uses, used: uses > 0 };
    });
  }
  if (section === 'quests') {
    return questsOf(file).map((quest) => {
      const steps = questSteps(file, quest.id).length;
      return { id: quest.id as string, name: quest.name, kind: 'Quest', uses: steps, used: steps > 0 };
    });
  }
  const seen = mentions(file);
  if (section === 'resources') {
    return resourcesOf(file).map((one) => {
      const uses = seen.get(one.id as string) ?? 0;
      return { id: one.id as string, name: one.name, kind: RESOURCE_WORDS[one.kind] ?? one.kind, uses, used: uses > 0 };
    });
  }
  return statesOf(file).map((one) => {
    const uses = seen.get(one.id as string) ?? 0;
    return { id: one.id as string, name: one.key, kind: STATE_WORDS[one.kind] ?? one.kind, uses, used: uses > 0 };
  });
};

/** How many cards a section has, and how many nothing uses yet, for the side menu. */
export const bibleCounts = (file: ProjectFile): Record<BibleSection, { total: number; unused: number }> => {
  const out = {} as Record<BibleSection, { total: number; unused: number }>;
  for (const { section } of BIBLE_SECTIONS) {
    const entries = bibleEntries(file, section);
    out[section] = { total: entries.length, unused: entries.filter((one) => !one.used).length };
  }
  return out;
};

/** What a card says under its name: its kind, and how much it is used. */
export const describeEntry = (section: BibleSection, entry: BibleEntry): string => {
  if (section === 'quests') {
    return entry.uses === 0 ? 'No steps yet' : `${entry.uses} step${entry.uses === 1 ? '' : 's'}`;
  }
  if (section === 'objects') {
    return entry.uses === 0 ? 'Nothing to do to it yet' : `${entry.uses} thing${entry.uses === 1 ? '' : 's'} to do`;
  }
  if (section === 'puzzles') {
    return entry.used ? `Solved by ${entry.uses} condition${entry.uses === 1 ? '' : 's'}` : 'Not in a scene with a solution yet';
  }
  if (section === 'environments') {
    return entry.uses === 0 ? 'No mechanics yet' : `${entry.uses} mechanic${entry.uses === 1 ? '' : 's'}`;
  }
  if (!entry.used) return `${entry.kind} · not yet used`;
  return `${entry.kind} · ${entry.uses} rule${entry.uses === 1 ? '' : 's'}`;
};
