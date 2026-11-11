import type { VoiceDescriptor } from './voice.js';
import type { ProjectFile } from './project-file.js';
import type { VoiceAssignment } from './entities/project.js';

/**
 * Natural voices for read-back (spec §10; addendum 45).
 *
 * From Ken: *the ones we're using now sound like robots*. The operating
 * system's voices are Windows' David and Zira and whatever a Mac happens to
 * have downloaded; these come from Kokoro, an open speech model (Apache 2.0)
 * that runs on the writer's own computer. It is downloaded once, on request,
 * then works offline, costs nothing per line, and sends no manuscript
 * anywhere.
 *
 * This file holds what is pure: the catalogue, and the text preparation that
 * turns a line of script into the model's input. Turning words into sounds
 * (phonemes) and running the model happen in the desktop app's main process.
 * The normalisation and the phoneme fixes are ported from kokoro-js
 * (Apache 2.0), which ported them from the model's own reference code.
 */

/** The provider id stored on a voice assignment for these voices. */
export const NATURAL_PROVIDER = 'natural';

/** The model, and where its files are fetched from on request. */
export const NATURAL_MODEL = {
  id: 'kokoro-82m-v1.0',
  repository: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main',
  /** The 8-bit model: about 92 MB, and close to the full one by ear. */
  modelFile: 'onnx/model_quantized.onnx',
  tokenizerFile: 'tokenizer.json',
  sampleRate: 24000,
} as const;

export interface NaturalVoice {
  /** Kokoro's id: the first letter is the accent (a American, b British), the second the gender. */
  id: string;
  name: string;
  lang: 'en-US' | 'en-GB';
  gender: 'male' | 'female';
  /** The model card's grade, best first. Only C and better are offered. */
  grade: string;
}

/**
 * The voices offered, best first within each group. Kokoro ships more, but
 * its own grades put the rest at D or below: a voice that sounds broken is
 * worse than a shorter list.
 */
export const NATURAL_VOICES: readonly NaturalVoice[] = [
  { id: 'af_heart', name: 'Heart', lang: 'en-US', gender: 'female', grade: 'A' },
  { id: 'af_bella', name: 'Bella', lang: 'en-US', gender: 'female', grade: 'A-' },
  { id: 'af_nicole', name: 'Nicole', lang: 'en-US', gender: 'female', grade: 'B-' },
  { id: 'af_aoede', name: 'Aoede', lang: 'en-US', gender: 'female', grade: 'C+' },
  { id: 'af_kore', name: 'Kore', lang: 'en-US', gender: 'female', grade: 'C+' },
  { id: 'af_sarah', name: 'Sarah', lang: 'en-US', gender: 'female', grade: 'C+' },
  { id: 'af_nova', name: 'Nova', lang: 'en-US', gender: 'female', grade: 'C' },
  { id: 'am_michael', name: 'Michael', lang: 'en-US', gender: 'male', grade: 'C+' },
  { id: 'am_fenrir', name: 'Fenrir', lang: 'en-US', gender: 'male', grade: 'C+' },
  { id: 'am_puck', name: 'Puck', lang: 'en-US', gender: 'male', grade: 'C+' },
  { id: 'bf_emma', name: 'Emma', lang: 'en-GB', gender: 'female', grade: 'B-' },
  { id: 'bf_isabella', name: 'Isabella', lang: 'en-GB', gender: 'female', grade: 'C' },
  { id: 'bm_george', name: 'George', lang: 'en-GB', gender: 'male', grade: 'C' },
  { id: 'bm_fable', name: 'Fable', lang: 'en-GB', gender: 'male', grade: 'C' },
];

export const naturalVoiceById = (id: string): NaturalVoice | undefined => NATURAL_VOICES.find((voice) => voice.id === id);

/**
 * The narrator where nothing is chosen and natural voices are installed:
 * George, a British male, after Ken's choice of Daniel among the system
 * voices.
 */
export const DEFAULT_NATURAL_VOICE = 'bm_george';

/** The natural voices as the voice pickers list them. */
export const naturalVoiceDescriptors = (): VoiceDescriptor[] =>
  NATURAL_VOICES.map((voice) => ({
    id: voice.id,
    name: `${voice.name} (natural)`,
    providerId: NATURAL_PROVIDER,
    lang: voice.lang,
    gender: voice.gender,
    age: 'unknown',
    accent: voice.lang === 'en-GB' ? 'British' : 'American',
  }));

/** The files an install fetches: the model, its symbol table, and one style file per voice. */
export const naturalModelFiles = (): string[] => [
  NATURAL_MODEL.modelFile,
  NATURAL_MODEL.tokenizerFile,
  ...NATURAL_VOICES.map((voice) => `voices/${voice.id}.bin`),
];

// ------------------------------------------------------------- text in

const spokenYear = (match: string): string => {
  if (match.includes('.')) return match;
  if (match.includes(':')) {
    const [hours, minutes] = match.split(':').map(Number) as [number, number];
    if (minutes === 0) return `${hours} o'clock`;
    if (minutes < 10) return `${hours} oh ${minutes}`;
    return `${hours} ${minutes}`;
  }
  const year = parseInt(match.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return match;
  const left = match.slice(0, 2);
  const right = parseInt(match.slice(2, 4), 10);
  const plural = match.endsWith('s') ? 's' : '';
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (right === 0) return `${left} hundred${plural}`;
    if (right < 10) return `${left} oh ${right}${plural}`;
  }
  return `${left} ${right}${plural}`;
};

const spokenMoney = (match: string): string => {
  const unit = match[0] === '$' ? 'dollar' : 'pound';
  const amount = match.slice(1);
  if (Number.isNaN(Number(amount))) return `${amount} ${unit}s`;
  if (!amount.includes('.')) return `${amount} ${unit}${amount === '1' ? '' : 's'}`;
  const [whole = '', fraction = ''] = amount.split('.');
  const pennies = parseInt(fraction.padEnd(2, '0'), 10);
  const small = match[0] === '$' ? (pennies === 1 ? 'cent' : 'cents') : pennies === 1 ? 'penny' : 'pence';
  return `${whole} ${unit}${whole === '1' ? '' : 's'} and ${pennies} ${small}`;
};

const spokenDecimal = (match: string): string => {
  const [whole = '', fraction = ''] = match.split('.');
  return `${whole} point ${fraction.split('').join(' ')}`;
};

/**
 * A line of script as the model should hear it: curly quotes straightened,
 * titles spelled out, years, times, money and decimals in words.
 */
export const normalizeForSpeech = (text: string): string =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/«/g, '“')
    .replace(/»/g, '”')
    .replace(/[“”]/g, '"')
    .replace(/\(/g, '«')
    .replace(/\)/g, '»')
    .replace(/[^\S \n]/g, ' ')
    .replace(/  +/g, ' ')
    .replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor')
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, 'Mister')
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, 'Miss')
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, 'Mrs')
    .replace(/\betc\.(?! [A-Z])/gi, 'etc')
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, spokenYear)
    .replace(/(?<=\d),(?=\d)/g, '')
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, spokenMoney)
    .replace(/\d*\.\d+/g, spokenDecimal)
    .replace(/(?<=\d)-(?=\d)/g, ' to ')
    .replace(/(?<=\d)S/g, ' S')
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, 's')
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (match) => match.replace(/\./g, '-'))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, '-')
    .trim();

const PUNCTUATION = ';:,.!?¡¿—…"«»“”(){}[]';
const PUNCTUATION_RUN = new RegExp(`(\\s*[${PUNCTUATION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+\\s*)+`, 'g');

/**
 * The line in pieces: words to turn into phonemes, and punctuation, which the
 * model reads directly (it is how it knows where to pause and when a line is
 * a question).
 */
export const splitForPhonemes = (text: string): Array<{ punctuation: boolean; text: string }> => {
  const pieces: Array<{ punctuation: boolean; text: string }> = [];
  let at = 0;
  for (const match of text.matchAll(PUNCTUATION_RUN)) {
    const index = match.index ?? 0;
    if (at < index) pieces.push({ punctuation: false, text: text.slice(at, index) });
    if (match[0].length > 0) pieces.push({ punctuation: true, text: match[0] });
    at = index + match[0].length;
  }
  if (at < text.length) pieces.push({ punctuation: false, text: text.slice(at) });
  return pieces;
};

/** Which accent of the phoneme set to use for a voice: American or British. */
export const phonemeLanguage = (voiceId: string): 'en-us' | 'en' => (voiceId.startsWith('b') ? 'en' : 'en-us');

/** The corrections the model's reference code makes to the phonemes before reading them. */
export const fixPhonemes = (phonemes: string, voiceId: string): string => {
  let fixed = phonemes
    .replace(/kəkˈoːɹoʊ/g, 'kˈoʊkəɹoʊ')
    .replace(/kəkˈɔːɹəʊ/g, 'kˈəʊkəɹəʊ')
    .replace(/ʲ/g, 'j')
    .replace(/r/g, 'ɹ')
    .replace(/x/g, 'k')
    .replace(/ɬ/g, 'l')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ')
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z');
  if (!voiceId.startsWith('b')) fixed = fixed.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
  return fixed.trim();
};

/** The model reads at most this many symbols at once, its start and end markers included. */
export const NATURAL_MAX_TOKENS = 512;

/**
 * Phonemes to the model's symbol numbers: one per character, anything it has
 * no symbol for dropped, and the start-and-end marker (0) either side.
 */
export const tokenizePhonemes = (phonemes: string, vocab: Readonly<Record<string, number>>): number[] => {
  const ids: number[] = [];
  for (const character of phonemes) {
    const id = vocab[character];
    if (id !== undefined) ids.push(id);
  }
  return [0, ...ids.slice(0, NATURAL_MAX_TOKENS - 2), 0];
};

/**
 * Where in a voice's style file to read for a line this long: each voice
 * holds one 256-number style per length, so a short line and a long one are
 * each read in the voice's manner for that length.
 */
export const styleOffset = (tokenCount: number): number => 256 * Math.min(Math.max(tokenCount - 2, 0), 509);

/**
 * Long passages are read a sentence or two at a time, so the first words are
 * heard quickly and nothing passes the model's limit. Splits after a full
 * stop, question or exclamation mark followed by a space, keeping pieces
 * under `limit` characters where the text allows.
 */
export const splitForSynthesis = (text: string, limit = 300): string[] => {
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+["'”’»)]*|$)\s*/g)?.map((one) => one.trim()).filter(Boolean) ?? [];
  if (sentences.length === 0) return text.trim() ? [text.trim()] : [];
  const pieces: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + 1 + sentence.length > limit) {
      pieces.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) pieces.push(current);
  return pieces;
};

/**
 * The word being spoken, for the highlight. The model gives no word timings,
 * so the word is found by how far through the line's sound playback is,
 * weighting each word by its length: close enough to follow along by, which
 * is what the highlight is for.
 */
export const wordAtFraction = (text: string, fraction: number): { from: number; to: number } | null => {
  const words = [...text.matchAll(/\S+/g)].map((match) => ({ from: match.index ?? 0, to: (match.index ?? 0) + match[0].length }));
  if (words.length === 0) return null;
  const total = words.reduce((sum, word) => sum + (word.to - word.from) + 1, 0);
  let point = Math.min(Math.max(fraction, 0), 0.9999) * total;
  for (const word of words) {
    const weight = word.to - word.from + 1;
    if (point < weight) return word;
    point -= weight;
  }
  return words[words.length - 1] ?? null;
};

// ------------------------------------------------- natural voices everywhere

/**
 * The natural voice to read in for an assignment (addendum 45 §8): its own
 * where it is a natural voice, and otherwise the default. From Ken,
 * 11 November: *put Kokoro in every module and take out the computer's
 * voices* — a voice chosen among the computer's own before then is read by
 * the default natural voice rather than not at all.
 */
export const naturalVoiceFor = (
  assignment: Pick<VoiceAssignment, 'providerId' | 'voiceId'> | null | undefined,
  fallback: string = DEFAULT_NATURAL_VOICE,
): string =>
  assignment && assignment.providerId === NATURAL_PROVIDER && naturalVoiceById(assignment.voiceId) ? assignment.voiceId : fallback;

/**
 * The project as read-back sees it: voices that are not natural voices left
 * unchosen, so the narrator default reads them, *Suggest a cast* fills them,
 * and the pickers show them as not yet chosen. The project itself is not
 * changed until the writer picks a voice.
 */
export const withNaturalVoicesOnly = (file: ProjectFile): ProjectFile => {
  const keep = (voice: VoiceAssignment | null | undefined): VoiceAssignment | null =>
    voice && voice.providerId === NATURAL_PROVIDER ? voice : null;
  const narrator = keep(file.settings.narratorVoice);
  const foreign =
    narrator !== (file.settings.narratorVoice ?? null) || file.characters.some((one) => one.voice && keep(one.voice) === null);
  if (!foreign) return file;
  return {
    ...file,
    settings: { ...file.settings, narratorVoice: narrator },
    characters: file.characters.map((one) => (one.voice && keep(one.voice) === null ? { ...one, voice: null } : one)),
  };
};
