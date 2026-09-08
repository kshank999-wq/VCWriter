import { beatsInStoryOrder, unitsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, ManuscriptElementId, StructuralUnitId } from './ids.js';

/**
 * Find and replace across the manuscript (addendum 02 §13).
 *
 * The search runs over the elements in **story order**, which is the order
 * the writer reads in, so "next match" means the next one down the page and
 * not the next one in some storage order.
 *
 * Two things it deliberately does not do. It does not search the *marks* —
 * a search for `bold` should not match the asterisks around a bold word — so
 * it works on the text as written, and an offset is an offset into that same
 * string, which is what a replacement needs. And it does not touch anything
 * but the elements it matched: a replacement rebuilds one element's text and
 * leaves its id, its type and everything hanging off it alone.
 */

export interface FindOptions {
  /** Default false: writers search for "she" and mean She too. */
  matchCase?: boolean;
  /** Only whole words, so "cat" does not match "catalogue". */
  wholeWord?: boolean;
  /** Search only these beats. Absent searches all of them. */
  beatIds?: readonly BeatId[];
}

export interface Match {
  unitId: StructuralUnitId;
  beatId: BeatId;
  elementId: ManuscriptElementId;
  /** Where the element falls in its beat, for a renderer that needs to scroll to it. */
  elementIndex: number;
  /** Character offsets into the element's text, as written. */
  start: number;
  end: number;
  /** The matched text, and a little either side of it, for a results list. */
  text: string;
  before: string;
  after: string;
}

const WORD = /[\p{L}\p{N}_]/u;

const isWordBoundary = (text: string, start: number, end: number): boolean => {
  const before = start > 0 ? (text[start - 1] as string) : '';
  const after = end < text.length ? (text[end] as string) : '';
  return !(before && WORD.test(before)) && !(after && WORD.test(after));
};

const CONTEXT = 32;

/**
 * Every occurrence of `query`, in story order. An empty query finds nothing,
 * which is what an empty search box should do.
 */
export const findInManuscript = (file: ProjectFile, query: string, options: FindOptions = {}): Match[] => {
  if (query.length === 0) return [];
  const wanted = options.beatIds ? new Set<string>(options.beatIds as readonly string[]) : null;
  const needle = options.matchCase ? query : query.toLowerCase();

  const order = new Map(unitsInStoryOrder(file).map((unit, index) => [unit.id as string, index]));
  const matches: Match[] = [];

  for (const beat of beatsInStoryOrder(file)) {
    if (wanted && !wanted.has(beat.id as string)) continue;
    if (!order.has(beat.unitId as string)) continue;

    beat.manuscript.elements.forEach((element, elementIndex) => {
      const haystack = options.matchCase ? element.text : element.text.toLowerCase();
      let at = haystack.indexOf(needle);
      while (at !== -1) {
        const end = at + query.length;
        if (!options.wholeWord || isWordBoundary(element.text, at, end)) {
          matches.push({
            unitId: beat.unitId,
            beatId: beat.id,
            elementId: element.id,
            elementIndex,
            start: at,
            end,
            text: element.text.slice(at, end),
            before: element.text.slice(Math.max(0, at - CONTEXT), at),
            after: element.text.slice(end, end + CONTEXT),
          });
        }
        // Overlapping matches are not matches: "aa" in "aaa" is found once.
        at = haystack.indexOf(needle, end);
      }
    });
  }

  return matches;
};

/**
 * Replace the given matches with `replacement`.
 *
 * The matches are applied per element from the back forwards, so the offsets
 * of the ones still to come are not disturbed by the ones already made —
 * which is the whole difficulty of replace-all, and the reason this takes
 * matches rather than a query.
 */
export const replaceMatches = (
  file: ProjectFile,
  matches: readonly Match[],
  replacement: string,
): ProjectFile => {
  if (matches.length === 0) return file;

  const byElement = new Map<string, Match[]>();
  for (const match of matches) {
    const list = byElement.get(match.elementId as string) ?? [];
    list.push(match);
    byElement.set(match.elementId as string, list);
  }

  let changed = false;
  const beats = file.beats.map((beat) => {
    let touched = false;
    const elements = beat.manuscript.elements.map((element) => {
      const here = byElement.get(element.id as string);
      if (!here || here.length === 0) return element;
      const ordered = [...here].sort((a, b) => b.start - a.start);
      let text = element.text;
      for (const match of ordered) {
        if (match.start < 0 || match.end > text.length) continue;
        text = text.slice(0, match.start) + replacement + text.slice(match.end);
      }
      if (text === element.text) return element;
      touched = true;
      return { ...element, text };
    });
    if (!touched) return beat;
    changed = true;
    return { ...beat, manuscript: { ...beat.manuscript, elements } };
  });

  return changed ? { ...file, beats } : file;
};

/** Replace every occurrence, which is the one case a caller does not have matches for. */
export const replaceAll = (
  file: ProjectFile,
  query: string,
  replacement: string,
  options: FindOptions = {},
): { file: ProjectFile; replaced: number } => {
  const matches = findInManuscript(file, query, options);
  return { file: replaceMatches(file, matches, replacement), replaced: matches.length };
};
