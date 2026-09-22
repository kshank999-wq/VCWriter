import { nowIso } from './entities/common.js';
import { beatsForUnit } from './selectors.js';
import { divisionSpan } from './outline-binding.js';
import { sectionTextFor } from './learning.js';
import type { ProjectFile } from './project-file.js';
import type { StoryMarkerId } from './ids.js';

/**
 * A suggested chapter summary (addendum 19 §7, the last stage on purpose).
 *
 * The learning-aid generator of addendum 16 writes a summary from a
 * section's content, and a chapter's overview is **the same reading pointed
 * one level up**: the words of every section the chapter covers, read
 * through the same route with the same rule — the request has no field for
 * the author's words, and what comes back is offered, never written where
 * the writer's words live.
 *
 * So there are two fields on the page and this file writes to one of them.
 * `offerSummary` touches `suggestedSummary`; `acceptSummary` is the only
 * thing that moves those words into `summary`, and it is an act the author
 * takes, which hands back what it replaced.
 */

/** The route reads a section of at most this many characters (its own cap). */
export const CHAPTER_TEXT_LIMIT = 40_000;

/**
 * The words a generation should read: every section the chapter covers, in
 * order, each under its own title, and nothing else — not the chapter page's
 * own words, not the next chapter, not the research.
 *
 * Which sections a chapter covers is `divisionSpan`'s reading of the markers,
 * so a section dragged into the chapter is read and one dragged out is not,
 * with nothing run. A long chapter is cut at the route's cap on a paragraph
 * boundary, and `chapterTextIsCut` says so, because a summary written from
 * half a chapter should not pretend to be a summary of the whole.
 */
export const chapterTextFor = (file: ProjectFile, markerId: StoryMarkerId): string => {
  const parts: string[] = [];
  for (const unit of divisionSpan(file, markerId)) {
    const sections = beatsForUnit(file, unit.id)
      .map((beat) => {
        const words = sectionTextFor(file, beat.id);
        if (words.length === 0) return '';
        return beat.title.trim().length > 0 ? `${beat.title.trim()}\n\n${words}` : words;
      })
      .filter((text) => text.length > 0);
    if (sections.length === 0) continue;
    parts.push(unit.title.trim().length > 0 ? `${unit.title.trim()}\n\n${sections.join('\n\n')}` : sections.join('\n\n'));
  }
  const whole = parts.join('\n\n');
  if (whole.length <= CHAPTER_TEXT_LIMIT) return whole;
  const cut = whole.lastIndexOf('\n\n', CHAPTER_TEXT_LIMIT);
  return whole.slice(0, cut > 0 ? cut : CHAPTER_TEXT_LIMIT);
};

/** Whether the chapter's words ran past what one reading can take. */
export const chapterTextIsCut = (file: ProjectFile, markerId: StoryMarkerId): boolean => {
  let length = 0;
  for (const unit of divisionSpan(file, markerId)) {
    for (const beat of beatsForUnit(file, unit.id)) length += sectionTextFor(file, beat.id).length + 4;
  }
  return length > CHAPTER_TEXT_LIMIT;
};

/**
 * Why a summary cannot be asked for, or null where it can.
 *
 * About the chapter, not the account: the account's reasons (not signed in,
 * no license, not configured) are the route's to say and the screen says them
 * once at the foot. This is the one reason that is the chapter's own — there
 * is nothing under it to read yet.
 */
export const summaryRefusal = (file: ProjectFile, markerId: StoryMarkerId): string | null => {
  if (!file.markers.some((marker) => marker.id === markerId)) return 'There is no such chapter.';
  return chapterTextFor(file, markerId).trim().length === 0
    ? 'Nothing under this chapter has been written yet, so there is nothing to summarise.'
    : null;
};

const patchPage = (file: ProjectFile, markerId: StoryMarkerId, patch: Record<string, unknown>): ProjectFile => {
  const at = nowIso();
  return {
    ...file,
    markers: file.markers.map((marker) =>
      marker.id === markerId ? { ...marker, page: { ...marker.page, ...patch }, updatedAt: at } : marker,
    ),
    project: { ...file.project, updatedAt: at },
  };
};

/**
 * Record what a generation offered. **Writes to `suggestedSummary` and to
 * nothing else** — never to `summary`. Calling it a hundred times cannot
 * cost the author a word they wrote.
 */
export const offerSummary = (file: ProjectFile, markerId: StoryMarkerId, text: string): ProjectFile =>
  patchPage(file, markerId, { suggestedSummary: text, suggestedAt: nowIso() });

/**
 * The explicit action: take the suggestion as the summary.
 *
 * **Hands back what it replaced**, so the screen can offer it again; refused
 * where nothing is on offer, rather than blanking the author's words.
 */
export const acceptSummary = (
  file: ProjectFile,
  markerId: StoryMarkerId,
): { file: ProjectFile; replaced: string | null } => {
  const marker = file.markers.find((one) => one.id === markerId);
  if (!marker || marker.page.suggestedSummary.trim().length === 0) return { file, replaced: null };
  return {
    file: patchPage(file, markerId, {
      summary: marker.page.suggestedSummary,
      suggestedSummary: '',
      suggestedAt: null,
    }),
    replaced: marker.page.summary,
  };
};

/** Throw the suggestion away without touching the author's words. */
export const discardSummary = (file: ProjectFile, markerId: StoryMarkerId): ProjectFile =>
  patchPage(file, markerId, { suggestedSummary: '', suggestedAt: null });
