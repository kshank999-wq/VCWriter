import type { ShotPath } from './help/types';

/**
 * The rooms and tools, each promoted on a page of its own
 * (vc-writer.com/tools/<slug>; addendum 35 §11). From Ken: *we need to also
 * have screenshots and instructionals and promotionals for the research, the
 * outliner, the sculptor, and all those other ones.*
 *
 * Every claim here is one the guide for the same tool makes (the guides were
 * written against the code), and every picture is the program's own, from
 * scripts/shots. Layout has its own page (/layout) and the phone app its own
 * (/notes); the chooser links to both.
 */
export interface ToolFeature {
  readonly title: string;
  readonly body: string;
  readonly shot?: ShotPath;
  readonly shotAlt?: string;
}

export interface ToolPage {
  readonly slug: string;
  readonly name: string;
  /** One line for the chooser card. */
  readonly card: string;
  readonly headline: string;
  readonly intro: string;
  readonly shot: ShotPath;
  readonly shotAlt: string;
  readonly features: ReadonlyArray<ToolFeature>;
  /** The guide on /help with the steps. */
  readonly guide: string;
}

export const TOOL_PAGES: ReadonlyArray<ToolPage> = [
  {
    slug: 'research',
    name: 'Research',
    card: 'Notes, folders, characters, places and threads, connected to the writing.',
    headline: 'Research that stays connected to the story.',
    intro:
      'Every note, clipping, place and character lives in Research, filed in folders of your own. Nothing is a copied-out note: it knows which scenes use it, and it tells you what you have not used yet.',
    shot: 'help/research',
    shotAlt: 'The Research room: folders of notes beside the outline',
    features: [
      {
        title: 'Used and not used, tracked for you',
        body: 'A note counts as used once it is on the track. Cut the beat it went into and it goes back to Not yet used by itself, so nothing you gathered is ever lost.',
      },
      {
        title: 'Rewrite a note, then place it',
        body: 'Open a rough note beside a clean page: the original on one side, your rewrite on the other. Then place it on the track — or, in a document, on the page where your cursor is.',
        shot: 'help/research-note',
        shotAlt: 'A note open in the rewrite screen, the original beside the rewrite',
      },
      {
        title: 'Setups and payoffs, counted',
        body: 'Name a payoff and mark the setups that earn it. Each one is placed on a scene, and the payoff stays on the active list until you deliver it.',
        shot: 'help/setups-payoffs',
        shotAlt: 'Setups and payoffs: a payoff with its setups placed on scenes',
      },
      {
        title: 'Notes from your phone',
        body: 'Ideas dictated into VC Writer Notes arrive titled, dated and sorted into the folder they belong to, ready to rewrite and use.',
      },
    ],
    guide: 'research',
  },
  {
    slug: 'story-sculptor',
    name: 'Story Sculptor',
    card: 'Map the story: acts, plot points, scenes, characters and what causes what.',
    headline: 'See the whole story on one map.',
    intro:
      'The Story Sculptor is a map of your story: frames for acts, cards for plot points, scenes and beats, your cast placed where they matter, and links that say what causes what. Explode a branch to see inside it, collapse it to see the shape.',
    shot: 'help/sculptor',
    shotAlt: 'The Story Sculptor: acts, plot points, scenes and the cast, linked',
    features: [
      {
        title: 'Cards of every kind',
        body: 'Frames, plot points, scenes, characters, actions, beats, notes and kinds of your own, nested inside each other as deep as the story goes.',
      },
      {
        title: 'Links that mean something',
        body: 'Connect two cards and say how: one causes another, sets it up, is in conflict with it or influences it. Hide the kinds you are not looking at.',
      },
      {
        title: 'Your outline, beside the map',
        body: 'Open the Outliner next to the map and drag any act, chapter, scene or beat onto the board, where it becomes a linked card.',
        shot: 'help/sculptor-outliner',
        shotAlt: 'The Story Sculptor with the Outliner open beside the map',
      },
      {
        title: 'Export and share',
        body: 'Save the map as a PNG or a PDF to print or send, or as JSON to bring into another project.',
      },
    ],
    guide: 'story-sculptor',
  },
  {
    slug: 'outliner',
    name: 'Outliner',
    card: 'Plan in rows, then send them to the track when you are ready.',
    headline: 'Plan first. Write when you are ready.',
    intro:
      'The Outliner is where a story is planned before it is written: scenes, beats and notes in rows you can indent, move and reorder at the speed you think. When a row is ready, add it to the track and it becomes the real scene.',
    shot: 'help/outliner',
    shotAlt: 'The Outliner: scenes and beats in rows, research on the left',
    features: [
      {
        title: 'Rows at the speed of thought',
        body: 'Type a row, press Return for the next and Tab to tuck it under the one above. Your research sits on a shelf at the left, ready to drag in.',
      },
      {
        title: 'The plan and the script, side by side',
        body: 'A dot on each row says whether it is on the track yet. Add one row, or Add all to track, and every scene lands where it belongs.',
      },
      {
        title: 'A season, or a book',
        body: 'A series is planned episode by episode; an instructional book in chapters, sections and subsections, each numbered as it will print.',
        shot: 'help/instructional-outliner',
        shotAlt: 'The book outliner: chapters, sections and subsections, numbered',
      },
    ],
    guide: 'outliner',
  },
  {
    slug: 'character-creator',
    name: 'Character Creator',
    card: 'Who each person is, what they want, and where they appear.',
    headline: 'Characters who stay themselves.',
    intro:
      'The Character Creator keeps each person in one place: their role in the story, their traits and the moments that show them, their arc and their relationships — linked to the scenes they are in, so a change made once is right everywhere.',
    shot: 'help/character-creator',
    shotAlt: 'The Character Creator with a character open',
    features: [
      {
        title: 'Overview, traits, arc, relationships',
        body: 'Four tabs for a character: who they are, the traits and the moments that show them, how they change, and who they are to everyone else.',
      },
      {
        title: 'Linked to the writing',
        body: 'Speeches and scenes are counted from the script, and what you planned for a character turns up on the scenes it was meant for.',
      },
    ],
    guide: 'character-creator',
  },
  {
    slug: 'editors',
    name: 'The two editors',
    card: 'A daily pass for mechanics, and a final pass that reads like a story editor.',
    headline: 'Two editors: one for the sentence, one for the story.',
    intro:
      'The Daily editor checks grammar, mechanics, readability and style as you go. The Final editor reads each scene as a mini-story and asks what a story editor would: what is at stake, which way it moves, and what the scene would lose without it.',
    shot: 'help/editors',
    shotAlt: 'The Daily editor with style notes on the manuscript',
    features: [
      {
        title: 'Daily: the mechanics',
        body: 'Each finding shows the words in place with a fix you can take, all of them at once, or leave. Turn off a rule you do not want.',
      },
      {
        title: 'Final: the story',
        body: 'A grid of every scene: what is at stake, how it turns, and why it is there. Questions, not rewrites — the writing stays yours.',
        shot: 'help/editors-final',
        shotAlt: 'The Final editor: questions about each chapter and the scene grid',
      },
    ],
    guide: 'editors',
  },
  {
    slug: 'read-back',
    name: 'Read back',
    card: 'Hear the scene played, with a voice for every character.',
    headline: 'Hear it before anyone else does.',
    intro:
      'Read back plays your script or manuscript aloud. Give each character a voice of their own and a narrator for the action, and a scene plays as a conversation — the fastest way to hear a line that does not work.',
    shot: 'help/read-back',
    shotAlt: 'Read back playing a scene, with a voice chosen for each character',
    features: [
      {
        title: 'A voice for every character',
        body: 'Choose the voices yourself or let it suggest a cast. The narrator reads the action and the prose.',
      },
      {
        title: 'From any line',
        body: 'Play the scene you are in or the whole project, at the speed you like, and click a line to start from there.',
      },
    ],
    guide: 'read-back',
  },
  {
    slug: 'preview',
    name: 'Preview',
    card: 'The pages exactly as they will print, ready to print or export.',
    headline: 'The pages, exactly as they will print.',
    intro:
      'Preview shows the whole script or book page for page, as it will come off the printer — and prints it, or saves it as a PDF, from there.',
    shot: 'help/preview',
    shotAlt: 'Preview of a screenplay, page by page',
    features: [
      {
        title: 'Every format, set properly',
        body: 'Screenplay pages, a stage page, a double-spaced manuscript, or a short-form AV sheet with its timings.',
        shot: 'help/short-form-preview',
        shotAlt: 'Preview of a short-form AV sheet with timings',
      },
    ],
    guide: 'preview',
  },
  {
    slug: 'focus',
    name: 'Focus mode',
    card: 'The page and nothing else.',
    headline: 'The page, and nothing else.',
    intro: 'Focus mode clears everything away but the writing. One key in, one key out.',
    shot: 'help/focus',
    shotAlt: 'Focus mode: the page alone',
    features: [],
    guide: 'focus',
  },
];

export const toolBySlug = (slug: string): ToolPage | undefined => TOOL_PAGES.find((tool) => tool.slug === slug);
