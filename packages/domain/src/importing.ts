import type { ManuscriptElementType } from './entities/manuscript.js';

/**
 * What comes back from reading somebody else's script (addendum 02 §18).
 *
 * Two readers produce this — Final Draft's `.fdx`, and the laid-out lines of
 * a PDF — and one builder turns it into a project. Keeping the shape between
 * them means the awkward half (deciding what a line *is*) is the only part
 * that differs, and everything after it — the scenes, the cast, the
 * locations, the beats — is written once.
 *
 * The shape is deliberately flat and honest. It carries what was read, what
 * was **guessed**, and what could not be read at all, because an import that
 * quietly drops a page is worse than one that says it could not manage it.
 */

export interface ImportedElement {
  type: ManuscriptElementType;
  text: string;
  /** Printed beside the speech above it (spec §7.1). */
  dual?: boolean;
  /** Whether this line's type was read from the file or worked out from its shape. */
  guessed?: boolean;
}

export interface ImportedScene {
  /** The slugline, as written. Empty for anything ahead of the first one. */
  heading: string;
  elements: ImportedElement[];
}

export interface ImportedCharacter {
  name: string;
  /** How many speeches they have: what decides main from minor. */
  speeches: number;
  scenes: number;
  /**
   * Fuller names the action introduced them by — *MARA OKONJO* for the cue
   * MARA, *DET. SGT. ANNE PARRISH* for PARRISH.
   *
   * Kept as aliases rather than as the name, because the name a cast list is
   * filed under has to be the one the manuscript cues with, or cue completion
   * and read-back stop finding them.
   */
  aliases?: string[];
}

export interface ImportedLocation {
  /** "SANCHEZ HOME - KITCHEN", without the INT./EXT. or the time of day. */
  name: string;
  scenes: number;
  /** `interior`, `exterior`, or both when the location is used each way. */
  where: 'interior' | 'exterior' | 'both' | 'unknown';
}

export interface ImportedScript {
  title: string;
  author: string;
  scenes: ImportedScene[];
  characters: ImportedCharacter[];
  locations: ImportedLocation[];
  /** What the reader could not do confidently. Shown before anything is made. */
  warnings: string[];
  /** Which reader produced this, for the note left on the project. */
  source: 'fdx' | 'pdf' | 'text';
}

/** Elements in reading order, across every scene. */
export const importedElements = (script: ImportedScript): ImportedElement[] =>
  script.scenes.flatMap((scene) =>
    scene.heading.length > 0
      ? [{ type: 'scene_heading' as ManuscriptElementType, text: scene.heading }, ...scene.elements]
      : scene.elements,
  );

/** The cue without its extension: "MAEVE (O.S.)" is MAEVE, and always was. */
export const bareCue = (cue: string): string =>
  cue
    .replace(/\s*\((?:[^)]*)\)\s*$/, '')
    .replace(/\s*\^\s*$/, '')
    .trim()
    .toUpperCase();

const SLUG = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?|EST\.?)\s*[-—.\s]*(.*)$/i;

/**
 * The place a slugline is set in, and whether it is inside or out.
 *
 * "INT. SANCHEZ HOME - KITCHEN - MORNING" is the Sanchez home's kitchen, in
 * the morning, indoors. The time of day is dropped — it is a property of the
 * scene, not of the place, and a location list that holds MORNING and NIGHT
 * as separate places is no use to anybody scheduling a shoot.
 */
const TIMES = [
  'DAY',
  'NIGHT',
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'DAWN',
  'DUSK',
  'LATER',
  'CONTINUOUS',
  'MOMENTS LATER',
  'SAME',
  'SUNSET',
  'SUNRISE',
  'MIDNIGHT',
];

export const readSlugline = (heading: string): { name: string; where: ImportedLocation['where'] } => {
  const text = heading.trim().replace(/\s+/g, ' ');
  const match = SLUG.exec(text);
  if (!match) return { name: text.toUpperCase(), where: 'unknown' };

  const prefix = (match[1] ?? '').toUpperCase();
  const where: ImportedLocation['where'] = /^(INT\.?\/EXT|EXT\.?\/INT|I\/E)/.test(prefix)
    ? 'both'
    : prefix.startsWith('EXT')
      ? 'exterior'
      : 'interior';

  // Drop a trailing time of day, and the scene number some scripts carry.
  const parts = (match[2] ?? '')
    .replace(/\s*#?\d+[A-Z]?\s*$/, '')
    .split(/\s+[-—–]\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  while (parts.length > 1 && TIMES.includes((parts[parts.length - 1] as string).toUpperCase())) parts.pop();

  return { name: parts.join(' - ').toUpperCase(), where };
};

/**
 * Words a script shouts that are not anybody's name.
 *
 * Camera and editing directions, the furniture of the page, and the times of
 * day a slugline ends with. A screenplay capitalises these for the same reason
 * it capitalises a name — to make them findable — so the list has to be said
 * out loud rather than guessed at.
 */
const TECHNICAL = new Set([
  'CUT TO', 'CUT', 'SMASH CUT', 'MATCH CUT', 'HARD CUT', 'TIME CUT', 'JUMP CUT', 'INTERCUT',
  'DISSOLVE', 'DISSOLVE TO', 'FADE', 'FADE IN', 'FADE OUT', 'FADE TO', 'FADE TO BLACK',
  'BACK TO', 'BACK TO SCENE', 'END OF', 'THE END', 'END', 'CONTINUED', 'MORE', 'OMITTED',
  'SUPER', 'TITLE', 'TITLES', 'CARD', 'CHYRON', 'CRAWL', 'INSERT', 'MONTAGE', 'SERIES OF SHOTS',
  'ANGLE', 'ANGLE ON', 'NEW ANGLE', 'REVERSE ANGLE', 'CLOSE', 'CLOSE ON', 'CLOSE UP', 'CLOSEUP',
  'EXTREME CLOSE UP', 'WIDE', 'WIDE SHOT', 'TWO SHOT', 'POV', 'P.O.V.', 'FREEZE FRAME',
  'SLOW MOTION', 'STOCK FOOTAGE', 'SPLIT SCREEN', 'FLASHBACK', 'FLASH FORWARD', 'PRE-LAP',
  'BEAT', 'SFX', 'VFX', 'ADR', 'O.S.', 'V.O.', 'OFF SCREEN', 'VOICE OVER', 'MOS',
  'INT', 'EXT', 'EST', 'INT.', 'EXT.', 'EST.', 'I/E',
  'DAY', 'NIGHT', 'MORNING', 'AFTERNOON', 'EVENING', 'DAWN', 'DUSK', 'LATER', 'CONTINUOUS',
  'MOMENTS LATER', 'SAME', 'SAME TIME', 'SUNSET', 'SUNRISE', 'MIDNIGHT',
]);

/** A run of capitals, as a name would be written. */
const CAPS_RUN = /\b[A-Z][A-Z'’.-]*(?:\s+[A-Z][A-Z'’.-]*)*\b/g;

/**
 * A run of capitals, tidied into the name it might be.
 *
 * The leading article is dropped, and it matters more than it sounds: *A* is a
 * capital letter, so "A SIREN winds up" reads as a two-word run — and a
 * two-word run is one of the things that makes a name believable. Left in, the
 * article promotes every shouted noun in the script to a member of the cast.
 */
const tidyRun = (run: string): string => {
  const words = run
    .replace(/[.,;:!?]+$/, '')
    .replace(/[’']S$/, '')
    .trim()
    .split(/\s+/);
  while (words.length > 0 && (words[0] as string).replace(/[^A-Z]/g, '').length < 2) words.shift();
  return words.join(' ');
};

/** Whether a run of capitals is a technical direction rather than a person. */
const isTechnical = (name: string): boolean => {
  if (TECHNICAL.has(name)) return true;
  // "ANGLE ON MARA", "SUPER: 1984" — the direction is the first word or two,
  // and what follows it is not made a character by being caught up in it.
  const words = name.split(/\s+/);
  return TECHNICAL.has(words[0] as string) || TECHNICAL.has(words.slice(0, 2).join(' '));
};

interface NamedInAction {
  name: string;
  scenes: number;
  /** Introduced between commas — *a guard, HOLLIS, watches* — which is how a
      script says "this is a person" without being asked. */
  appositive: boolean;
}

/**
 * The people a script names in its action (addendum 02 §18).
 *
 * **A cast list read only from the cues is a list of speakers, not a cast.**
 * The convention every screenplay follows is that a character is capitalised
 * where the action first introduces them — and the ones with no lines at all
 * are exactly the ones that convention exists for. Read only from the cues,
 * a silent character is not in the script as far as the project is concerned.
 *
 * What is asked of a run of capitals before it is believed to be a person:
 * it is not a camera direction, and then **one** of — it is a full name of two
 * words or more; it is set off by commas the way a script introduces somebody;
 * or the action names it in more than one scene. A dog that BARKS once fails
 * all three, which is the point.
 *
 * Nothing here is final. Every name is a proposal the writer sees before the
 * project is made, and refiles or removes in a click.
 */
export const namesInAction = (scenes: readonly ImportedScene[]): NamedInAction[] => {
  const found = new Map<string, NamedInAction>();

  for (const scene of scenes) {
    const here = new Set<string>();
    for (const element of scene.elements) {
      if (element.type !== 'action') continue;
      const text = element.text;
      // An action line typed entirely in capitals is shouting at the reader,
      // and carries no signal about which of its words is a name.
      if (text === text.toUpperCase() && /[A-Z]{2}/.test(text)) continue;

      for (const match of text.matchAll(CAPS_RUN)) {
        const raw = match[0];
        const name = tidyRun(raw);
        if (name.replace(/[^A-Z]/g, '').length < 2) continue;
        if (isTechnical(name)) continue;

        const at = match.index ?? 0;
        const before = text.slice(0, at).trimEnd();
        const after = text.slice(at + raw.length).trimStart();
        const appositive = /[,(]$/.test(before) && /^[,)]/.test(after);

        const entry = found.get(name) ?? { name, scenes: 0, appositive: false };
        entry.appositive = entry.appositive || appositive;
        if (!here.has(name)) {
          entry.scenes += 1;
          here.add(name);
        }
        found.set(name, entry);
      }
    }
  }

  return [...found.values()].filter(
    (entry) => entry.appositive || entry.scenes > 1 || entry.name.split(/\s+/).length > 1,
  );
};

/**
 * Which speaker a name in the action belongs to, if any.
 *
 * *MARA OKONJO* is the MARA who speaks, and *DET. SGT. ANNE PARRISH* is
 * PARRISH — a script introduces somebody by their full name and then cues them
 * by one part of it, almost always the last. Matched on a whole word so that
 * ANNE does not swallow ANNETTE.
 */
const speakerFor = (name: string, cues: ReadonlySet<string>): string | null => {
  if (cues.has(name)) return name;
  const words = name.split(/\s+/).filter((word) => word.replace(/[^A-Z]/g, '').length > 1);
  for (let at = words.length - 1; at >= 0; at -= 1) {
    const word = (words[at] as string).replace(/[.,]$/, '');
    if (cues.has(word)) return word;
  }
  return null;
};

/**
 * Who is in it and where it happens, counted from the elements themselves.
 *
 * Nothing is asked of the writer here: a script that has been read already
 * says who speaks and where, and making them retype it would be absurd.
 *
 * Two passes, because a script says who is in it in two ways. The cues say who
 * speaks and how much, which is what decides main from minor. The action says
 * who is *there* — including the people with no lines, who are in the cast of
 * every production and in none of the cues.
 */
export const gatherCast = (scenes: readonly ImportedScene[]): ImportedCharacter[] => {
  const found = new Map<string, ImportedCharacter>();
  for (const scene of scenes) {
    const here = new Set<string>();
    for (const element of scene.elements) {
      if (element.type !== 'character') continue;
      const name = bareCue(element.text);
      if (name.length === 0) continue;
      const entry = found.get(name) ?? { name, speeches: 0, scenes: 0 };
      entry.speeches += 1;
      if (!here.has(name)) {
        entry.scenes += 1;
        here.add(name);
      }
      found.set(name, entry);
    }
  }

  const cues = new Set(found.keys());
  for (const named of namesInAction(scenes)) {
    const speaker = speakerFor(named.name, cues);
    if (speaker) {
      // The same person, introduced in full. The cue stays the name — it is
      // what the manuscript says — and the full name becomes an alias.
      if (speaker === named.name) continue;
      const entry = found.get(speaker);
      if (!entry) continue;
      entry.aliases = [...new Set([...(entry.aliases ?? []), named.name])];
      continue;
    }
    if (found.has(named.name)) continue;
    // Named, and never given a line. A cast list that left them out would be
    // leaving out the people the convention exists for.
    found.set(named.name, { name: named.name, speeches: 0, scenes: named.scenes });
  }

  // Most spoken first: the order a cast list is written in, and the order
  // that decides who is a main character. The silent ones come last, which is
  // where a cast list puts them too.
  return [...found.values()].sort((a, b) => b.speeches - a.speeches || a.name.localeCompare(b.name));
};

export const gatherLocations = (scenes: readonly ImportedScene[]): ImportedLocation[] => {
  const found = new Map<string, ImportedLocation>();
  for (const scene of scenes) {
    if (scene.heading.trim().length === 0) continue;
    const { name, where } = readSlugline(scene.heading);
    if (name.length === 0) continue;
    const entry = found.get(name);
    if (!entry) {
      found.set(name, { name, scenes: 1, where });
      continue;
    }
    entry.scenes += 1;
    // Used indoors and out: the location is both, whatever each slug said.
    if (entry.where !== where && entry.where !== 'unknown' && where !== 'unknown') entry.where = 'both';
  }
  return [...found.values()].sort((a, b) => b.scenes - a.scenes || a.name.localeCompare(b.name));
};

/** Fill in the cast and the locations from the scenes, whatever read them. */
export const summarise = (script: Omit<ImportedScript, 'characters' | 'locations'>): ImportedScript => ({
  ...script,
  characters: gatherCast(script.scenes),
  locations: gatherLocations(script.scenes),
});
