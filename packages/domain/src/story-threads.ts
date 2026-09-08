import { beatsForUnit } from './selectors.js';
import { storyLayout, timelineArcs, type StorySpan, type TimelineArc } from './story-layout.js';
import type { Beat, Lane } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId } from './ids.js';

/**
 * The Threads view (addendum 02 §6): who and what runs through the story,
 * scene by scene. Everything here is derived from the manuscript and the
 * structure — a character "appears" in a beat when a character cue names
 * them — so the view is never out of date with the script and there is
 * nothing extra for the writer to maintain.
 */

/** Names in character cues, uppercased and deduplicated, in order of first line. */
export const speakersIn = (beat: Beat): string[] => {
  const names: string[] = [];
  for (const element of beat.manuscript.elements) {
    if (element.type !== 'character') continue;
    // "CELESTE (V.O.)" and "CELESTE (CONT'D)" are the same person.
    const name = element.text.replace(/\(.*?\)/g, '').trim().toUpperCase();
    if (name.length > 0 && !names.includes(name)) names.push(name);
  }
  return names;
};

/**
 * Colours for characters, assigned in order of first appearance so the same
 * project colours the same way every time it opens. They are chosen to read
 * on the dark and the light schemes alike and to stay apart from the lane
 * palette; a character is not a lane.
 */
export const CHARACTER_COLOURS = [
  '#e07a5f',
  '#81b29a',
  '#f2cc8f',
  '#6c9bd2',
  '#b48ead',
  '#d98cb3',
  '#8fbf7f',
  '#e9b44c',
  '#7fc8c8',
  '#c98b6a',
] as const;

export const characterColour = (position: number): string =>
  CHARACTER_COLOURS[position % CHARACTER_COLOURS.length] as string;

export interface CharacterAppearance {
  /** Story index of the scene. */
  index: number;
  beatIds: BeatId[];
}

export interface CharacterThread {
  name: string;
  color: string;
  appearances: CharacterAppearance[];
}

export interface ThreadLayout {
  spans: StorySpan[];
  lanes: Lane[];
  characters: CharacterThread[];
  arcs: TimelineArc[];
  /** Who speaks in each beat, so a beat can be coloured by its cast. */
  speakers: Map<BeatId, string[]>;
  /** Colour by character name, for anything that draws a cast. */
  colours: Map<string, string>;
}

export const threadLayout = (file: ProjectFile): ThreadLayout => {
  const layout = storyLayout(file);
  const speakers = new Map<BeatId, string[]>();
  const order: string[] = [];
  const appearances = new Map<string, CharacterAppearance[]>();

  for (const span of layout.spans) {
    for (const beat of beatsForUnit(file, span.unit.id)) {
      const names = speakersIn(beat);
      speakers.set(beat.id, names);
      for (const name of names) {
        if (!order.includes(name)) order.push(name);
        const list = appearances.get(name) ?? [];
        const last = list[list.length - 1];
        if (last && last.index === span.index) last.beatIds.push(beat.id);
        else list.push({ index: span.index, beatIds: [beat.id] });
        appearances.set(name, list);
      }
    }
  }

  // Characters the writer has created but who have not spoken yet still get
  // a colour, after those who have, so their first line does not reshuffle
  // everyone else.
  for (const character of file.characters) {
    const name = character.name.trim().toUpperCase();
    if (name.length > 0 && !order.includes(name) && !character.archived) order.push(name);
  }

  const colours = new Map(order.map((name, position) => [name, characterColour(position)]));
  const characters: CharacterThread[] = order
    .filter((name) => (appearances.get(name) ?? []).length > 0)
    .map((name) => ({ name, color: colours.get(name) as string, appearances: appearances.get(name) ?? [] }));

  return { spans: layout.spans, lanes: layout.lanes, characters, arcs: timelineArcs(file), speakers, colours };
};
