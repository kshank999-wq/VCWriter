import { z } from 'zod';
import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { orderKeyForIndex } from './ordering.js';
import { LANE_COLOURS, laneSchema, storyMarkerSchema, structuralUnitSchema, beatSchema } from './entities/structure.js';
import { titlePageOf, titlePageSchema } from './entities/title-page.js';
import type { TitlePage } from './entities/title-page.js';
import { countWords } from './entities/manuscript.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { markerNumber, markerNoun, markerNumbering as numberingOf } from './markers.js';
import { castByCategory, castInCueOrder, charactersIn } from './characters.js';
import type { ProjectFile } from './project-file.js';
import type { Beat, Lane, StructuralUnit, StoryMarker } from './entities/structure.js';
import type { Character } from './entities/character.js';
import type { BeatId, CharacterId, LaneId, StoryMarkerId, StructuralUnitId } from './ids.js';

/**
 * Episodes (addendum 02 §17).
 *
 * A series is one project divided into episodes, and an **episode is a run of
 * the story order** — it starts at the scene its marker is on and runs to the
 * scene before the next episode's. Nothing new holds it: no episode
 * container, no episode field on a scene. That is deliberate. A container
 * would cut across the lanes, and the hierarchy is lanes → scenes → beats
 * (spec §19); a field on the scene would be a second source of truth for
 * something the story order already says.
 *
 * The consequence worth having: everything that already works on a run of
 * scenes — the timeline, the pagination, find, the reports — works on an
 * episode without knowing episodes exist.
 *
 * **A new episode is a clear slate.** It gets its own scene with an empty
 * beat, and nothing of the last episode's text comes with it. What *does*
 * come is what the writer says should: the cast, the threads, the setups
 * still unpaid. That choice is remembered, because a series carries the same
 * things forward every week.
 */

export interface Episode {
  marker: StoryMarker;
  /**
   * The number of this script, from its own front page (§6.1) — not its
   * place in the running order. An episode with no number on its page takes
   * the lowest one nobody has claimed.
   */
  number: number;
  /** "EPISODE 3" — what the timeline and the title card print. */
  label: string;
  /** What the writer named it. May be empty; the label never is. */
  title: string;
  /** Every scene in this episode, in story order. */
  units: StructuralUnit[];
  beats: Beat[];
  words: number;
}

/**
 * The episodes of a project, in story order. Scenes before the first episode
 * marker belong to no episode — which is the state a series is in before the
 * writer has marked anything, and is not an error.
 */
/**
 * The number an episode's front page claims, if it names one.
 *
 * **The title page is where an episode is numbered** (spec §6.1): the number
 * typed there is the number of that script, so an episode can be *Episode 7*
 * without six others in front of it, and a pilot written last is still the
 * pilot. The first whole number in the field is the claim — "Episode 4 — The
 * Lamp" claims four — and a page that names no number at all makes no claim.
 */
export const episodeNumberOnPage = (marker: StoryMarker): number | null => {
  const found = /\d+/.exec(marker.titlePage?.episode ?? '');
  if (!found) return null;
  const number = Number.parseInt(found[0] as string, 10);
  return Number.isFinite(number) && number > 0 ? number : null;
};

/**
 * Number every episode: the pages that claim a number keep it, and the rest
 * take the lowest number nobody has claimed.
 *
 * Two episodes cannot be Episode 1 — the writes refuse it (`setEpisodeTitlePage`,
 * `addEpisode`) — but a file merged from two machines could arrive that way, so
 * this settles it rather than showing the same number twice: the earlier in the
 * story keeps the claim and the later falls through to the next free number.
 */
const numbersFor = (starts: readonly StoryMarker[]): number[] => {
  const claimed = new Set<number>();
  const claims = starts.map((marker) => {
    const number = episodeNumberOnPage(marker);
    if (number === null || claimed.has(number)) return null;
    claimed.add(number);
    return number;
  });

  let next = 1;
  return claims.map((claim) => {
    if (claim !== null) return claim;
    while (claimed.has(next)) next += 1;
    claimed.add(next);
    return next;
  });
};

/** The lowest number no episode's front page has claimed. */
export const nextEpisodeNumber = (file: ProjectFile): number => {
  const taken = new Set(episodes(file).map((episode) => episode.number));
  let next = 1;
  while (taken.has(next)) next += 1;
  return next;
};

/**
 * The episode already using the number this text claims, if there is one.
 *
 * The screen that edits a front page asks before it commits, so a clash is
 * something a writer is told about rather than something that throws under
 * them. `markerId` is the episode being edited, which never clashes with
 * itself.
 */
export const episodeNumberClash = (
  file: ProjectFile,
  markerId: StoryMarkerId,
  episodeText: string,
): Episode | null => {
  const found = /\d+/.exec(episodeText);
  if (!found) return null;
  const number = Number.parseInt(found[0] as string, 10);
  return (
    episodes(file).find(
      (episode) => episode.marker.id !== markerId && episodeNumberOnPage(episode.marker) === number,
    ) ?? null
  );
};

export const episodes = (file: ProjectFile): Episode[] => {
  const order = unitsInStoryOrder(file);
  const position = new Map(order.map((unit, index) => [unit.id as string, index]));
  const numbering = numberingOf(file);
  const symbol = file.settings.markerSymbol || '❦';

  const starts = file.markers
    .filter((marker) => marker.kind === 'episode' && position.has(marker.unitId as string))
    .sort((a, b) => (position.get(a.unitId as string) ?? 0) - (position.get(b.unitId as string) ?? 0));

  const numbers = numbersFor(starts);

  return starts.map((marker, index) => {
    const from = position.get(marker.unitId as string) ?? 0;
    const next = starts[index + 1];
    const to = next ? (position.get(next.unitId as string) ?? order.length) : order.length;
    const units = order.slice(from, to);
    const ids = new Set(units.map((unit) => unit.id as string));
    const beats = file.beats.filter((beat) => ids.has(beat.unitId as string));
    const number = numbers[index] as number;
    return {
      marker,
      number,
      label: `${markerNoun('episode')} ${markerNumber(number, numbering, symbol)}`.trim().toUpperCase(),
      title: marker.title,
      units,
      beats,
      words: beats.reduce((total, beat) => total + countWords(beat.manuscript), 0),
    };
  });
};

/** The episode a scene is in, or undefined for a scene ahead of the first one. */
export const episodeOfUnit = (file: ProjectFile, unitId: string): Episode | undefined =>
  episodes(file).find((episode) => episode.units.some((unit) => (unit.id as string) === unitId));

export const episodeOfBeat = (file: ProjectFile, beatId: string): Episode | undefined =>
  episodes(file).find((episode) => episode.beats.some((beat) => (beat.id as string) === beatId));

// --------------------------------------------------------------- carry-over

/**
 * What a new episode takes from the ones before it.
 *
 * Everything in a project is available to every episode already — one
 * document, one cast, one research shelf. So carrying over is not copying;
 * it is **deciding what this episode starts with in hand**: who is in it,
 * which threads it is plotted on, and what is still owed from earlier.
 */
export const episodeCarrySchema = z.object({
  /**
   * Headings whose people join the new episode's cast. A series usually
   * carries the mains and the recurring cast and leaves the guest parts of
   * last week's episode behind, which is exactly what these headings are for.
   */
  castFrom: z.array(z.string()).default([]),
  /** Also whoever actually spoke in the episode before this one. */
  castWhoSpoke: z.boolean().default(false),
  /** Plot it on the series' existing lanes, or start a fresh one for it. */
  lanes: z.enum(['series', 'fresh']).default('series'),
  /** Note the setups still unpaid on the new episode, so they are not lost. */
  openSetups: z.boolean().default(true),
});
export type EpisodeCarry = z.infer<typeof episodeCarrySchema>;

/**
 * What to carry, before the writer has said: the mains and the recurring
 * cast, on the series' own lanes, with the open setups noted. Guest parts —
 * whatever the last heading turns out to be — are left behind, because they
 * are guests.
 */
export const defaultEpisodeCarry = (file: ProjectFile): EpisodeCarry => {
  const stored = file.settings.episodeCarry;
  if (stored && Object.keys(stored).length > 0) return episodeCarrySchema.parse(stored);
  const headings = [...(file.characterCategories ?? [])].sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));
  return episodeCarrySchema.parse({
    castFrom: headings.slice(0, Math.max(1, headings.length - 1)).map((heading) => heading.id as string),
    castWhoSpoke: true,
    lanes: 'series',
    openSetups: true,
  });
};

/** Who the carry-over puts in the new episode's cast, without repeats. */
export const castForNewEpisode = (file: ProjectFile, carry: EpisodeCarry): CharacterId[] => {
  const cast = new Map<string, CharacterId>();
  for (const character of charactersIn(file, carry.castFrom)) cast.set(character.id as string, character.id);

  if (carry.castWhoSpoke) {
    const last = episodes(file).at(-1);
    const spoken = new Set(
      (last?.beats ?? []).flatMap((beat) =>
        beat.manuscript.elements
          .filter((element) => element.type === 'character')
          .map((element) => element.text.trim().toUpperCase()),
      ),
    );
    for (const character of file.characters) {
      if (character.archived) continue;
      const named = [character.name, ...character.aliases].some((name) =>
        [...spoken].some((cue) => cue.startsWith(name.trim().toUpperCase())),
      );
      if (named) cast.set(character.id as string, character.id);
    }
  }
  return [...cast.values()];
};

// --------------------------------------------------------------- new episode

export interface NewEpisode {
  file: ProjectFile;
  episode: Episode;
}

/**
 * Start the next episode: a scene of its own at the end of the story, an
 * empty beat in it to write into, and an episode marker on it carrying the
 * cast the carry-over chose. The number is not passed in — it is the
 * episode's position, so episodes cannot disagree about what they are called.
 */
export const addEpisode = (
  file: ProjectFile,
  input: { title?: string; carry?: EpisodeCarry },
): NewEpisode => {
  const carry = input.carry ?? defaultEpisodeCarry(file);
  const timestamp = nowIso();
  // The lowest number no episode has claimed, so two scripts never carry
  // the same one (§17).
  const number = nextEpisodeNumber(file);

  let lanes: Lane[] = file.lanes;
  let laneId: LaneId | undefined;

  if (carry.lanes === 'fresh' || file.lanes.length === 0) {
    // A fresh thread for this episode, so its A story is plotted on a row of
    // its own rather than running on with the series'.
    const lane = laneSchema.parse({
      id: newId<LaneId>(),
      projectId: file.project.id,
      name: input.title?.trim() ? `${input.title.trim()} — A story` : `Episode ${number} — A story`,
      kind: 'main_plot',
      color: LANE_COLOURS[(file.lanes.length + 1) % LANE_COLOURS.length],
      orderKey: orderKeyForIndex(file.lanes, file.lanes.length),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    lanes = [...file.lanes, lane];
    laneId = lane.id;
  } else {
    // The series' first lane: the main plot, wherever this week's story runs.
    laneId = [...file.lanes].sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))[0]?.id;
  }
  if (!laneId) throw new Error('A project needs at least one lane before an episode can start');

  const order = unitsInStoryOrder(file);
  const unit = structuralUnitSchema.parse({
    id: newId<StructuralUnitId>(),
    projectId: file.project.id,
    laneId,
    kind: 'scene',
    title: '',
    sequenceLabel: '',
    orderKey: orderKeyForIndex(order, order.length),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const beat = beatSchema.parse({
    id: newId<BeatId>(),
    projectId: file.project.id,
    unitId: unit.id,
    title: '',
    orderKey: orderKeyForIndex([], 0),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const owed = carry.openSetups
    ? file.setupsPayoffs.filter(
        (record) => !record.archived && (record.status === 'open' || record.status === 'established'),
      )
    : [];

  const marker = storyMarkerSchema.parse({
    id: newId<StoryMarkerId>(),
    projectId: file.project.id,
    unitId: unit.id,
    kind: 'episode',
    title: input.title?.trim() ?? '',
    // What is still owed, written down where the episode will be read rather
    // than left in a panel nobody opens while writing.
    notes: owed.length > 0 ? `Still owed:\n${owed.map((record) => `— ${record.title}`).join('\n')}` : '',
    cast: castForNewEpisode(file, carry),
    // Its own front page, started with the one thing that is already known:
    // which episode this is. Everything else falls back to the series' page
    // until the writer says otherwise (spec §6.1).
    titlePage: titlePageSchema.parse({ episode: `Episode ${number}` }),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const next: ProjectFile = {
    ...file,
    lanes,
    units: [...file.units, unit],
    beats: [...file.beats, beat],
    markers: [...file.markers, marker],
    // The choice is remembered: a series carries the same things every week.
    settings: { ...file.settings, episodeCarry: carry },
    project: { ...file.project, updatedAt: timestamp },
  };

  const made = episodes(next).find((episode) => episode.marker.id === marker.id);
  if (!made) throw new Error('The new episode was not placed in the story order');
  return { file: next, episode: made };
};

/**
 * Who is in an episode: the cast its marker carries, in the order the
 * headings put them — main characters before recurring before minor.
 */
export const castOf = (file: ProjectFile, episode: Episode): Character[] => {
  const wanted = new Set(episode.marker.cast.map((id) => id as string));
  return castByCategory(file)
    .flatMap((group) => group.characters)
    .filter((character) => wanted.has(character.id as string));
};

/**
 * The names to offer while a character cue is typed in a beat: the episode's
 * own cast first, in heading order, then everyone else in the project. In a
 * format with no episodes this is simply the cast in heading order, which is
 * the right answer there too.
 */
export const castNamesForBeat = (file: ProjectFile, beatId: string): string[] => {
  const episode = episodeOfBeat(file, beatId);
  const here = episode ? castOf(file, episode).map((character) => character.name) : [];
  const seen = new Set(here.map((name) => name.toUpperCase()));
  const rest = castInCueOrder(file).filter((name) => !seen.has(name.toUpperCase()));
  return [...here, ...rest];
};

/** Add someone to an episode's cast, or take them out of it. */
export const setEpisodeCast = (
  file: ProjectFile,
  markerId: StoryMarkerId,
  cast: readonly CharacterId[],
): ProjectFile => ({
  ...file,
  markers: file.markers.map((marker) =>
    marker.id === markerId ? { ...marker, cast: [...cast], updatedAt: nowIso() } : marker,
  ),
});

/** The scenes of an episode, so a view can show one episode at a time. */
export const beatsOfEpisode = (file: ProjectFile, episode: Episode): Beat[] =>
  episode.units.flatMap((unit) => beatsForUnit(file, unit.id));

/**
 * The front page each episode opens with (addendum 02 §17).
 *
 * An episode is a script that goes out on its own, so it prints with its own
 * title page at the head of its run — not with the series' page once at the
 * front of the stack. Each is the episode's own answers over the series',
 * field by field, so an episode that names only its number and its date still
 * carries the series' title, credit and contact.
 *
 * A marker with no page of its own is not given one: an act has no front page
 * (§11), and neither has an episode the writer has handed back to the series.
 */
export interface EpisodeFrontPage {
  episode: Episode;
  /** The page as it will print, the series' answers filled in. */
  page: TitlePage;
}

export const episodeTitlePages = (
  file: ProjectFile,
  options: { includeTitlePage?: boolean } = {},
): EpisodeFrontPage[] => {
  // One switch covers every front page in the document: a writer who does not
  // want a title page does not want eleven of them.
  if (options.includeTitlePage === false) return [];
  return episodes(file)
    .filter((episode) => episode.marker.titlePage !== null)
    .map((episode) => ({
      episode,
      page: titlePageOf(file.project, file.settings, episode.marker.titlePage),
    }));
};

/**
 * The contents page a season is bound with (addendum 02 §17).
 *
 * A series printing is a stack of scripts, and a stack wants a list at the
 * front of it saying what is in the stack. It carries the series' title —
 * so it stands as the front of the document without a cover of its own in
 * front of it — and one line for each episode.
 *
 * **Not a page reference.** Each episode numbers from its own page one, so
 * "turn to page 34" would name three pages at once. What a reader of a stack
 * actually wants is which episode is which and how long each one runs, so
 * that is what the line says.
 */
export interface ContentsEntry {
  /** "EPISODE 2", in whatever scheme the project numbers by. */
  label: string;
  /** What the writer named it. May be empty; the label never is. */
  title: string;
  /** How long that script runs, in pages. */
  pages: number;
}

export interface ContentsPage {
  /** The series' title, at the head of the page. */
  title: string;
  entries: ContentsEntry[];
}

/**
 * Whether this printing carries a contents page.
 *
 * Only a series has one, only where there is more than one episode to list —
 * a contents page naming a single script is a page of paper saying nothing —
 * and only where the printing asked for it.
 */
export const hasContentsPage = (file: ProjectFile, options: { includeContentsPage?: boolean } = {}): boolean =>
  options.includeContentsPage !== false && file.project.format === 'series' && episodes(file).length > 1;
