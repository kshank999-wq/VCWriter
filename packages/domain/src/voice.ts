import { speechSegmentsForProject, speechSegmentsForUnit, type SpeechSegment } from './render.js';
import type { VoiceAssignment } from './entities/project.js';
import type { ProjectFile } from './project-file.js';
import type { CharacterId, StructuralUnitId } from './ids.js';

/**
 * Read-back voices (spec §10).
 *
 * §10 asks for a curated set spanning younger and older male and female
 * voices, with accents such as British where the provider offers them, and for
 * the vendor to be replaceable without touching manuscript data (§18).
 *
 * The default provider is the operating system's own speech synthesis: it is
 * free, offline, and already ships the range §10 describes. What the platform
 * does *not* tell us is a voice's gender or age, so rather than guess from a
 * name at runtime, known voices are described in a table here and everything
 * else is reported as unknown. A wrong label on a voice picker is worse than
 * an honest blank.
 */

export type VoiceGender = 'male' | 'female' | 'neutral' | 'unknown';
export type VoiceAge = 'younger' | 'older' | 'unknown';

export interface VoiceDescriptor {
  /** Provider-specific id; opaque, stored on the character. */
  id: string;
  name: string;
  providerId: string;
  /** BCP-47 tag as the provider reports it, e.g. "en-GB". */
  lang: string;
  gender: VoiceGender;
  age: VoiceAge;
  /** Human-readable accent derived from `lang`, e.g. "British". */
  accent: string | null;
}

/**
 * Common system voices on Windows and macOS. Only what the platforms actually
 * ship widely — anything absent is described as unknown rather than guessed.
 */
const KNOWN_VOICES: Record<string, { gender: VoiceGender; age: VoiceAge }> = {
  // macOS
  alex: { gender: 'male', age: 'older' },
  daniel: { gender: 'male', age: 'older' },
  fred: { gender: 'male', age: 'older' },
  tom: { gender: 'male', age: 'younger' },
  samantha: { gender: 'female', age: 'younger' },
  victoria: { gender: 'female', age: 'older' },
  karen: { gender: 'female', age: 'older' },
  moira: { gender: 'female', age: 'older' },
  tessa: { gender: 'female', age: 'older' },
  serena: { gender: 'female', age: 'younger' },
  allison: { gender: 'female', age: 'younger' },
  ava: { gender: 'female', age: 'younger' },
  nathan: { gender: 'male', age: 'younger' },
  // Windows
  david: { gender: 'male', age: 'older' },
  mark: { gender: 'male', age: 'younger' },
  george: { gender: 'male', age: 'older' },
  ryan: { gender: 'male', age: 'younger' },
  zira: { gender: 'female', age: 'younger' },
  hazel: { gender: 'female', age: 'older' },
  susan: { gender: 'female', age: 'older' },
  sonia: { gender: 'female', age: 'younger' },
  libby: { gender: 'female', age: 'younger' },
};

const ACCENTS: Record<string, string> = {
  'en-gb': 'British',
  'en-us': 'American',
  'en-au': 'Australian',
  'en-ie': 'Irish',
  'en-in': 'Indian',
  'en-za': 'South African',
  'en-nz': 'New Zealand',
  'en-ca': 'Canadian',
  'en-sc': 'Scottish',
};

export const accentFor = (lang: string): string | null => ACCENTS[lang.toLowerCase()] ?? null;

/** Describe a voice the provider reported, using the table where it applies. */
export const describeVoice = (input: {
  id: string;
  name: string;
  lang: string;
  providerId?: string;
}): VoiceDescriptor => {
  // Platform names arrive in many shapes: "Daniel", "Microsoft Hazel Desktop",
  // "Google UK English Female". Match on any word that names a known voice.
  const words = input.name.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 0);
  const known = words.map((word) => KNOWN_VOICES[word]).find((entry) => entry !== undefined);

  // Some providers put the gender in the name instead of shipping metadata.
  const spelledOut: VoiceGender = words.includes('female')
    ? 'female'
    : words.includes('male')
      ? 'male'
      : 'unknown';

  return {
    id: input.id,
    name: input.name,
    providerId: input.providerId ?? 'system',
    lang: input.lang,
    gender: known?.gender ?? spelledOut,
    age: known?.age ?? 'unknown',
    accent: accentFor(input.lang),
  };
};

/** A voice picker reads better grouped: described voices first, then the rest. */
export const sortVoices = (voices: readonly VoiceDescriptor[]): VoiceDescriptor[] =>
  [...voices].sort((a, b) => {
    const known = (voice: VoiceDescriptor) => (voice.gender === 'unknown' ? 1 : 0);
    if (known(a) !== known(b)) return known(a) - known(b);
    if (a.lang !== b.lang) return a.lang.localeCompare(b.lang);
    return a.name.localeCompare(b.name);
  });

export const toAssignment = (voice: VoiceDescriptor, overrides: Partial<VoiceAssignment> = {}): VoiceAssignment => ({
  providerId: voice.providerId,
  voiceId: voice.id,
  displayName: voice.name,
  accent: voice.accent,
  rate: 1,
  pitch: 0,
  ...overrides,
});

/**
 * Propose a distinct voice for every character that has none, so a writer gets
 * a cast that sounds like different people in one click rather than assigning
 * a dozen voices by hand. Voices already in use are not reused until the
 * catalogue runs out.
 */
export const suggestVoiceAssignments = (
  file: ProjectFile,
  catalogue: readonly VoiceDescriptor[],
): Record<string, VoiceAssignment> => {
  if (catalogue.length === 0) return {};

  const taken = new Set(
    file.characters.map((character) => character.voice?.voiceId).filter((id): id is string => Boolean(id)),
  );
  // Voices we can describe make a better first pass than anonymous ones.
  const pool = sortVoices(catalogue);
  const suggestions: Record<string, VoiceAssignment> = {};

  let cursor = 0;
  const nextVoice = (): VoiceDescriptor => {
    for (let attempts = 0; attempts < pool.length; attempts += 1) {
      const candidate = pool[cursor % pool.length] as VoiceDescriptor;
      cursor += 1;
      if (!taken.has(candidate.id)) {
        taken.add(candidate.id);
        return candidate;
      }
    }
    // Everything is spoken for; start sharing rather than leaving cast silent.
    const fallback = pool[cursor % pool.length] as VoiceDescriptor;
    cursor += 1;
    return fallback;
  };

  for (const character of file.characters) {
    if (character.voice || character.archived) continue;
    suggestions[character.id] = toAssignment(nextVoice());
  }

  return suggestions;
};

export interface PlaybackStep extends SpeechSegment {
  index: number;
  /** Resolved from the character, or the project narrator, or the default. */
  voice: VoiceAssignment | null;
  /** Who is speaking, for the "now playing" line. */
  speaker: string | null;
}

export interface PlaybackPlan {
  steps: PlaybackStep[];
  /** Characters in this stretch that still have no voice assigned. */
  unassigned: string[];
}

/**
 * Turn a scene or a whole project into an ordered list of things to say and
 * the voice to say them in. The player walks this list; it does not re-derive
 * anything from the manuscript.
 */
export const playbackPlan = (
  file: ProjectFile,
  scope: { unitId?: StructuralUnitId } = {},
): PlaybackPlan => {
  const segments = scope.unitId ? speechSegmentsForUnit(file, scope.unitId) : speechSegmentsForProject(file);
  const nameFor = (characterId: CharacterId | null): string | null =>
    characterId ? file.characters.find((character) => character.id === characterId)?.name ?? null : null;

  const unassigned = new Set<string>();
  const steps = segments.map((segment, index) => {
    const speaker = nameFor(segment.characterId);
    const voice = segment.voice ?? (segment.kind === 'narration' ? file.settings.narratorVoice : null);
    if (segment.kind === 'dialogue' && !voice && speaker) unassigned.add(speaker);
    return { ...segment, index, voice, speaker };
  });

  return { steps, unassigned: [...unassigned] };
};

/** Rough spoken duration, for a "this scene reads in about N minutes" line. */
export const estimatedSpokenSeconds = (plan: PlaybackPlan, wordsPerMinute = 150): number => {
  const words = plan.steps.reduce((total, step) => total + (step.text.match(/[^\s]+/g)?.length ?? 0), 0);
  return Math.round((words / wordsPerMinute) * 60);
};
