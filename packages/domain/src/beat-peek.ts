import type { Beat } from './entities/structure.js';
import type { BeatId } from './ids.js';
import type { ProjectFile } from './project-file.js';
import { countWords } from './entities/manuscript.js';
import { beatsForUnit } from './selectors.js';
import { nounsFor } from './formats.js';

/**
 * **What a beat is, said without opening it** (addendum 02 §4c, from Ken:
 * *when you hover over a beat in a scene, I want to be able to see the entire
 * description of the beat, so you don't have to go into it to see if it's the
 * one you need to be working on*).
 *
 * Three decisions carry it.
 *
 * **The description is never cut.** That is the whole of the ask — a beat is
 * already named by a title on every row, and what a writer cannot see is the
 * sentence that says what happens in it. Truncating it here would rebuild the
 * problem: a writer who reads *She tells him about the light and…* still has
 * to open the beat, which is the trip this exists to save.
 *
 * **Where nothing is described, the writing stands in.** A beat with no
 * summary is not an empty beat, and its opening words are what it is — so the
 * reading says which of the two it is handing over rather than leaving a
 * blank card that reads as a fault.
 *
 * **It is a reading, so nothing can disagree with it.** Every surface that
 * draws a beat asks this, and a new one gets the same answer the day it is
 * written — which is what *universal* has to mean, a hover built per screen
 * being six answers to *what is in this beat*.
 */

/** How much of the writing stands in for a description that is not there. */
export const PEEK_OPENING_WORDS = 60;

export interface BeatPeek {
  /** What the row calls it, or what to call it where it has no name. */
  title: string;
  /** The scene it is in — a beat met on a board or in a search has no context. */
  scene: string;
  /** Which of this beat's fellows it is, and how many there are. */
  at: number;
  of: number;
  status: Beat['status'];
  /** False where the beat keeps its text and stays out of the manuscript. */
  inScript: boolean;
  /** The writer's own description, **whole**. Empty where there is none. */
  summary: string;
  /**
   * The writing's opening, where there is no summary — said as such by
   * `standsIn`, so a writer knows whether they are reading a description or
   * the words themselves.
   */
  opening: string;
  /** True where `opening` is standing in for a description nobody wrote. */
  standsIn: boolean;
  words: number;
  /** What this format calls a beat, so no card says *beat* on a novel. */
  noun: string;
}

/** The first words of a beat's writing, with a mark where it runs on. */
const openingOf = (beat: Beat, most: number): string => {
  const said = beat.manuscript.elements
    .map((element) => element.text.trim())
    .filter((text) => text.length > 0)
    .join(' · ');
  const words = said.split(/\s+/).filter(Boolean);
  return words.length <= most ? said : `${words.slice(0, most).join(' ')}…`;
};

/**
 * Everything a hover shows about one beat, or null where there is no such
 * beat — a row pointing at writing that has gone shows nothing rather than a
 * card about nothing.
 */
export const beatPeek = (file: ProjectFile, beatId: BeatId | string): BeatPeek | null => {
  const beat = file.beats.find((one) => (one.id as string) === (beatId as string));
  if (!beat) return null;
  const nouns = nounsFor(file.project.format);
  const unit = file.units.find((one) => one.id === beat.unitId);
  const fellows = beatsForUnit(file, beat.unitId);
  const summary = beat.summary.trim();
  const opening = openingOf(beat, PEEK_OPENING_WORDS);
  return {
    title: beat.title.trim() || `Untitled ${nouns.sub.toLowerCase()}`,
    scene: (unit?.title ?? '').trim() || `Untitled ${nouns.unit.toLowerCase()}`,
    at: fellows.findIndex((one) => one.id === beat.id) + 1,
    of: fellows.length,
    status: beat.status,
    inScript: beat.inScript,
    summary,
    opening,
    standsIn: summary.length === 0 && opening.length > 0,
    words: countWords(beat.manuscript),
    noun: nouns.sub,
  };
};

/**
 * The one line under the name: where the beat sits and what state it is in.
 * A sentence rather than a row of chips, because it is read at a glance and
 * never acted on.
 */
export const describePeek = (peek: BeatPeek): string => {
  const bits = [`${peek.noun} ${peek.at} of ${peek.of}`, `in ${peek.scene}`, peek.status];
  if (!peek.inScript) bits.push('not in the manuscript');
  bits.push(peek.words === 1 ? '1 word' : `${peek.words} words`);
  return bits.join(' · ');
};
