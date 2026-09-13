import { sortByOrderKey } from './ordering.js';
import { beatsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { ProjectFormat } from './entities/project.js';
import type { Character, CharacterCategory } from './entities/character.js';
import type { CharacterCategoryId } from './ids.js';

/**
 * The cast, and how it is filed (addendum 02 §16).
 *
 * Every project keeps its people under headings: **main** characters, **minor**
 * ones and **background** ones, and a series has **recurring** characters in
 * between the first two — the distinction a series actually makes, and the one
 * that decides who carries over into the next episode.
 *
 * The headings are data. A writer can rename them, reorder them or add their
 * own ("The family", "The precinct"), and a character filed under none is
 * not lost — they are simply unfiled, and shown last.
 *
 * What the headings are *for*, beyond tidiness: the order the cast is offered
 * in while a character cue is being typed. Main characters first, because
 * they are who you are usually about to type.
 */

/**
 * The headings a new project starts with. A series makes one more distinction.
 *
 * **Background last, and that is what it is for.** These headings order the
 * names offered while a cue is being typed, so the waitress who says one line
 * belongs at the bottom of that list rather than competing with the lead. It is
 * also the tier a writer will want to leave alone — somebody with one line
 * needs no trait, no arc and no attention from the Character Creator.
 *
 * Only new projects get these. An existing one keeps the headings it has, which
 * is right: they are the writer's, and a heading appearing in a finished script
 * because the software changed its mind would be the software rearranging
 * somebody's cast.
 */
export const defaultCharacterCategories = (format: ProjectFormat): string[] =>
  format === 'series'
    ? ['Main characters', 'Recurring characters', 'Minor characters', 'Background characters']
    : ['Main characters', 'Minor characters', 'Background characters'];

export const characterCategoriesInOrder = (file: ProjectFile): CharacterCategory[] =>
  sortByOrderKey(file.characterCategories ?? []);

export const findCharacterCategory = (
  file: ProjectFile,
  categoryId: CharacterCategoryId,
): CharacterCategory | undefined => (file.characterCategories ?? []).find((category) => category.id === categoryId);

/**
 * The category a name reads as, when one has to be guessed: the first heading
 * whose name starts the same way. Used when a project made before the
 * headings existed is opened, and when a capture routes a new name in.
 */
export const characterCategoryNamed = (file: ProjectFile, name: string): CharacterCategory | undefined => {
  const wanted = name.trim().toLowerCase();
  return characterCategoriesInOrder(file).find((category) => category.name.toLowerCase().startsWith(wanted));
};

export interface CastGroup {
  /** Null for the people filed under nothing, which is a real group. */
  category: CharacterCategory | null;
  name: string;
  characters: Character[];
}

/**
 * The cast grouped under its headings, in order, with the unfiled last. A
 * heading with nobody under it is kept: it is a heading the writer made, and
 * an empty one is where the next character goes.
 */
export const castByCategory = (file: ProjectFile, includeArchived = false): CastGroup[] => {
  const people = file.characters.filter((character) => includeArchived || !character.archived);
  const byName = (a: Character, b: Character) => a.name.localeCompare(b.name);

  const groups: CastGroup[] = characterCategoriesInOrder(file).map((category) => ({
    category,
    name: category.name,
    characters: people.filter((character) => character.categoryId === category.id).sort(byName),
  }));

  const known = new Set((file.characterCategories ?? []).map((category) => category.id as string));
  const unfiled = people
    .filter((character) => character.categoryId === null || !known.has(character.categoryId as string))
    .sort(byName);
  if (unfiled.length > 0) groups.push({ category: null, name: 'Not filed', characters: unfiled });
  return groups;
};

/**
 * The cast in the order it should be offered while typing: main characters
 * first, then the rest of the headings in their order, then the unfiled.
 * Names only, because a character cue is a name.
 */
export const castInCueOrder = (file: ProjectFile): string[] =>
  castByCategory(file).flatMap((group) => group.characters.map((character) => character.name));

/** The people under a set of headings — what an episode's carry-over asks for. */
export const charactersIn = (file: ProjectFile, categoryIds: readonly string[]): Character[] => {
  const wanted = new Set(categoryIds);
  return file.characters.filter((character) => !character.archived && wanted.has(character.categoryId as string));
};

/**
 * The name a cast list files someone under, whatever was typed.
 *
 * Extensions and the dual-dialogue caret are how a cue is *marked*, not who
 * is speaking: MAEVE, `MAEVE (V.O.)` and `MAEVE (CONT'D)` are one person.
 */
const cueKey = (name: string): string =>
  name
    .replace(/\s*\((?:[^)]*)\)\s*$/, '')
    .replace(/\s*\^\s*$/, '')
    .trim()
    .toUpperCase();

/**
 * Everybody a cue could be: matched whole, by name or by an alias.
 *
 * Usually one person. It is a list because an alias may collide with somebody
 * else's name, and picking one of them silently would put a speech in the wrong
 * character's scene — better to say the cue is both and let the caller decide.
 *
 * **Matched whole rather than by opening letters**, which is the difference
 * between this and the rule three modules used to carry: `MARABEL` is not
 * `MARA`.
 */
export const charactersCalled = (file: ProjectFile, cue: string): Character[] => {
  const key = cueKey(cue);
  if (key.length === 0) return [];
  return file.characters.filter((character) =>
    [character.name, ...character.aliases].some((name) => cueKey(name) === key),
  );
};

/** Whether the project already knows this person, by name or by an alias. */
export const knowsCharacter = (file: ProjectFile, name: string): Character | null => {
  const key = cueKey(name);
  if (key.length === 0) return null;
  return (
    file.characters.find(
      (character) =>
        cueKey(character.name) === key || character.aliases.some((alias) => cueKey(alias) === key),
    ) ?? null
  );
};

/**
 * Every name the script itself speaks with, in the order it first speaks
 * them. What the manuscript says, rather than what the cast list remembers.
 */
export const spokenNames = (file: ProjectFile): string[] => {
  const seen: string[] = [];
  for (const beat of beatsInStoryOrder(file)) {
    for (const element of beat.manuscript.elements) {
      if (element.type !== 'character') continue;
      const key = cueKey(element.text);
      if (key.length > 0 && !seen.includes(key)) seen.push(key);
    }
  }
  return seen;
};
