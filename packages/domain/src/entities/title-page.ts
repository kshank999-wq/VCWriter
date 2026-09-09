import { z } from 'zod';
import type { Project, ProjectSettings } from './project.js';

/**
 * The title page (spec §6.1).
 *
 * Its own module because two things carry one: the project, and — in a
 * series — each episode (addendum 02 §17). Keeping it here lets the
 * structure describe an episode's page without the two entity modules
 * importing each other.
 */

/**
 * What a title page carries (spec §6.1).
 *
 * The industry page and nothing beyond it, in the order a reader's eye takes
 * it: the title, which episode this is, who wrote it, what it was written
 * from, how to reach them, which draft this is, and any note the front page
 * has to carry.
 *
 * Everything is optional. A first draft with a title and a name on it is a
 * proper title page; the rest is for when it goes out.
 */
export const titlePageSchema = z.object({
  /** Empty means the project's own title, which is the usual case. */
  title: z.string().default(''),
  /**
   * A logotype in place of the typed title — a data URI, held in the project
   * so the page travels with the file rather than pointing at a folder on one
   * machine. When it is set, the title text is not printed: the graphic *is*
   * the title.
   */
  titleImage: z.string().default(''),
  /** "Episode 4 — The Lamp". Under the title, where a series puts it. */
  episode: z.string().default(''),
  /**
   * Who wrote it. The page sets the words **Written** and **by** on their own
   * lines above this, so the field holds the *name* and nothing else — which
   * is why there is no separate credit field to fill in the same thing twice.
   *
   * Empty means the project's author.
   */
  author: z.string().default(''),
  /**
   * What it was written from: "based on the novel", "an original story". The
   * line without the name — the name goes under it, the same way the author
   * goes under "Written by".
   */
  source: z.string().default(''),
  /** Who wrote the source. Printed on the line under it, as "by <name>". */
  sourceAuthor: z.string().default(''),
  /** Agent, address, telephone, email. Bottom left, as many lines as needed. */
  contact: z.string().default(''),
  /** "12 March 2026". Bottom right, above the revision. */
  draftDate: z.string().default(''),
  /** "Second draft", "Blue pages". Bottom right. */
  revision: z.string().default(''),
  /** Anything else the front page must say. Bottom right, under the rest. */
  notes: z.string().default(''),
});
export type TitlePage = z.infer<typeof titlePageSchema>;

/** A cap on the logotype: the project is a text file with a picture in it. */
export const MAX_TITLE_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * A source line without its trailing "by".
 *
 * The page prints **by** on a line of its own above the name, so a writer who
 * types "based on the novel by" out of habit must not get it twice.
 */
export const withoutBy = (text: string): string => text.trim().replace(/\s+by$/i, '').trim();

/**
 * An episode's page over the series', field by field rather than whole: an
 * episode that names only its own number and date should still carry the
 * series' credit, contact and logotype without them being typed again.
 */
const prunedEmpty = (page: TitlePage): Partial<TitlePage> =>
  Object.fromEntries(Object.entries(page).filter(([, value]) => String(value).trim().length > 0));

/**
 * The page as it will print: the writer's own words where they gave them, the
 * project's where they did not.
 *
 * `own` is an episode's page, where one is being asked for. An episode that
 * has never been filled in falls back to the series' page rather than to
 * nothing: a new episode is not a blank front page, it is the series' with
 * this episode's number on it.
 */
export const titlePageOf = (
  project: Project,
  settings: ProjectSettings,
  own?: TitlePage | null,
): TitlePage => {
  const series = titlePageSchema.parse(settings.titlePage ?? {});
  const page = own ? titlePageSchema.parse({ ...series, ...prunedEmpty(own) }) : series;
  return {
    title: page.title.trim() || project.title,
    titleImage: page.titleImage,
    episode: page.episode.trim(),
    author: page.author.trim() || project.author,
    source: withoutBy(page.source),
    sourceAuthor: page.sourceAuthor.trim(),
    contact: page.contact.trim(),
    draftDate: page.draftDate.trim(),
    revision: page.revision.trim(),
    notes: page.notes.trim(),
  };
};
