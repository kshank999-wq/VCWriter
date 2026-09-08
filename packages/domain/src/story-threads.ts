import { beatsForUnit } from './selectors.js';
import { storyLayout, timelineArcs, type StoryLayout, type StorySpan, type TimelineArc } from './story-layout.js';
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

/**
 * A theme, and where it is at work. Unlike a character, a theme leaves no
 * trace in the text, so this is the one thread the writer draws themselves:
 * it runs through the scenes and beats the theme is linked to (§7.4).
 */
export interface ThemeThread {
  id: string;
  name: string;
  color: string;
  appearances: CharacterAppearance[];
}

export interface ThreadLayout {
  spans: StorySpan[];
  lanes: Lane[];
  characters: CharacterThread[];
  themes: ThemeThread[];
  arcs: TimelineArc[];
  /** Who speaks in each beat, so a beat can be coloured by its cast. */
  speakers: Map<BeatId, string[]>;
  /** Colour by character name, for anything that draws a cast. */
  colours: Map<string, string>;
}

/** Themes are drawn in the lane palette; they are of the story, not of a cast. */
const THEME_COLOURS = ['#c9a45c', '#8b1c1c', '#5b7fa6', '#7a9e7e', '#8a6f9e', '#a67c52', '#6f8f9e'] as const;

/**
 * `base` lets a caller that already computed the story layout and the arcs
 * — the workspace computes each once per document — hand them in instead
 * of paginating the whole manuscript a second and third time.
 */
export const threadLayout = (
  file: ProjectFile,
  base: { layout?: StoryLayout; arcs?: TimelineArc[] } = {},
): ThreadLayout => {
  const layout = base.layout ?? storyLayout(file);
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

  return {
    spans: layout.spans,
    lanes: layout.lanes,
    characters,
    themes: themeThreads(file, layout),
    arcs: base.arcs ?? timelineArcs(file),
    speakers,
    colours,
  };
};

/**
 * The themes the writer keeps in research, and the scenes they are linked
 * to — directly, or through a beat in the scene.
 */
const themeThreads = (file: ProjectFile, layout: StoryLayout): ThemeThread[] => {
  const themeCategories = new Set(
    file.researchCategories.filter((category) => category.systemKey === 'themes').map((category) => category.id as string),
  );
  if (themeCategories.size === 0) return [];

  const sceneOfBeat = new Map<string, number>();
  const sceneOfUnit = new Map<string, number>();
  for (const span of layout.spans) {
    sceneOfUnit.set(span.unit.id, span.index);
    for (const beat of beatsForUnit(file, span.unit.id)) sceneOfBeat.set(beat.id, span.index);
  }

  const threads: ThemeThread[] = [];
  const items = file.researchItems.filter((item) => !item.archived && themeCategories.has(item.categoryId));

  items.forEach((item, position) => {
    const indexes = new Set<number>();
    for (const link of file.links) {
      for (const [side, other] of [
        [link.from, link.to],
        [link.to, link.from],
      ] as const) {
        if (side.type !== 'research_item' || side.id !== item.id) continue;
        const index = other.type === 'unit' ? sceneOfUnit.get(other.id) : other.type === 'beat' ? sceneOfBeat.get(other.id) : undefined;
        if (index !== undefined) indexes.add(index);
      }
    }
    if (indexes.size === 0) return;
    threads.push({
      id: item.id,
      name: item.title,
      color: THEME_COLOURS[position % THEME_COLOURS.length] as string,
      appearances: [...indexes].sort((a, b) => a - b).map((index) => ({ index, beatIds: [] })),
    });
  });

  return threads;
};
