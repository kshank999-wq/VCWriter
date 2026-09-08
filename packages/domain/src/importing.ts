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
 * Who is in it and where it happens, counted from the elements themselves.
 *
 * Nothing is asked of the writer here: a script that has been read already
 * says who speaks and where, and making them retype it would be absurd.
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
  // Most spoken first: the order a cast list is written in, and the order
  // that decides who is a main character.
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
