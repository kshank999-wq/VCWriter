/**
 * The module cards: the grid a writer chooses a project type from.
 *
 * **One list, read in two places** (addendum 35 §7). The desktop's New project
 * screen draws it, and so does the module chooser on vc-writer.com, so the
 * site can never show a card the program does not have, in another order, or
 * describe one differently. The name comes from `formatName` and the parts
 * from `nounsFor`; what stays written here is the order and what each format
 * is *for*, which a table of nouns cannot know.
 */
import {
  formatName,
  isWordProcessor,
  nounsFor,
  startsHere,
} from './formats.js';
import type { ProjectFormat } from './entities/project.js';

export interface FormatCard {
  readonly value: ProjectFormat;
  readonly about: string;
}

export const FORMAT_CARDS: ReadonlyArray<FormatCard> = [
  { value: 'screenplay', about: 'industry formatting' },
  { value: 'series', about: 'episodes across a series' },
  { value: 'novel', about: 'manuscript formatting' },
  { value: 'instructional', about: 'academic, reference and nonfiction' },
  // **Kept, and no longer a choice** (addendum 30): a game is built in VC Game
  // Studio, so this card is the door to it, drawn outside the grid by the
  // desktop and not at all by the site. `startsHere` is what leaves it out.
  { value: 'game', about: 'branching, choices and consequences' },
  { value: 'stage_play', about: '' },
  // One story or many: each is a marker over its sections, and the Layout
  // room sets the collection as a book (addendum 22).
  { value: 'short_story', about: 'one story, or a collection set as a book' },
  { value: 'short_form', about: 'commercials, web video, social' },
  // A word processor, for everything that is not a story's manuscript
  // (addendum 42).
  { value: 'document', about: 'A word processor: letters, reports, essays and notes, filed into your other projects' },
];

/** The cards a project can be started from, in the grid's order. */
export const startableFormatCards = (): ReadonlyArray<FormatCard> =>
  FORMAT_CARDS.filter((card) => startsHere(card.value));

/** The card's second line: its parts, then what it is for. */
export const formatCardDetail = (card: FormatCard): string => {
  // A document has no parts to list; what it is for says more.
  if (isWordProcessor(card.value)) return card.about;
  const nouns = nounsFor(card.value);
  const parts = `${nouns.unitPlural} and ${nouns.subPlural.toLowerCase()}`;
  return card.about.length > 0 ? `${parts}, ${card.about}` : parts;
};

/** The card's first line. */
export const formatCardName = (card: FormatCard): string => formatName(card.value);
