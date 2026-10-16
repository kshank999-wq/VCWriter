import { castPageSchema, castingSchema, type CastPageSettings, type Casting } from './entities/cast-page.js';
import type { Character } from './entities/character.js';
import type { ProjectFormat } from './entities/project.js';
import { castByCategory, charactersCalled } from './characters.js';
import { beatsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';

/**
 * **The cast page, read** (addendum 38 §4).
 *
 * Everything here is a reading of what is already stored: the roles are the
 * characters, their order is the script's, and the page's own words are
 * `settings.castPage`. Nothing about the page is kept twice, so renaming
 * somebody in the Character Creator renames them on the cast page, and a
 * scene moved earlier moves its first entrance with it.
 */

/**
 * Whether the format prints a cast page. A play does, a musical being a play;
 * a screenplay does not — its cast is the casting director's breakdown, which
 * is a different document, and a page of names in front of a film script is a
 * mistake a reader notices.
 */
export const hasCastPage = (format: ProjectFormat): boolean => format === 'stage_play';

/** A character's casting, with the schema's defaults for one never filled in. */
export const castingOf = (character: { casting?: Partial<Casting> | null }): Casting =>
  castingSchema.parse(character.casting ?? {});

/** The page's own words, with the defaults filled in. */
export const castPageSettingsOf = (file: ProjectFile): CastPageSettings =>
  castPageSchema.parse(file.settings.castPage ?? {});

/** One role as the page lists it. */
export interface CastRole {
  id: string;
  /** The name as the cue spells it: the page is set in capitals. */
  name: string;
  description: string;
  playingAge: string;
  vocalRange: string;
}

/** Everything the cast page prints, worked out once for the print and the dialog. */
export interface CastPageContent {
  heading: string;
  roles: CastRole[];
  /**
   * The roles one actor plays, a list per actor, in the page's order — only
   * where there are two or more, a single role being no doubling at all.
   */
  doubling: string[][];
  time: string;
  place: string;
  notes: string;
}

/**
 * **The cast in the order the page lists it** — every living, unarchived
 * character, the ones taken off the page included, so the dialog can show
 * them and the tick that put them back.
 *
 * *In order of appearance* is the order their cue first appears in the
 * script, matched by the character bound to it or by name or alias
 * (`charactersCalled`), which is the same matching every other reading of a
 * cue does. Somebody who never speaks — the man in the photograph — comes
 * after everybody who does, in the order the cast panel files them.
 *
 * *By importance* is the cast panel's own order: main, then the rest of the
 * headings, then the unfiled.
 */
export const castInPageOrder = (file: ProjectFile): Character[] => {
  const filed = castByCategory(file).flatMap((group) => group.characters);
  if (castPageSettingsOf(file).order === 'importance') return filed;

  const order: Character[] = [];
  const taken = new Set<string>();
  const enter = (person: Character) => {
    if (taken.has(person.id as string)) return;
    taken.add(person.id as string);
    order.push(person);
  };
  const living = new Map(filed.map((person) => [person.id as string, person]));
  // What prints is what counts: a scene or a beat left out of the script is
  // not where anybody enters.
  const printed = new Set(file.units.filter((unit) => unit.inScript).map((unit) => unit.id as string));
  for (const beat of beatsInStoryOrder(file)) {
    if (!beat.inScript || !printed.has(beat.unitId as string)) continue;
    for (const element of beat.manuscript.elements) {
      if (element.type !== 'character') continue;
      const bound = element.characterId ? living.get(element.characterId as string) : undefined;
      const people = bound ? [bound] : charactersCalled(file, element.text).filter((one) => living.has(one.id as string));
      // A cue matching two people is said to be both elsewhere; here it would
      // be guessing at who entered first, so it waits for one that does not.
      if (people.length === 1) enter(people[0] as Character);
    }
  }
  for (const person of filed) enter(person);
  return order;
};

/**
 * The doubling, as chains: each role's `doubles` read both ways, so A → B and
 * C → B are one actor playing three parts. A link to somebody off the page or
 * no longer in the cast is skipped — the page cannot say a role is doubled
 * with one it does not list.
 */
const doublingIn = (listed: readonly Character[]): string[][] => {
  const index = new Map(listed.map((person, at) => [person.id as string, at]));
  const parent = listed.map((_, at) => at);
  const root = (at: number): number => {
    let here = at;
    while (parent[here] !== here) here = parent[here] as number;
    return here;
  };
  listed.forEach((person, at) => {
    const other = castingOf(person).doubles;
    const there = other ? index.get(other as string) : undefined;
    if (there === undefined || there === at) return;
    const [a, b] = [root(at), root(there)];
    // The earlier on the page is the root, so each chain reads in page order.
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  });
  const chains = new Map<number, string[]>();
  listed.forEach((person, at) => {
    const top = root(at);
    chains.set(top, [...(chains.get(top) ?? []), person.name.toUpperCase()]);
  });
  return [...chains.values()].filter((chain) => chain.length > 1);
};

export const castPageOf = (file: ProjectFile): CastPageContent => {
  const settings = castPageSettingsOf(file);
  const listed = castInPageOrder(file).filter((person) => castingOf(person).include);
  return {
    heading: settings.heading.trim() || 'Characters',
    roles: listed.map((person) => {
      const casting = castingOf(person);
      return {
        id: person.id as string,
        name: person.name.toUpperCase(),
        description: casting.description.trim(),
        playingAge: casting.playingAge.trim(),
        vocalRange: casting.vocalRange.trim(),
      };
    }),
    doubling: doublingIn(listed),
    time: settings.time.trim(),
    place: settings.place.trim(),
    notes: settings.notes.trim(),
  };
};

/**
 * Whether there is a page to print: a play with nobody in its cast yet has no
 * cast page, rather than a page headed *Characters* with nothing under it.
 */
export const printsCastPage = (file: ProjectFile): boolean =>
  hasCastPage(file.project.format) && castPageOf(file).roles.length > 0;

/**
 * One role's line as the page sets it, after the name: the description, then
 * the age and the range in brackets — *her brother, a schoolteacher (40s;
 * baritone)*. Assembled here so the print and the dialog's sheet say the same.
 */
export const castRoleLine = (role: CastRole): string => {
  const facts = [role.playingAge, role.vocalRange].filter((one) => one.length > 0).join('; ');
  return [role.description, facts.length > 0 ? `(${facts})` : ''].filter((one) => one.length > 0).join(' ');
};
