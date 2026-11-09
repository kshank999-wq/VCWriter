import type { ProjectFormat } from '@vcwriter/domain';

/**
 * What each module's promotion page says (vc-writer.com/write/<slug>).
 *
 * The card itself — its name, its parts and what it is for — is the domain's
 * `FORMAT_CARDS`, the list the desktop's New project screen draws, so the site
 * cannot offer a module the program does not have. This is the page behind
 * the card: why a writer of that kind of work would want it.
 *
 * A game is built in VC Game Studio and has no page here.
 */
export interface ModulePage {
  readonly format: ProjectFormat;
  readonly slug: string;
  readonly headline: string;
  readonly intro: string;
  readonly strengths: ReadonlyArray<{ readonly title: string; readonly body: string }>;
  /** The rooms and tools this module opens, as a short list. */
  readonly rooms: ReadonlyArray<string>;
  /**
   * The house styles this module sets its pages in, listed on its page (from
   * Ken: *list the formats that you can do a stage play in, all the major
   * formats*). Each is one the program offers under Page setup, described as
   * the program describes it.
   */
  readonly formats?: ReadonlyArray<{ readonly name: string; readonly body: string }>;
}

const SHARED_ROOMS = ['Research', 'Story Sculptor', 'Outliner', 'Notes from your phone', 'Read back'];

/**
 * Where each thing in *What comes with it* is promoted, so the boxes are
 * links. One with no page of its own stays a plain box rather than a
 * dead link.
 */
export const ROOM_LINKS: Readonly<Record<string, string>> = {
  Research: '/tools/research',
  'Story Sculptor': '/tools/story-sculptor',
  Outliner: '/tools/outliner',
  'Notes from your phone': '/notes',
  'Read back': '/tools/read-back',
  Citations: '/tools/citations',
  Storyboard: '/tools/storyboard',
  'Writers Room': '/writers-room',
  'Character Creator': '/tools/character-creator',
  Layout: '/layout',
  'eBook export': '/layout#ebook',
};

export const MODULE_PAGES: ReadonlyArray<ModulePage> = [
  {
    format: 'screenplay',
    slug: 'screenplay',
    headline: 'Write the film, not the formatting.',
    intro:
      'Industry-standard screenplay pages from the first keystroke. Return and Tab move through scene heading, action, character and dialogue the way working writers expect, and the structure behind the pages stays in view the whole time.',
    strengths: [
      {
        title: 'Pages that are ready to send',
        body: 'US single-camera, multi-camera and BBC house styles, a real title page, and page counts you can trust for screen time.',
      },
      {
        title: 'Acts, sequences, scenes and beats',
        body: 'Plot tracks hold your scenes and every beat lives inside one. Move a scene and its writing, research and links move with it.',
      },
      {
        title: 'Setups and payoffs, tracked',
        body: 'Mark a setup and the payoff it earns. Anything you have not delivered stays on the list until you do.',
      },
      {
        title: 'Hear the scene played',
        body: 'Give each character a voice and let the scene play back as a conversation, with a separate voice for the action lines.',
      },
    ],
    rooms: [...SHARED_ROOMS, 'Character Creator', 'Writers Room'],
  },
  {
    format: 'series',
    slug: 'series',
    headline: 'One show, every episode, in one place.',
    intro:
      'Episodes across a season, written in screenplay form, with the characters, threads and research that run through the whole series kept in one project instead of a folder of separate scripts.',
    strengths: [
      {
        title: 'Episodes as the unit',
        body: 'Each episode has its own scenes and beats, and the season reads top to bottom in the Outliner.',
      },
      {
        title: 'Threads that cross episodes',
        body: 'Plant a setup in episode two and pay it off in episode seven. The list of open threads covers the whole season.',
      },
      {
        title: 'One bible',
        body: 'Characters, locations and research are shared by every episode, so a change made once is right everywhere.',
      },
      {
        title: 'A room for the staff',
        body: 'Writers Room adds shared access, submissions and review when more than one writer is working on the show.',
      },
    ],
    rooms: [...SHARED_ROOMS, 'Character Creator', 'Writers Room'],
  },
  {
    format: 'novel',
    slug: 'novel',
    headline: 'From the first idea to the finished book.',
    intro:
      'Manuscript formatting while you draft, a structure you can see and reorder, and a Layout room that sets the finished book for print and for eBook when you are done.',
    strengths: [
      {
        title: 'Chapters and passages',
        body: 'Write in passages, gather them into chapters, and reorder either without losing a word or a link.',
      },
      {
        title: 'Characters that stay consistent',
        body: 'The Character Creator keeps who each person is, what they want and where they appear, linked to the passages that use them.',
      },
      {
        title: 'Lay out the book',
        body: 'Pick a trim size and the Layout room sets the margins, headers, page numbers, chapter openings and front and back matter.',
      },
      {
        title: 'eBook export',
        body: 'One EPUB, checked against the rules of the store it is going to, from the same laid-out book.',
      },
    ],
    rooms: [...SHARED_ROOMS, 'Character Creator', 'Layout', 'eBook export'],
  },
  {
    format: 'instructional',
    slug: 'instructional',
    headline: 'Nonfiction, textbooks and reference, organised.',
    intro:
      'Chapters and sections, a research shelf for sources, graphics and notes, citations that format themselves, and the learning aids an instructional book needs.',
    strengths: [
      {
        title: 'Chapters and sections',
        body: 'Plan the book in the Outliner, then write each section with its graphics placed right in the manuscript.',
      },
      {
        title: 'Citations and references',
        body: 'Keep your sources in a references library and cite them as you write. The bibliography follows the style you choose.',
      },
      {
        title: 'Index and table of contents',
        body: 'Mark index terms as you go and build the contents page and index from the book itself.',
      },
      {
        title: 'Learning aids',
        body: 'Summaries, key terms and review questions at the end of a section, kept with the section they belong to.',
      },
    ],
    rooms: ['Research', 'Story Sculptor', 'Outliner', 'Notes from your phone', 'Layout', 'eBook export'],
  },
  {
    format: 'stage_play',
    slug: 'stage-play',
    headline: 'Plays and musicals, set the way the stage sets them.',
    intro:
      'A stage page rather than a film page. Choose the house style your theatre or publisher uses, and write songs, lyrics and dance alongside the dialogue in a musical.',
    strengths: [
      {
        title: 'Seven stage formats',
        body: 'Pick the formatting your theatre or publisher expects from a list, and the cues, directions and margins follow.',
      },
      {
        title: 'Musicals built in',
        body: 'Song titles, lyrics, music cues and dance are their own kinds of line, each set the way a musical page sets it.',
      },
      {
        title: 'Cast page and title page',
        body: 'A cast list and a title page built from the play itself, kept current as characters come and go.',
      },
      {
        title: 'Acts and scenes',
        body: 'Structure the play in acts and scenes and reorder them freely; the writing goes with them.',
      },
    ],
    rooms: [...SHARED_ROOMS, 'Character Creator'],
    formats: [
      { name: 'US modern play', body: 'The Dramatists Guild’s modern layout: the character’s name centred over the speech, and stage directions in a narrower column to the right.' },
      { name: 'US traditional play', body: 'The older American layout: the name centred over a narrower speech, with stage directions set apart as their own indented block.' },
      { name: 'US publisher reading copy', body: 'A compact reading copy in the Samuel French manner, with the name set in from the left rather than centred.' },
      { name: 'UK BBC stage', body: 'A4, after the BBC Writersroom stage sample: the name at the left with the speech on the same line, and directions in capitals.' },
      { name: 'UK contemporary play', body: 'A4, the common British side-by-side layout: the name at the left and the speech in a column beside it.' },
      { name: 'Continental reading copy', body: 'A4 for European theatres, the role at the left with the speech as a block beside it, and adjustable to the house’s own rules.' },
      { name: 'US musical', body: 'The modern play with songs: each number’s title centred, and lyrics in capitals in a narrower column so sung words stand apart from spoken.' },
    ],
  },
  {
    format: 'short_story',
    slug: 'short-stories',
    headline: 'One story, or a whole collection.',
    intro:
      'Write a single story, or gather many into one project and set them as a book, each story opening like a chapter with its own place in the contents.',
    strengths: [
      {
        title: 'A collection in one project',
        body: 'Write stories in the workspace or bring them in from documents, one story each, and arrange the order.',
      },
      {
        title: 'Set as a book',
        body: 'The Layout room treats each story as a chapter, with the contents page listing them all.',
      },
      {
        title: 'Notes per story',
        body: 'Notes dictated on your phone can be filed to the story they belong to.',
      },
      {
        title: 'Ready for eBook',
        body: 'Export the collection as one EPUB, checked for the store you are publishing to.',
      },
    ],
    rooms: [...SHARED_ROOMS, 'Layout', 'eBook export'],
  },
  {
    format: 'short_form',
    slug: 'short-form',
    headline: 'Commercials, web video and social, timed to the second.',
    intro:
      'Short form is written in the two-column form the business uses: what is heard on one side, what is seen on the other, a frame beside each row and a running time against it.',
    strengths: [
      {
        title: 'The AV sheet',
        body: 'Audio and visual side by side, row by row, measured in seconds rather than pages.',
      },
      {
        title: 'A storyboard above it',
        body: 'A frame for every row, so the board and the script are the same document.',
      },
      {
        title: 'Running time that adds up',
        body: 'Each row carries its duration, and the spot shows its total as you write.',
      },
      {
        title: 'Same research, same editors',
        body: 'Everything else in VC Writer is still there: research, notes from your phone and both editors.',
      },
    ],
    rooms: ['Research', 'Outliner', 'Notes from your phone', 'Storyboard'],
  },
  {
    format: 'document',
    slug: 'document',
    headline: 'A word processor that knows about your other projects.',
    intro:
      'Letters, reports, essays and notes in a familiar word processor, with the research and phone notes of VC Writer beside it and every document filed into the project it belongs to.',
    strengths: [
      {
        title: 'Everything you expect',
        body: 'Styles, headers and footers, page numbers, footnotes and endnotes, a table of contents, comments and tracked changes.',
      },
      {
        title: 'Word in and out',
        body: 'Open a .docx and save one back, with the formatting intact.',
      },
      {
        title: 'Research beside the page',
        body: 'Your research and notes from your phone open next to the document, ready to place on the page.',
      },
      {
        title: 'Dictate and hear it back',
        body: 'Speak a paragraph into the page, and have the document read aloud to you.',
      },
    ],
    rooms: ['Research', 'Notes from your phone', 'Citations', 'Read back'],
  },
];

export const moduleBySlug = (slug: string): ModulePage | undefined =>
  MODULE_PAGES.find((page) => page.slug === slug);

export const moduleForFormat = (format: ProjectFormat): ModulePage | undefined =>
  MODULE_PAGES.find((page) => page.format === format);
