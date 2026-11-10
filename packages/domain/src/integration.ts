import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import type { ManuscriptElement, ManuscriptSegment } from './entities/manuscript.js';
import type { ProjectFile } from './project-file.js';
import type { BeatRevisionId, ManuscriptElementId } from './ids.js';

/**
 * Selection-to-selection integration (addendum 07 §30; workflow spec v1.1 §6.3).
 *
 * The showrunner highlights an exact passage in a writer's submitted version,
 * highlights the place in the master beat it goes, and says what to do with
 * it: **Replace** the master selection, **Insert before** or **Insert after**
 * it, or **Delete** the master selection outright. Each step is applied to a
 * working integration draft; nothing touches the master until the draft is
 * committed, and then only as the beat's **next version** through the beat
 * version system already in VC Writer, the version before it kept whole.
 *
 * **No mapping is ever guessed.** Every operation carries the exact words it
 * was made on at both ends. Replaying it, on the page or on the server, checks
 * those words are still there; if they are not, the operation is refused, not
 * moved somewhere that looks close.
 *
 * Passages are within one beat. A selection across two beats is two
 * integrations, so an adjacent beat is never changed by accident.
 */

/** A passage in a beat's text: from one element and offset to another. */
export interface PassageAnchor {
  startElementId: string;
  startOffset: number;
  endElementId: string;
  endOffset: number;
}

export const INTEGRATION_KINDS = ['replace', 'insert_before', 'insert_after', 'delete'] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

export const INTEGRATION_KIND_NAMES: Record<IntegrationKind, string> = {
  replace: 'Replace selection',
  insert_before: 'Insert before',
  insert_after: 'Insert after',
  delete: 'Delete master selection',
};

export interface IntegrationSource {
  submissionId: string | null;
  versionId: string;
  /** The writer, for attribution. */
  authorId: string;
  beatId: string;
  anchor: PassageAnchor;
  /** The exact words selected. */
  quote: string;
}

export interface IntegrationOp {
  id: string;
  kind: IntegrationKind;
  /** The writer's passage. Null only for a delete. */
  source: IntegrationSource | null;
  /** Where in the master beat, as it stood when this step was taken. */
  dest: { beatId: string; anchor: PassageAnchor; quote: string };
  actorId: string;
  at: string;
}

export type IntegrationRefusal =
  | { reason: 'needs_source' }
  | { reason: 'needs_destination' }
  | { reason: 'delete_takes_no_source' }
  | { reason: 'other_beat' }
  | { reason: 'source_moved' }
  | { reason: 'destination_moved' }
  | { reason: 'no_such_beat' }
  | { reason: 'stale_master' }
  | { reason: 'nothing_to_commit' };

export const integrationRefusalText = (refusal: IntegrationRefusal): string => {
  switch (refusal.reason) {
    case 'needs_source':
      return 'Select the writer’s passage first.';
    case 'needs_destination':
      return 'Select the master text first.';
    case 'delete_takes_no_source':
      return 'Delete removes master text only; clear the writer’s selection.';
    case 'other_beat':
      return 'A passage goes into the beat it was selected in. Do the other beat as its own integration.';
    case 'source_moved':
      return 'The writer’s passage is not where it was selected. Select it again.';
    case 'destination_moved':
      return 'The master text is not where it was selected. Select it again.';
    case 'no_such_beat':
      return 'That beat is not in the master.';
    case 'stale_master':
      return 'The master has changed since this integration was opened. Compare and start again from the current master.';
    case 'nothing_to_commit':
      return 'Nothing has been applied yet.';
  }
};

// ------------------------------------------------------------- reading text

interface Point {
  index: number;
  offset: number;
}

/** The anchor as positions in the element list, start before end, or null. */
export const locate = (
  elements: readonly ManuscriptElement[],
  anchor: PassageAnchor,
): { start: Point; end: Point } | null => {
  const a = elements.findIndex((one) => (one.id as string) === anchor.startElementId);
  const b = elements.findIndex((one) => (one.id as string) === anchor.endElementId);
  if (a < 0 || b < 0) return null;
  const clamp = (index: number, offset: number) => Math.max(0, Math.min(offset, elements[index]!.text.length));
  let start = { index: a, offset: clamp(a, anchor.startOffset) };
  let end = { index: b, offset: clamp(b, anchor.endOffset) };
  if (b < a || (a === b && end.offset < start.offset)) [start, end] = [end, start];
  return { start, end };
};

export interface Fragment {
  type: ManuscriptElement['type'];
  text: string;
  characterId: ManuscriptElement['characterId'];
}

/** The passage as pieces of elements, one per element it touches. */
export const passageFragments = (segment: ManuscriptSegment, anchor: PassageAnchor): Fragment[] | null => {
  const found = locate(segment.elements, anchor);
  if (!found) return null;
  const { start, end } = found;
  const out: Fragment[] = [];
  for (let index = start.index; index <= end.index; index += 1) {
    const element = segment.elements[index]!;
    const from = index === start.index ? start.offset : 0;
    const to = index === end.index ? end.offset : element.text.length;
    out.push({ type: element.type, text: element.text.slice(from, to), characterId: element.characterId });
  }
  return out;
};

/** The passage's words, one line per element. */
export const passageText = (segment: ManuscriptSegment, anchor: PassageAnchor): string | null =>
  passageFragments(segment, anchor)?.map((one) => one.text).join('\n') ?? null;

export const isEmptyAnchor = (anchor: PassageAnchor): boolean =>
  anchor.startElementId === anchor.endElementId && anchor.startOffset === anchor.endOffset;

// ----------------------------------------------------------- changing text

const CONTRIBUTORS = 'contributors';

/** The writers credited on an element (an attribute, so it travels with the text). */
export const contributorsOn = (element: Pick<ManuscriptElement, 'attributes'>): string[] => {
  const value = element.attributes[CONTRIBUTORS];
  return typeof value === 'string' && value ? value.split(',') : [];
};

const credit = (element: ManuscriptElement, authorId: string | null): ManuscriptElement => {
  if (!authorId) return element;
  const now = contributorsOn(element);
  if (now.includes(authorId)) return element;
  return { ...element, attributes: { ...element.attributes, [CONTRIBUTORS]: [...now, authorId].join(',') } };
};

/** Every writer credited anywhere in a beat, in order of first appearance. */
export const contributorsOf = (segment: ManuscriptSegment): string[] => [
  ...new Set(segment.elements.flatMap((element) => contributorsOn(element))),
];

/**
 * Put fragments in place of a range (an empty range inserts). The element the
 * range starts in keeps its id and type; new elements get new ids; whoever
 * wrote the fragments is credited on every element they land in.
 */
export const splice = (
  segment: ManuscriptSegment,
  range: { start: Point; end: Point },
  fragments: readonly Fragment[],
  authorId: string | null,
): ManuscriptSegment => {
  const { start, end } = range;
  const first = segment.elements[start.index]!;
  const last = segment.elements[end.index]!;
  const head = first.text.slice(0, start.offset);
  const tail = last.text.slice(end.offset);
  const before = segment.elements.slice(0, start.index);
  const after = segment.elements.slice(end.index + 1);
  let middle: ManuscriptElement[];
  if (fragments.length === 0) {
    middle = [{ ...first, text: head + tail }];
  } else if (fragments.length === 1) {
    middle = [credit({ ...first, text: head + fragments[0]!.text + tail }, authorId)];
  } else {
    const opening = credit({ ...first, text: head + fragments[0]!.text }, authorId);
    const inner = fragments.slice(1, -1).map((fragment) =>
      credit(
        {
          id: newId<ManuscriptElementId>(),
          type: fragment.type,
          text: fragment.text,
          characterId: fragment.characterId,
          attributes: {},
        },
        authorId,
      ),
    );
    const closingFragment = fragments[fragments.length - 1]!;
    const closing = credit(
      {
        id: last.id !== first.id ? last.id : newId<ManuscriptElementId>(),
        type: closingFragment.type,
        text: closingFragment.text + tail,
        characterId: closingFragment.characterId,
        attributes: last.id !== first.id ? last.attributes : {},
      },
      authorId,
    );
    middle = [opening, ...inner, closing];
  }
  return { ...segment, elements: [...before, ...middle, ...after] };
};

/**
 * One step on the working draft. `source` is the writer's beat text, read from
 * the version named on the step; null for a delete.
 */
export const applyIntegration = (
  working: ManuscriptSegment,
  op: IntegrationOp,
  source: ManuscriptSegment | null,
): ManuscriptSegment | IntegrationRefusal => {
  if (op.kind === 'delete' && op.source) return { reason: 'delete_takes_no_source' };
  if (op.kind !== 'delete' && !op.source) return { reason: 'needs_source' };
  const dest = locate(working.elements, op.dest.anchor);
  if (!dest) return { reason: 'destination_moved' };
  if (passageText(working, op.dest.anchor) !== op.dest.quote) return { reason: 'destination_moved' };
  if ((op.kind === 'replace' || op.kind === 'delete') && !op.dest.quote) return { reason: 'needs_destination' };

  let fragments: Fragment[] = [];
  let wholeElements = false;
  if (op.source) {
    if (op.source.beatId !== op.dest.beatId) return { reason: 'other_beat' };
    if (!source) return { reason: 'source_moved' };
    const found = passageFragments(source, op.source.anchor);
    if (!found || found.map((one) => one.text).join('\n') !== op.source.quote) return { reason: 'source_moved' };
    if (!op.source.quote.trim()) return { reason: 'needs_source' };
    fragments = found;
    const at = locate(source.elements, op.source.anchor)!;
    wholeElements = at.start.offset === 0 && at.end.offset === source.elements[at.end.index]!.text.length;
  }

  // Whole paragraphs inserted at a paragraph's edge go in as paragraphs of
  // their own rather than run on into the one beside them.
  if (wholeElements && (op.kind === 'insert_before' || op.kind === 'insert_after')) {
    const point = op.kind === 'insert_before' ? dest.start : dest.end;
    const edge = point.offset === 0 ? point.index : point.offset === working.elements[point.index]!.text.length ? point.index + 1 : -1;
    if (edge >= 0) {
      const made = fragments.map((fragment) =>
        credit(
          { id: newId<ManuscriptElementId>(), type: fragment.type, text: fragment.text, characterId: fragment.characterId, attributes: {} },
          op.source!.authorId,
        ),
      );
      return { ...working, elements: [...working.elements.slice(0, edge), ...made, ...working.elements.slice(edge)] };
    }
  }

  const range =
    op.kind === 'insert_before'
      ? { start: dest.start, end: dest.start }
      : op.kind === 'insert_after'
        ? { start: dest.end, end: dest.end }
        : dest;
  return splice(working, range, fragments, op.source?.authorId ?? null);
};

/** Replay every step in order: the working draft from the base. */
export const applyIntegrations = (
  base: ManuscriptSegment,
  ops: readonly IntegrationOp[],
  sources: ReadonlyMap<string, ManuscriptSegment>,
): ManuscriptSegment | (IntegrationRefusal & { step: number }) => {
  let working = base;
  for (const [step, op] of ops.entries()) {
    const next = applyIntegration(working, op, op.source ? (sources.get(op.source.versionId) ?? null) : null);
    if ('reason' in next) return { ...next, step };
    working = next;
  }
  return working;
};

// --------------------------------------------------------------- comparing

/** A short, stable fingerprint of a beat's text, to tell whether the master moved. */
export const beatHash = (segment: ManuscriptSegment): string => {
  const text = JSON.stringify(segment.elements.map((one) => [one.id, one.type, one.text]));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export interface DiffPart {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

/** Words added and removed between two texts, for the preview (spec §6.3 step 5). */
export const wordDiff = (before: string, after: string): DiffPart[] => {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  // Past this, a plain before / after says it as well as a diff would.
  if (a.length * b.length > 4_000_000) {
    return [
      { kind: 'removed', text: before },
      { kind: 'added', text: after },
    ];
  }
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i]!);
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      push('removed', a[i]!);
      i += 1;
    } else {
      push('added', b[j]!);
      j += 1;
    }
  }
  while (i < a.length) push('removed', a[i++]!);
  while (j < b.length) push('added', b[j++]!);
  return out;
};

export const segmentText = (segment: ManuscriptSegment): string => segment.elements.map((one) => one.text).join('\n');

// -------------------------------------------------------------- committing

/** The next version's name: "Draft 4" → "Draft 5"; anything else counts on. */
export const nextBeatVersionName = (beat: { revisionName: string; revisions: readonly { name: string }[] }): string => {
  const taken = new Set([beat.revisionName, ...beat.revisions.map((one) => one.name)]);
  const numbered = /^(.*?)(\d+)$/.exec(beat.revisionName.trim());
  const prefix = numbered ? numbered[1]! : 'Draft ';
  let count = numbered ? Number(numbered[2]) + 1 : beat.revisions.length + 2;
  while (taken.has(`${prefix}${count}`)) count += 1;
  return `${prefix}${count}`;
};

/**
 * The integrated text as the beat's next version (spec §6.3): the version it
 * replaces is kept whole among the beat's drafts, under its own name.
 */
export const commitBeatVersion = (
  file: ProjectFile,
  beatId: string,
  segment: ManuscriptSegment,
): { file: ProjectFile; from: string; to: string } | IntegrationRefusal => {
  const beat = file.beats.find((one) => (one.id as string) === beatId);
  if (!beat) return { reason: 'no_such_beat' };
  const to = nextBeatVersionName(beat);
  const at = nowIso();
  return {
    from: beat.revisionName,
    to,
    file: {
      ...file,
      beats: file.beats.map((one) =>
        one.id === beat.id
          ? {
              ...one,
              revisions: [
                ...one.revisions,
                {
                  id: newId<BeatRevisionId>(),
                  name: one.revisionName,
                  manuscript: one.manuscript,
                  savedAt: at,
                  marks: [],
                  markedBy: '',
                  archived: false,
                },
              ],
              manuscript: segment,
              revisionName: to,
              updatedAt: at,
            }
          : one,
      ),
    },
  };
};

/** Who an integration took words from, once each. */
export const integrationAuthors = (ops: readonly IntegrationOp[]): string[] => [
  ...new Set(ops.flatMap((op) => (op.source ? [op.source.authorId] : []))),
];

/** The submissions an integration drew from, once each. */
export const integrationSubmissions = (ops: readonly IntegrationOp[]): string[] => [
  ...new Set(ops.flatMap((op) => (op.source?.submissionId ? [op.source.submissionId] : []))),
];
