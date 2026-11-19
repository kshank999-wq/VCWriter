import { isProseFormat } from './formats.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { updateBeat } from './mutations.js';
import { nowIso } from './entities/common.js';
import {
  checkLine,
  isNarrowFix,
  type EditCategory,
  type EditConfidence,
  type EditSeverity,
  type NarrativeTense,
  type PointOfView,
  type RuleHit,
} from './edit-rules.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, StructuralUnitId } from './ids.js';

/**
 * **The Edit Check** (VC Writer Editor Refinement spec v1.0, from Ken, 19
 * November: *we want to have a limited editor. We're not trying to help
 * people write their books. I'm very against cheating. But we do want help in
 * all the basic editing with point of view, grammar*).
 *
 * The writer runs a check at the end of a session; it makes a **review** —
 * findings, each anchored to a line of the manuscript by the line's id and
 * offsets, with the words it was about — and changes nothing (§6). Each
 * finding is then Fixed (a narrow mechanical fix, by the writer's click),
 * Dismissed, Marked intentional or Deferred, or left open. Those decisions
 * outlive a re-check: a finding is known again by its rule, its line and its
 * words, so a dismissed one stays dismissed **until the words change** (§10.8).
 *
 * The review is kept in the project's settings, beside the manuscript and
 * never in it (§8). Every manuscript change made here is `applyFix`, which
 * changes only the span a mechanical finding names, only to its short fix,
 * and only if the words there are still the ones it found.
 */

// --------------------------------------------------------------- the profile

export interface EditorProfile {
  /** Which rules: a prose book's or a script's. `auto` follows the format. */
  mode: 'auto' | 'prose' | 'screenplay';
  pov: PointOfView;
  tense: NarrativeTense;
  /** The viewpoint characters' names, for third person limited. */
  viewpoint: string[];
  /** Words the Edit Check takes as right in this project. */
  dictionary: string[];
  /** A section's or beat's own point of view, tense or viewpoint (§3.2). */
  overrides: Record<string, { pov?: PointOfView; tense?: NarrativeTense; viewpoint?: string[] }>;
}

const POVS: PointOfView[] = ['first_singular', 'first_plural', 'second', 'third_limited', 'third_rotating', 'third_omniscient', 'third_objective', 'unspecified'];
const TENSES: NarrativeTense[] = ['past', 'present', 'unspecified'];

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : []);

export const editorProfileOf = (file: ProjectFile): EditorProfile => {
  const raw = (file.settings.editor ?? {}) as Record<string, unknown>;
  const overrides: EditorProfile['overrides'] = {};
  for (const [key, value] of Object.entries((raw['overrides'] as Record<string, Record<string, unknown>>) ?? {})) {
    if (!value || typeof value !== 'object') continue;
    overrides[key] = {
      ...(POVS.includes(value['pov'] as PointOfView) ? { pov: value['pov'] as PointOfView } : {}),
      ...(TENSES.includes(value['tense'] as NarrativeTense) ? { tense: value['tense'] as NarrativeTense } : {}),
      ...(Array.isArray(value['viewpoint']) ? { viewpoint: strings(value['viewpoint']) } : {}),
    };
  }
  return {
    mode: raw['mode'] === 'prose' || raw['mode'] === 'screenplay' ? raw['mode'] : 'auto',
    pov: POVS.includes(raw['pov'] as PointOfView) ? (raw['pov'] as PointOfView) : 'unspecified',
    tense: TENSES.includes(raw['tense'] as NarrativeTense) ? (raw['tense'] as NarrativeTense) : 'unspecified',
    viewpoint: strings(raw['viewpoint']),
    dictionary: strings(raw['dictionary']),
    overrides,
  };
};

export const setEditorProfile = (file: ProjectFile, patch: Partial<EditorProfile>): ProjectFile => ({
  ...file,
  settings: { ...file.settings, editor: { ...editorProfileOf(file), ...patch } },
  project: { ...file.project, updatedAt: nowIso() },
});

/** Prose or screenplay, as the profile says or the format implies. Switching it rewrites nothing (§3.1). */
export const editModeOf = (file: ProjectFile): 'prose' | 'screenplay' => {
  const mode = editorProfileOf(file).mode;
  return mode === 'auto' ? (isProseFormat(file.project.format) ? 'prose' : 'screenplay') : mode;
};

// --------------------------------------------------------------- findings

export type EditStatus = 'open' | 'fixed' | 'dismissed' | 'intentional' | 'deferred';

export interface EditFinding {
  /** Stable across re-checks while the words are the same: rule, line, words, which occurrence. */
  key: string;
  beatId: string;
  elementId: string;
  start: number;
  end: number;
  /** The words the finding is about, as they were. */
  quote: string;
  category: EditCategory;
  ruleId: string;
  severity: EditSeverity;
  confidence: EditConfidence;
  message: string;
  rule: string;
  fix: string | null;
  /** Where it came from: the program's own rules, or the grammar checker. */
  source: 'rules' | 'grammar';
}

export interface EditReview {
  /** When the check ran, and over what. */
  checkedAt: string | null;
  scope: EditScope;
  findings: EditFinding[];
  /** The writer's decisions, by finding key; they outlive a re-check (§6.5). */
  decisions: Record<string, { status: Exclude<EditStatus, 'open'>; at: string }>;
  /** Keys new in the last check, for *new since last check* (§5). */
  fresh: string[];
}

export type EditScope =
  | { kind: 'all' }
  | { kind: 'unit'; id: string }
  | { kind: 'beat'; id: string };

const EMPTY_REVIEW: EditReview = { checkedAt: null, scope: { kind: 'all' }, findings: [], decisions: {}, fresh: [] };

export const editReviewOf = (file: ProjectFile): EditReview => {
  const raw = (file.settings.editorReview ?? {}) as Partial<EditReview>;
  return {
    checkedAt: typeof raw.checkedAt === 'string' ? raw.checkedAt : null,
    scope: (raw.scope as EditScope | undefined) ?? { kind: 'all' },
    findings: Array.isArray(raw.findings) ? (raw.findings as EditFinding[]) : [],
    decisions: raw.decisions && typeof raw.decisions === 'object' ? raw.decisions : {},
    fresh: strings(raw.fresh),
  };
};

const withReview = (file: ProjectFile, review: EditReview): ProjectFile => ({
  ...file,
  settings: { ...file.settings, editorReview: review as unknown as Record<string, unknown> },
});

/** What the writer decided about a finding, or open. */
export const statusOf = (review: EditReview, finding: EditFinding): EditStatus => review.decisions[finding.key]?.status ?? 'open';

/** A finding from outside the rules — the grammar checker — before it is placed. */
export interface OutsideHit extends RuleHit {
  beatId: string;
  elementId: string;
}

/** The lines a scope covers, in reading order, with what the rules need to know of each. */
export const linesInScope = (
  file: ProjectFile,
  scope: EditScope,
): Array<{ beatId: string; elementId: string; unitId: string; type: string; text: string }> => {
  const out: Array<{ beatId: string; elementId: string; unitId: string; type: string; text: string }> = [];
  for (const unit of unitsInStoryOrder(file)) {
    if (!unit.inScript) continue;
    if (scope.kind === 'unit' && unit.id !== scope.id) continue;
    for (const beat of beatsForUnit(file, unit.id)) {
      if (!beat.inScript) continue;
      if (scope.kind === 'beat' && beat.id !== scope.id) continue;
      for (const element of beat.manuscript.elements) {
        out.push({ beatId: beat.id as string, elementId: element.id as string, unitId: unit.id as string, type: element.type, text: element.text });
      }
    }
  }
  return out;
};

/** The point of view, tense and viewpoint for a line: its beat's override, its section's, or the project's. */
const settingsFor = (profile: EditorProfile, unitId: string, beatId: string) => {
  const unit = profile.overrides[unitId] ?? {};
  const beat = profile.overrides[beatId] ?? {};
  return {
    pov: beat.pov ?? unit.pov ?? profile.pov,
    tense: beat.tense ?? unit.tense ?? profile.tense,
    viewpoint: beat.viewpoint ?? unit.viewpoint ?? profile.viewpoint,
  };
};

const keyFor = (ruleId: string, elementId: string, quote: string, nth: number): string =>
  `${ruleId}|${elementId}|${quote.toLowerCase().slice(0, 60)}|${nth}`;

/**
 * **Run Edit Check** (§6): the rules over every line in the scope, and the
 * grammar checker's findings handed in, as one review. The manuscript is not
 * touched. Findings outside the scope are kept from the last check; the
 * writer's decisions are kept for every finding whose words are unchanged.
 */
export const runEditCheck = (file: ProjectFile, options: { scope?: EditScope; outside?: readonly OutsideHit[] } = {}): ProjectFile => {
  const scope = options.scope ?? { kind: 'all' };
  const profile = editorProfileOf(file);
  const mode = editModeOf(file);
  const characters = file.characters.map((one) => one.name).filter(Boolean);
  const dictionary = new Set(profile.dictionary.map((one) => one.toLowerCase()));
  const lines = linesInScope(file, scope);
  const inScope = new Set(lines.map((one) => one.elementId));
  const textOf = new Map(lines.map((one) => [one.elementId, one.text]));

  const raw: Array<RuleHit & { beatId: string; elementId: string; source: 'rules' | 'grammar' }> = [];
  for (const line of lines) {
    const here = settingsFor(profile, line.unitId, line.beatId);
    for (const one of checkLine(line.text, { mode, type: line.type, ...here, characters, dictionary })) {
      raw.push({ ...one, beatId: line.beatId, elementId: line.elementId, source: 'rules' });
    }
  }
  for (const one of options.outside ?? []) {
    if (!inScope.has(one.elementId)) continue;
    const word = (textOf.get(one.elementId) ?? '').slice(one.start, one.end).toLowerCase();
    // The project's own words are right, whatever the grammar checker's dictionary says.
    if (one.category === 'spelling' && (dictionary.has(word) || characters.some((name) => name.toLowerCase().split(/\s+/).includes(word)))) continue;
    raw.push({ ...one, source: 'grammar' });
  }

  // Overlapping hits of one rule are one finding; each is numbered among its
  // kind in its line, so two identical slips in a line are two findings.
  const counts = new Map<string, number>();
  const findings: EditFinding[] = [];
  const seenSpan = new Set<string>();
  raw
    .sort((a, b) => (a.elementId < b.elementId ? -1 : a.elementId > b.elementId ? 1 : a.start - b.start))
    .forEach((one) => {
      const span = `${one.elementId}:${one.start}:${one.end}:${one.ruleId}`;
      if (seenSpan.has(span)) return;
      seenSpan.add(span);
      const quote = (textOf.get(one.elementId) ?? '').slice(one.start, one.end);
      const tally = `${one.ruleId}|${one.elementId}|${quote.toLowerCase()}`;
      const nth = counts.get(tally) ?? 0;
      counts.set(tally, nth + 1);
      findings.push({
        key: keyFor(one.ruleId, one.elementId, quote, nth),
        beatId: one.beatId,
        elementId: one.elementId,
        start: one.start,
        end: one.end,
        quote,
        category: one.category,
        ruleId: one.ruleId,
        severity: one.severity,
        confidence: one.confidence,
        message: one.message,
        rule: one.rule,
        // A fix is offered only for a mechanical error, and only if narrow (§2).
        fix: one.fix !== undefined && one.severity === 'error' && isNarrowFix(one.fix) ? one.fix : null,
        source: one.source,
      });
    });

  // In reading order, for the queue.
  const order = new Map(linesInScope(file, { kind: 'all' }).map((one, index) => [one.elementId, index]));
  findings.sort((a, b) => (order.get(a.elementId) ?? 0) - (order.get(b.elementId) ?? 0) || a.start - b.start);

  const before = editReviewOf(file);
  const kept = before.findings.filter((one) => !inScope.has(one.elementId) && order.has(one.elementId));
  const all = [...kept, ...findings].sort((a, b) => (order.get(a.elementId) ?? 0) - (order.get(b.elementId) ?? 0) || a.start - b.start);
  const keys = new Set(all.map((one) => one.key));
  const known = new Set(before.findings.map((one) => one.key));
  // A decision whose finding is gone (its words changed) goes with it; one
  // for a fixed finding goes too, the fix having done its work.
  const decisions = Object.fromEntries(Object.entries(before.decisions).filter(([key, one]) => keys.has(key) && one.status !== 'fixed'));
  return withReview(file, {
    checkedAt: nowIso(),
    scope,
    findings: all,
    decisions,
    fresh: findings.filter((one) => !known.has(one.key)).map((one) => one.key),
  });
};

/** Dismiss, mark intentional, defer — or open again. Changes nothing in the manuscript. */
export const decideFinding = (file: ProjectFile, key: string, status: EditStatus): ProjectFile => {
  const review = editReviewOf(file);
  const decisions = { ...review.decisions };
  if (status === 'open') delete decisions[key];
  else decisions[key] = { status, at: nowIso() };
  return withReview(file, { ...review, decisions });
};

// --------------------------------------------------------------- where a finding is now

/**
 * Where a finding's words are now (§5: *findings are re-anchored or marked
 * stale as text changes*): `live` where they are still at its offsets,
 * `moved` where they are elsewhere in the same line (the nearest), `stale`
 * where they are gone or the line is.
 */
export const findingAnchor = (file: ProjectFile, finding: EditFinding): { state: 'live' | 'moved' | 'stale'; start: number; end: number; text: string } => {
  const beat = file.beats.find((one) => one.id === finding.beatId);
  const element = beat?.manuscript.elements.find((one) => one.id === finding.elementId)
    ?? file.beats.flatMap((one) => one.manuscript.elements).find((one) => one.id === finding.elementId);
  if (!element) return { state: 'stale', start: 0, end: 0, text: '' };
  const text = element.text;
  if (text.slice(finding.start, finding.end) === finding.quote) return { state: 'live', start: finding.start, end: finding.end, text };
  if (!finding.quote) return { state: 'stale', start: 0, end: 0, text };
  let best = -1;
  for (let at = text.indexOf(finding.quote); at !== -1; at = text.indexOf(finding.quote, at + 1)) {
    if (best === -1 || Math.abs(at - finding.start) < Math.abs(best - finding.start)) best = at;
  }
  return best === -1 ? { state: 'stale', start: 0, end: 0, text } : { state: 'moved', start: best, end: best + finding.quote.length, text };
};

/**
 * **Accept Fix** (§2, §10.8): the one way this editor changes the manuscript.
 * Only a mechanical finding's own short fix, only over the span it names, only
 * while the words there are still the ones it found. Anything else returns the
 * file unchanged and says why.
 */
export const applyFix = (file: ProjectFile, key: string): { file: ProjectFile; done: boolean; why?: string } => {
  const review = editReviewOf(file);
  const finding = review.findings.find((one) => one.key === key);
  if (!finding) return { file, done: false, why: 'That finding is not in the review any more.' };
  if (finding.fix === null || finding.severity !== 'error' || !isNarrowFix(finding.fix)) {
    return { file, done: false, why: 'This is a note to revise by hand; there is no fix to accept.' };
  }
  const where = findingAnchor(file, finding);
  if (where.state === 'stale') return { file, done: false, why: 'The words have changed since the check; run it again.' };
  const beat = file.beats.find((one) => one.manuscript.elements.some((element) => element.id === finding.elementId));
  if (!beat) return { file, done: false, why: 'That line is not in the manuscript any more.' };
  const elements = beat.manuscript.elements.map((element) =>
    element.id === finding.elementId ? { ...element, text: element.text.slice(0, where.start) + finding.fix + element.text.slice(where.end) } : element,
  );
  const changed = updateBeat(file, beat.id as BeatId, { manuscript: { elements } });
  return { file: decideFinding(changed, key, 'fixed'), done: true };
};

/** Every word the writer says is right goes in the project's dictionary, and its spelling findings go. */
export const addToEditorDictionary = (file: ProjectFile, word: string): ProjectFile => {
  const clean = word.trim();
  if (!clean) return file;
  const profile = editorProfileOf(file);
  if (profile.dictionary.some((one) => one.toLowerCase() === clean.toLowerCase())) return file;
  const next = setEditorProfile(file, { dictionary: [...profile.dictionary, clean] });
  const review = editReviewOf(next);
  return withReview(next, {
    ...review,
    findings: review.findings.filter((one) => !(one.category === 'spelling' && one.quote.toLowerCase() === clean.toLowerCase())),
  });
};

// --------------------------------------------------------------- the queue

export interface ReviewTally {
  total: number;
  open: number;
  byCategory: Partial<Record<EditCategory, { total: number; open: number }>>;
  bySeverity: Record<EditSeverity, number>;
}

/** What the review holds and how much is left (§5, §6.5). Deferred counts as still to do. */
export const tallyReview = (review: EditReview): ReviewTally => {
  const tally: ReviewTally = { total: 0, open: 0, byCategory: {}, bySeverity: { error: 0, concern: 0, info: 0 } };
  for (const one of review.findings) {
    const status = statusOf(review, one);
    const left = status === 'open' || status === 'deferred';
    tally.total += 1;
    if (left) tally.open += 1;
    const bucket = (tally.byCategory[one.category] ??= { total: 0, open: 0 });
    bucket.total += 1;
    if (left) {
      bucket.open += 1;
      tally.bySeverity[one.severity] += 1;
    }
  }
  return tally;
};

/** The passage around a finding for the review screen: its line, and `around` lines either side in the same beat (§5). */
export const passageAround = (
  file: ProjectFile,
  finding: EditFinding,
  around = 2,
): Array<{ elementId: string; type: string; text: string; flagged: boolean }> => {
  const beat = file.beats.find((one) => one.manuscript.elements.some((element) => element.id === finding.elementId));
  if (!beat) return [];
  const elements = beat.manuscript.elements;
  const at = elements.findIndex((element) => element.id === finding.elementId);
  return elements
    .slice(Math.max(0, at - around), at + around + 1)
    .map((element) => ({ elementId: element.id as string, type: element.type, text: element.text, flagged: element.id === finding.elementId }));
};

/** Where a finding sits, in words: the section and the beat. */
export const findingPlace = (file: ProjectFile, finding: EditFinding): { unitId: StructuralUnitId | null; unitTitle: string; beatTitle: string } => {
  const beat = file.beats.find((one) => (one.id as string) === finding.beatId);
  const unit = beat ? file.units.find((one) => one.id === beat.unitId) : undefined;
  return { unitId: unit?.id ?? null, unitTitle: unit?.title ?? '', beatTitle: beat?.title ?? '' };
};
