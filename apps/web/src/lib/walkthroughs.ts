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
  {
    slug: 'short-stories',
    label: 'See how a collection comes together',
    title: 'Short stories in six easy steps',
    steps: [
      {
        title: 'Start a story, or a collection',
        body: 'Write one short story, or gather several into a collection. Press + Story and the next one starts on its own, in order along the track.',
        shot: 'modules/short-stories',
        alt: 'A collection of three stories on the track, beside the manuscript',
      },
      {
        title: 'Plan each story',
        body: 'List each story and the passages in it, a line apiece. Tab tucks a line under the one above; drag a story or a passage to change the order.',
        shot: 'help/short-stories-outliner',
        alt: 'The Outliner: three stories, their passages and beats, each level its own colour',
      },
      {
        title: 'Write each passage',
        body: 'Open a passage and write it on a clean page, with its notes beside you. Each story keeps its own title and its own sections.',
        shot: 'help/short-stories-writer',
        alt: 'A passage of a story open for writing',
      },
      {
        title: 'Bring in stories you have written',
        body: 'Already have stories finished? Import them, one document per story, and each comes in as a story of its own, in the order you choose.',
        shot: 'help/import-collection',
        alt: 'Import, with A collection of short stories: one document per story',
      },
      {
        title: 'Polish it',
        body: 'The Daily editor flags grammar and style as you go, with a fix you can take or leave, across every story at once. The writing stays yours.',
        shot: 'help/short-stories-editors',
        alt: 'The Daily editor’s notes across the collection, each with a fix',
      },
      {
        title: 'Set the collection as a book',
        body: 'Layout sets the collection as a book: each story opens like a chapter, with a contents page that lists them. Print a ready-to-print PDF, or publish it as an eBook.',
        shot: 'help/short-stories-layout',
        alt: 'The collection set as a book, open at the first story',
      },
    ],
  },
  {
    slug: 'series',
    label: 'See how a series comes together',
    title: 'A series in six easy steps',
    steps: [
      {
        title: 'Plan the season',
        body: 'List your episodes, and under each one its scenes and beats, a line apiece. Tab tucks a line under the one above; drag to change the order.',
        shot: 'help/series-outliner',
        alt: 'The Outliner: a season of episodes with their scenes and beats',
      },
      {
        title: 'Every episode on one track',
        body: 'The episodes stand in order along the track, beside the script. The timeline underneath shows which characters appear in each, across the whole season.',
        shot: 'modules/series',
        alt: 'The season on the track, with the timeline showing each character across the episodes',
      },
      {
        title: 'Write each scene',
        body: 'Open a scene and write it on a clean page, with its notes beside you. Return and Tab move between heading, action, character and dialogue, as in Final Draft.',
        shot: 'help/series-writer',
        alt: 'A scene of an episode open for writing',
      },
      {
        title: 'It becomes a script',
        body: 'Everything you write is set as a screenplay for you, with a contents page listing every episode and how long it runs. Print it or save it as a PDF.',
        shot: 'help/series-preview',
        alt: 'The series contents page: each episode with its length',
      },
      {
        title: 'Keep your cast straight',
        body: 'Every character has a page of their own: who they are, their part in the story, their arc and their relationships, so a season of episodes stays true to them.',
        shot: 'help/series-characters',
        alt: 'The Character Creator with Holmes open',
      },
      {
        title: 'Polish every episode',
        body: 'The Daily editor flags grammar and style across the whole season, with a fix you can take or leave. The Final editor asks what a story editor would. The writing stays yours.',
        shot: 'help/series-editors',
        alt: 'The Daily editor’s notes across the season, each with a fix',
      },
    ],
  },
  {
    slug: 'stage-play',
    label: 'See how a play comes together',
    title: 'A stage play in six easy steps',
    steps: [
      {
        title: 'Plan your acts and scenes',
        body: 'List your acts, the scenes in each and what happens in them, a line apiece. Tab tucks a line under the one above; drag to change the order.',
        shot: 'help/stage-outliner',
        alt: 'The Outliner: Act One’s scenes and beats, and Act Two begun',
      },
      {
        title: 'See the whole play',
        body: 'Your scenes line up in order along the track, beside the script, and the timeline underneath shows who is on stage in each.',
        shot: 'modules/stage-play',
        alt: 'The play’s scenes on the track, with the script and the cast’s timeline',
      },
      {
        title: 'Write each scene',
        body: 'Open a scene and write. Character names, speeches and stage directions each fall into place as you type: Return for the next line, Tab to change what it is.',
        shot: 'help/stage-writer',
        alt: 'A scene of the play open for writing, set as a stage page',
      },
      {
        title: 'Choose your house style',
        body: 'Pick the format your theatre or publisher expects: US modern, US traditional, a publisher’s reading copy, UK BBC, UK contemporary, Continental or a US musical. The whole script moves at once.',
        shot: 'help/stage-house-style',
        alt: 'Page setup: the seven stage house styles, each with a sample page',
      },
      {
        title: 'Add a cast page',
        body: 'The cast list builds itself from the play. Add a line about each role, a playing age and any doubling, with the time and place, and it prints after the title page.',
        shot: 'help/stage-cast-page',
        alt: 'The cast page: each role with a description and playing age, the time and the place',
      },
      {
        title: 'It becomes a script',
        body: 'Everything you write is set as a stage script for you, on proper pages. Print it or save it as a PDF to send to a theatre.',
        shot: 'help/stage-preview',
        alt: 'The play as printed stage pages',
      },
    ],
  },
];

export const walkthroughBySlug = (slug: string): Walkthrough | undefined => WALKTHROUGHS.find((one) => one.slug === slug);
