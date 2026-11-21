/**
 * **Edit credits** for the AI deep check (addendum 47).
 *
 * A credit is 1,000 words checked. The balance is kept in **words**, an
 * integer, so a run charged 1,250 words leaves no rounding behind; it is shown
 * as credits (18.75) or as words, whichever reads better.
 *
 * The packs and their prices live here, and only here: the checkout names a
 * pack by its id and the server looks up what it costs and what it gives, so a
 * client that decided its own price has nowhere to put it.
 */

export const EDIT_CREDIT_PACKS = [
  { id: 'pack-5', priceCents: 500, words: 20_000 },
  { id: 'pack-10', priceCents: 1000, words: 50_000 },
  { id: 'pack-20', priceCents: 2000, words: 100_000 },
] as const;

export type EditCreditPack = (typeof EDIT_CREDIT_PACKS)[number];
export type EditCreditPackId = EditCreditPack['id'];
export const EDIT_CREDIT_PACK_IDS = EDIT_CREDIT_PACKS.map((pack) => pack.id) as [EditCreditPackId, ...EditCreditPackId[]];

export const editCreditPack = (id: string): EditCreditPack | null => EDIT_CREDIT_PACKS.find((pack) => pack.id === id) ?? null;

export const WORDS_PER_CREDIT = 1000;
/** Every run carries the same instructions, so none is charged less than this. */
export const MINIMUM_CHARGE_WORDS = 1000;
/** Runs are charged in steps of this many words. */
export const CHARGE_STEP_WORDS = 250;
/** The most one run may read: about a long chapter. Longer scopes are split. */
export const MAX_RUN_WORDS = 6000;

export const wordsOfText = (text: string): number => text.match(/\S+/g)?.length ?? 0;

/** What one run of `words` words is charged, in words. */
export const chargeForRun = (words: number): number =>
  Math.max(MINIMUM_CHARGE_WORDS, Math.ceil(Math.max(0, words) / CHARGE_STEP_WORDS) * CHARGE_STEP_WORDS);

/** Words as credits, for showing: 18,750 → "18.75". */
export const creditsLabel = (words: number): string => {
  const credits = words / WORDS_PER_CREDIT;
  return Number.isInteger(credits) ? String(credits) : credits.toFixed(2).replace(/0$/, '');
};

/** Dollars a pack charges per 1,000 words, for the pack list. */
export const pricePerThousand = (pack: EditCreditPack): number => pack.priceCents / 100 / (pack.words / WORDS_PER_CREDIT);

/** A rough guide for the pack list: what a pack covers. */
export const EDIT_CREDIT_GUIDE = [
  { label: 'A chapter (4,000 words)', words: 4000 },
  { label: 'A feature screenplay (25,000 words)', words: 25_000 },
  { label: 'A novel (90,000 words)', words: 90_000 },
] as const;

export interface RunLine {
  id: string;
  type?: string;
  text: string;
  /** The beat (scene) it belongs to; a run never splits a scene it can hold whole. */
  beatId: string;
}

/**
 * **Splits a scope into runs.** A scene is read whole where it fits, so the
 * check sees what it is judging; a scene longer than `MAX_RUN_WORDS` is split
 * at paragraph boundaries. Short scenes next to each other share a run until
 * it reaches the minimum charge, so a script of two-line scenes is not charged
 * a thousand words a scene. A shared run marks where each new scene starts.
 */
export const splitIntoRuns = (lines: RunLine[], max = MAX_RUN_WORDS): RunLine[][] => {
  const scenes: RunLine[][] = [];
  for (const line of lines) {
    const last = scenes[scenes.length - 1];
    if (last && last[0]!.beatId === line.beatId) last.push(line);
    else scenes.push([line]);
  }
  const wordsOf = (run: RunLine[]) => run.reduce((sum, line) => sum + wordsOfText(line.text), 0);
  const runs: RunLine[][] = [];
  for (const scene of scenes) {
    const pieces: RunLine[][] = [];
    let piece: RunLine[] = [];
    let count = 0;
    for (const line of scene) {
      const words = wordsOfText(line.text);
      if (piece.length && count + words > max) {
        pieces.push(piece);
        piece = [];
        count = 0;
      }
      piece.push(line);
      count += words;
    }
    if (piece.length) pieces.push(piece);
    for (const one of pieces) {
      const last = runs[runs.length - 1];
      if (last && wordsOf(last) < MINIMUM_CHARGE_WORDS && wordsOf(last) + wordsOf(one) <= max) {
        last.push({ id: '', type: 'scene_break', text: '(new scene)', beatId: one[0]!.beatId }, ...one);
      } else runs.push([...one]);
    }
  }
  return runs;
};

export interface RunEstimate {
  runs: number;
  words: number;
  /** What the runs will be charged, in words. */
  charge: number;
}

export const estimateRuns = (runs: RunLine[][]): RunEstimate => {
  let words = 0;
  let charge = 0;
  for (const run of runs) {
    const count = run.reduce((sum, line) => sum + (line.id ? wordsOfText(line.text) : 0), 0);
    words += count;
    charge += chargeForRun(count);
  }
  return { runs: runs.length, words, charge };
};

// --------------------------------------------------------------- what crosses the wire

/** What the app sends for one AI check run: the lines and the writer's settings, nothing else. */
export interface DeepCheckInput {
  format: 'prose' | 'screenplay';
  pointOfView?: string;
  tense?: 'past' | 'present' | 'unspecified';
  viewpoint?: string[];
  lines: { id: string; type?: string; text: string }[];
}

/** One finding as the server returns it: words on a line and what is off. No replacement text. */
export interface DeepCheckFinding {
  elementId: string;
  quote: string;
  start: number;
  end: number;
  check: 'pov' | 'pronoun' | 'continuity' | 'telling' | 'dialogue' | 'pacing' | 'setup';
  severity: 'concern' | 'note';
  confidence: 'high' | 'medium' | 'low';
  message: string;
  why: string;
}

export interface DeepCheckAnswer {
  findings: DeepCheckFinding[];
  words: number;
  charged: number;
  balance: number;
}

export interface EditCreditStanding {
  signedIn: boolean;
  configured: boolean;
  /** In words. */
  balance: number;
}
