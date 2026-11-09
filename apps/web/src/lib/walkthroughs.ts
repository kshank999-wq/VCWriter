import type { ShotPath } from './help/types';

/**
 * **A workflow anyone can follow, a step at a time** (addendum 35 §14, from
 * Ken: *you click the workflow but it'll show you a box with you create the
 * scene, then the beat, and then it writes the screenplay for you. You can
 * reorder things. Decide whether your scenes are working with the plus
 * minus features … a simple workflow for advertising so people feel that
 * it's not intimidating*).
 *
 * Each step is one thing a writer does, said in a line, with the program's
 * own picture of it. Every claim is one the program makes good: it builds and
 * formats the screenplay from what the writer writes — it does not write the
 * writer's words, and nothing here says it does.
 */
export interface WalkthroughStep {
  readonly title: string;
  readonly body: string;
  readonly shot: ShotPath;
  readonly alt: string;
}

export interface Walkthrough {
  readonly slug: string;
  /** What the button says. */
  readonly label: string;
  readonly title: string;
  readonly steps: ReadonlyArray<WalkthroughStep>;
}

export const WALKTHROUGHS: ReadonlyArray<Walkthrough> = [
  {
    slug: 'screenplay',
    label: 'See how a screenplay comes together',
    title: 'A screenplay in six easy steps',
    steps: [
      {
        title: 'Make a scene',
        body: 'Press + Scene and give it a heading: inside or outside, where, and when. That is all a scene needs to begin.',
        shot: 'help/scene-notes',
        alt: 'A scene box: its heading, its beats and where it starts and ends',
      },
      {
        title: 'Add the beats',
        body: 'Under each scene, jot down what happens, one moment to a line. These are your beats, the plan of the scene, and they sit on the track in story order.',
        shot: 'modules/screenplay',
        alt: 'Scenes and their beats on the plot track, with the script beside them',
      },
      {
        title: 'Write each beat',
        body: 'Open a beat and write it. Your notes for that moment are right beside the page, so nothing you planned gets lost.',
        shot: 'help/writer-notes',
        alt: 'A beat open for writing, with its notes down the side',
      },
      {
        title: 'It becomes a screenplay',
        body: 'Everything you write is set as a screenplay for you: scene headings, action, character names and dialogue, on proper pages. Press Return for the next line and Tab to change what it is.',
        shot: 'help/preview',
        alt: 'The script set as printed screenplay pages',
      },
      {
        title: 'Move things around',
        body: 'Change your mind as often as you like. Drag a scene or a beat to a new place and the script follows it.',
        shot: 'help/outliner',
        alt: 'The Outliner: scenes and beats in rows that can be dragged into a new order',
      },
      {
        title: 'Check every scene works',
        body: 'Mark where each scene starts and ends, up or down, plus or minus. The graph shows the shape of your story and picks out any scene that goes nowhere.',
        shot: 'help/polarity',
        alt: 'The polarity graph: each scene rising or falling, with the flat one picked out',
      },
    ],
  },
  {
    slug: 'novel',
    label: 'See how a novel comes together',
    title: 'A novel in six easy steps',
    steps: [
      {
        title: 'Plan your chapters',
        body: 'List your chapters, and under each one the passages it holds, a line apiece. Tab tucks a line under the one above; drag to change the order. Each level has its own colour.',
        shot: 'help/novel-outliner',
        alt: 'The Outliner: three chapters, their passages and beats, each level its own colour',
      },
      {
        title: 'See the whole book',
        body: 'Send the plan to the track and every chapter and passage lines up in story order, beside the manuscript. Drag a passage to a new place and the book follows.',
        shot: 'modules/novel',
        alt: 'The novel’s chapters and passages on the track beside the manuscript',
      },
      {
        title: 'Write each passage',
        body: 'Open a passage and write it on a clean page, with its notes beside you. Write in any order you like.',
        shot: 'help/novel-writer',
        alt: 'A passage of the novel open for writing',
      },
      {
        title: 'It becomes a manuscript',
        body: 'Everything you write is set as a manuscript for you, with a title page and a contents page that list every chapter. Print it or save it as a PDF to send out.',
        shot: 'help/novel-preview',
        alt: 'The manuscript’s title page and contents, ready to print',
      },
      {
        title: 'Polish it',
        body: 'The Daily editor flags grammar and style as you go, with a fix you can take or leave. The Final editor asks what a story editor would, chapter by chapter. The writing stays yours.',
        shot: 'help/editors',
        alt: 'The Daily editor’s notes on the manuscript, each with a fix',
      },
      {
        title: 'Set it as a book and publish',
        body: 'Layout turns the manuscript into a book: trim size, chapter openings, front and back pages. Print a ready-to-print PDF, or publish it as an eBook, with no other program.',
        shot: 'help/novel-layout',
        alt: 'The novel set as a book in Layout, open at chapter one',
      },
    ],
  },
];

export const walkthroughBySlug = (slug: string): Walkthrough | undefined => WALKTHROUGHS.find((one) => one.slug === slug);
