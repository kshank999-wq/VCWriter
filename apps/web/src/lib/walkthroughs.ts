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
  {
    slug: 'instructional',
    label: 'See how a nonfiction book comes together',
    title: 'An instructional book in six easy steps',
    steps: [
      {
        title: 'Plan the book',
        body: 'List your chapters, the sections in each and the subsections under them. Each is numbered as it will print, 1, 1.1, 1.1.1, and renumbers itself when you move one.',
        shot: 'help/instructional-outliner',
        alt: 'The book’s outline: chapters, sections and subsections, each numbered',
      },
      {
        title: 'Write each section',
        body: 'Write section by section, with the numbered headings set for you. Beside it, write the section’s summary, what the reader learned and review questions; tick In the book and they print at the end of the section.',
        shot: 'modules/instructional',
        alt: 'The book being written, with the section’s summary beside it marked In the book',
      },
      {
        title: 'Cite your sources',
        body: 'Keep every book, article and website in a references library. Put the cursor where it belongs and press Cite; the notes and bibliography are set in the style you choose.',
        shot: 'help/instructional-references',
        alt: 'The references library with three sources',
      },
      {
        title: 'Contents and index, built for you',
        body: 'The contents page is made from your chapters and sections, with their page numbers, and the index from the terms you mark as you write. Both keep up as the book changes.',
        shot: 'help/instructional-preview',
        alt: 'The book’s contents page, chapters and numbered sections with page numbers',
      },
      {
        title: 'Polish it',
        body: 'The Daily editor flags grammar, readability and style as you go, with a fix you can take or leave. The writing stays yours.',
        shot: 'help/instructional-editors',
        alt: 'The Daily editor’s notes on the book, each with a fix',
      },
      {
        title: 'Set it as a book and publish',
        body: 'Layout turns it into a book at a textbook size, with chapter openings and front and back pages. Print a ready-to-print PDF, or publish it as an eBook.',
        shot: 'help/instructional-layout',
        alt: 'The instructional book set as a book, open at chapter one',
      },
    ],
  },
  {
    slug: 'short-form',
    label: 'See how a commercial comes together',
    title: 'A commercial in four easy steps',
    steps: [
      {
        title: 'Plan it from the brief',
        body: 'Keep the client’s brief and the must-haves beside you, and plan the spot in a few lines: what happens, beat by beat.',
        shot: 'help/short-form-outliner',
        alt: 'The Outliner with the client brief on the shelf and the spot planned in rows',
      },
      {
        title: 'Write what is heard and what is seen',
        body: 'The two-column sheet the business uses: audio on one side, picture on the other, a row for every shot, and a frame or clip beside each.',
        shot: 'modules/short-form',
        alt: 'The AV sheet: audio and visual side by side, a storyboard frame and a duration on every row',
      },
      {
        title: 'A frame for every shot',
        body: 'Turn the same rows into a storyboard: each frame with its words and its action, timed. The board and the script are one document.',
        shot: 'help/short-form-board',
        alt: 'The storyboard: five frames, each with its dialogue, action and time',
      },
      {
        title: 'Timed to the second',
        body: 'Every row carries its length and the spot adds itself up against your limit, :15, :30 or :60, so you know before the client does. Print the sheet or the board, or send either as a PDF.',
        shot: 'help/short-form-preview',
        alt: 'The printed AV sheet with its total running time against a thirty-second limit',
      },
    ],
  },
  {
    slug: 'document',
    label: 'See how a document comes together',
    title: 'A document in five easy steps',
    steps: [
      {
        title: 'Write as you would in Word',
        body: 'Fonts, styles, headings, lists and spacing, laid out where you expect them. Letters, reports, proposals and essays, on a real page.',
        shot: 'modules/document',
        alt: 'The word processor: a proposal on the page, with the Home tab of the ribbon above it',
      },
      {
        title: 'Pictures, tables and page numbers',
        body: 'Add pictures, tables and shapes, page breaks, headers and footers and page numbers from the Insert tab.',
        shot: 'help/document-insert',
        alt: 'The Insert tab: page break, table, picture, shapes, header and footer, page numbers',
      },
      {
        title: 'Your notes beside the page',
        body: 'Open a note from your research or your phone beside the document, rewrite it, and Place on page puts it where your cursor is.',
        shot: 'help/document-place-on-page',
        alt: 'A research note open with its rewrite and the Place on page button',
      },
      {
        title: 'Review it, or hear it',
        body: 'Leave comments, track changes and accept or reject them. Dictate a paragraph instead of typing, or have the document read aloud to you.',
        shot: 'help/document-review',
        alt: 'The Review tab: comments, track changes, dictate, read aloud and spelling',
      },
      {
        title: 'Word in, Word out',
        body: 'Open a Word document and save it back as one, with its formatting. Or save a PDF or plain text, print it, or bring another file into the page.',
        shot: 'help/document-file',
        alt: 'The File tab: save, print, Word, PDF and plain text',
      },
    ],
  },
  {
    slug: 'research',
    label: 'See how Research works',
    title: 'Research in six easy steps',
    steps: [
      {
        title: 'Gather everything in one place',
        body: 'Notes, clippings, places, characters and ideas, in folders of your own. Notes you dictate on your phone arrive here too.',
        shot: 'help/research',
        alt: 'Research: folders of notes, with the story’s outline beside them',
      },
      {
        title: 'Drop notes on the story',
        body: 'Drag a note onto a scene, chapter or section in the outline beside your folders. Open that part of the story and its notes are waiting for it.',
        shot: 'help/research-filed',
        alt: 'A section opened in Research, with the notes dropped on it',
      },
      {
        title: 'Rewrite it, then use it',
        body: 'Open a note beside a clean page: the original on one side, your rewrite on the other. Then add it to the story as a beat, in the place you filed it.',
        shot: 'help/research-filed-rewrite',
        alt: 'A note open to rewrite, with Add as beat',
      },
      {
        title: 'Notes beside the scene',
        body: 'When you open a scene, its notes are listed down the side: red until you use one, green once you have. Hide the used ones to see what is left.',
        shot: 'help/scene-notes',
        alt: 'A scene box with its notes down the right, red until used',
      },
      {
        title: 'Plant it, then pay it off',
        body: 'Name a payoff and mark the setups that earn it, each placed on a scene. A payoff stays on the list until you deliver it.',
        shot: 'help/setups-payoffs',
        alt: 'Setups and payoffs, each setup placed on a scene',
      },
      {
        title: 'A page for every character',
        body: 'Who each person is, what they want, their arc and their relationships, and every scene they appear in.',
        shot: 'help/character-creator',
        alt: 'The Character Creator with a character open',
      },
    ],
  },
  {
    slug: 'outliner',
    label: 'See how the Outliner works',
    title: 'The Outliner in six easy steps',
    steps: [
      {
        title: 'Type the plan as rows',
        body: 'Type a row, press Return for the next, and Tab to tuck it under the one above. Your research sits on a shelf at the left, ready to drag in.',
        shot: 'help/outliner',
        alt: 'The Outliner: scenes and beats in rows, research on the shelf at the left',
      },
      {
        title: 'Every level its own colour',
        body: 'Chapters, sections and beats each have a colour, so the shape of the plan is clear at a glance. Fold a branch away when you do not need it.',
        shot: 'help/novel-outliner',
        alt: 'A novel’s outline, each level in its own colour',
      },
      {
        title: 'Move things around',
        body: 'Drag a row onto another to put it inside, or between two to move it. Shift-click to pick several and move them together; whatever is under a row goes with it.',
        shot: 'help/series-outliner',
        alt: 'A season of episodes planned as rows',
      },
      {
        title: 'Send it to the track',
        body: 'When the plan is ready, add a row, or Add all to track, and every scene and beat lands on the track in story order, ready to write.',
        shot: 'modules/screenplay',
        alt: 'The plan on the track, scenes and beats in order beside the script',
      },
      {
        title: 'Numbered for books',
        body: 'An instructional book is planned in chapters, sections and subsections, each numbered as it will print, renumbering itself as you move them.',
        shot: 'help/instructional-outliner',
        alt: 'A book outline: chapters, sections and subsections, numbered',
      },
      {
        title: 'Beside the story map',
        body: 'Open the Outliner next to the Story Sculptor and drag any row onto the map, where it becomes a card.',
        shot: 'help/sculptor-outliner',
        alt: 'The Outliner open beside the Story Sculptor',
      },
    ],
  },
  {
    slug: 'story-sculptor',
    label: 'See how the Story Sculptor works',
    title: 'The Story Sculptor in three easy steps',
    steps: [
      {
        title: 'See the whole story on one map',
        body: 'Frames for acts, cards for plot points, scenes and beats, and your cast placed where they matter. Link two cards and say how: one causes the other, sets it up, or is in conflict with it.',
        shot: 'help/sculptor',
        alt: 'The Story Sculptor: acts, plot points, scenes and the cast, linked',
      },
      {
        title: 'Open any card as its own map',
        body: 'Double-click a card and it opens as a map of its own, to work out what happens inside it. The path back to the whole story stays at the top.',
        shot: 'help/sculptor-card-map',
        alt: 'A plot point opened as its own map, with the way back to the whole story at the top',
      },
      {
        title: 'Your outline beside the map',
        body: 'Open the Outliner next to the map and drag any act, scene or beat onto it, where it becomes a linked card. Save the map as a picture or a PDF to print or send.',
        shot: 'help/sculptor-outliner',
        alt: 'The Story Sculptor with the Outliner open beside it',
      },
    ],
  },
  {
    slug: 'notes',
    label: 'See how Notes works',
    title: 'VC Writer Notes in five easy steps',
    steps: [
      {
        title: 'Start a project on your phone',
        body: 'Give it a title and pick the kind: a screenplay, a series, a novel, a stage play and the rest. It will be on your desktop too.',
        shot: 'help/notes-project',
        alt: 'VC Writer Notes on a phone: a new project, with its title and the kinds of writing to choose from',
      },
      {
        title: 'Catch the idea',
        body: 'Type it or press Dictate and say it. Give it a title, pick what kind of note it is, and Save it. Read it back to hear it, or go Hands free on a walk.',
        shot: 'help/notes-capture',
        alt: 'A note being written on the phone: a title, the note, and the kinds of note to choose from',
      },
      {
        title: 'It waits at your desk',
        body: 'Open Research and choose Mobile App. Every note from the phone is there, sorted by kind, with a place suggested for it. File it there, or Move it somewhere else.',
        shot: 'help/notes-inbox',
        alt: 'Research on the desktop, with notes from the phone waiting under Mobile App',
      },
      {
        title: 'Drop it on the story',
        body: 'Drag a note onto a scene, chapter or section in the outline. Open that part of the story and its notes are listed beside it, ready to use.',
        shot: 'help/research-filed',
        alt: 'A section opened in Research, with the notes dropped on it',
      },
      {
        title: 'Use it as you write',
        body: 'When you write that beat, its notes are down the side of the page. Open one, rewrite it, and place it straight into the writing.',
        shot: 'help/writer-notes',
        alt: 'A beat’s writing screen with its notes listed down the right',
      },
    ],
  },
];

export const walkthroughBySlug = (slug: string): Walkthrough | undefined => WALKTHROUGHS.find((one) => one.slug === slug);
