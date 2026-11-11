import type { Guide } from './types';

/**
 * The guides for the pages and rooms a writer finishes with: Preview, the
 * editors, Read back, Focus, Layout, citations and spelling.
 */
export const GUIDES_FINISHING: Guide[] = [
  {
    slug: 'preview',
    group: 'rooms',
    title: 'Preview',
    summary: 'See your script or book exactly as it will print, then print it or save it as a PDF.',
    shot: 'help/preview',
    shotAlt: 'The Preview page showing a script set out in pages, with Print… and Export PDF on the toolbar.',
    sections: [
      {
        heading: 'What Preview shows',
        body: [
          'Preview is your work as it will print. The pages come from what you have written on the Write page, laid out the same way Print and Export PDF lay them out, so a page break here is the page break on paper.',
          'It always opens on the whole script or book. The toolbar says how many pages there are.',
        ],
        steps: [
          'Click **Preview** on the bar along the bottom of the window.',
          'Scroll down through the pages.',
          'Click **Write** on the bottom bar to go back to your writing.',
        ],
      },
      {
        heading: 'The whole thing, or one section',
        body: [
          'Two tabs at the top left choose how much you see. The first shows everything (**Whole script**, or **Whole manuscript** on a book). The second shows only the scene or section you last had selected on the Write page (**This scene** or **This section**).',
          'If nothing is selected, the second tab is greyed out.',
        ],
        steps: [
          'On the Write page, click in the scene or section you want to look at.',
          'Go to **Preview**.',
          'Click the **This scene** (or **This section**) tab.',
          'Click the first tab to see the whole thing again.',
        ],
      },
      {
        heading: 'What goes on the page',
        body: [
          'A few switches on the toolbar change what prints. **Show beat titles** prints your beat titles as a reference copy for yourself; it is off by default, because beat titles are notes to you and not part of the manuscript. On a book you also have **Chapter pages** and **Index**.',
          'Everything else lives in **Page setup…**: the title page, the contents page, headings, page numbers, scene numbers, paragraph style, and notes to yourself such as summaries and the date and time. Preview, Print and Export PDF all follow what you set there.',
        ],
        steps: [
          'Click **Page setup…** on the Preview toolbar (or choose **File ▸ Page setup…**).',
          'Turn on or off what you want printed.',
          'Close the dialog. Preview redraws straight away.',
        ],
      },
      {
        heading: 'Print, or save a PDF',
        steps: [
          'Click **Print…** to send the pages to a printer.',
          'Or click **Export PDF** to save the same pages as a PDF file.',
        ],
        tip: 'Both are in the File menu too, as **Print…** and **Export PDF…**, so you can use them from any page.',
      },
      {
        heading: 'When Preview is empty',
        body: [
          'If you have not written anything on the Write page yet, Preview says **Nothing to print yet** and offers **Go to Write**. Notes in the Outliner are plans, not pages: they appear here once they are on the track and written.',
          'If the scene or section you chose is empty, Preview says so and offers to show the whole thing instead.',
        ],
      },
      {
        heading: 'Short-form projects',
        body: [
          'A short-form project, such as a commercial, prints as a sheet rather than script pages. Its Preview has two tabs, **Sheet** and **Board**: the sheet is audio, visual, frame and duration in rows, and the board is the frames on their own, for a wall. Each has its own **Print…** and **Export PDF…**.',
        ],
        shot: 'help/short-form-preview',
        shotAlt: 'The short-form Preview showing a sheet of shots with audio, visual and duration columns.',
      },
    ],
    related: ['editors', 'layout', 'short-form', 'the-workspace'],
  },
  {
    slug: 'editors',
    group: 'rooms',
    title: 'The editors',
    summary: 'Two editors read your manuscript for you: Daily for the mechanics, Final for the story.',
    shot: 'help/editors',
    shotAlt: 'The Editors page with the Daily tab open: rules down the left and findings on the right, each with Fix and Leave it.',
    sections: [
      {
        heading: 'Opening the editors',
        body: [
          'The editors read what you have written and point out what might need a second look. Neither changes anything on its own: every fix is a button you press.',
          'The Editors page has tabs across the top: **Daily**, **Final**, **Story Grid** and **Polarity**, and on a book, **Index**. Each tab shows a count, so you can see at a glance how much is waiting.',
        ],
        steps: [
          'Click **Editors** on the bottom bar.',
          'Or open the **Editor** menu and choose **Daily editor**, **Final editor**, **Story Grid** or **Scene polarity** to go straight to that tab.',
        ],
      },
      {
        heading: 'The Daily editor',
        body: [
          'Daily is for grammar, spelling, punctuation and mechanics: a word typed twice, two spaces, an unclosed bracket, a common misspelling, "could of" for "could have", a straight quote among curly ones. On a script it also checks shape, such as a cue with nothing under it or a slugline with no time of day.',
          'With **Include style notes** ticked, it adds matters of judgement too: the passive voice, long sentences, adverbs piling up, hedged action and filter words. These are marked **style** rather than **error**, and you are free to disagree with them.',
        ],
        steps: [
          'Choose **Whole project** or **Current scene** from the list at the top right.',
          'Tick or untick **Include style notes**.',
          'Click a rule on the left to see only what it found, or **Everything** to see all of it.',
          'For each finding, click **Fix** to take the suggestion, or **Leave it** to move on.',
          'Click **Fix all** to fix every finding of that rule at once.',
          'Click the place named under a finding to go to it on the Write page.',
        ],
        tip: 'If a rule keeps raising things you do not want, click the **×** beside it to stop checking it in this project. It goes back on from the "switched off" list under the rules. On a suspected typo that is really a word, click **It’s a word** and it will not be asked about again.',
      },
      {
        heading: 'The Final editor',
        body: [
          'Final reads like a story editor before you send the work out. It looks at each scene as a story in miniature, and at the shape of the whole: where the acts fall, who is in which scenes, and how often each thread appears.',
          'Its grid has a row for every scene with four questions for you to answer: **At stake**, **Moves** (Up, Down, Both, or Not at all), **Turns on** and **Why it is here**. Nothing is guessed: a scene you have not answered is never reported as flat.',
        ],
        steps: [
          'Click the **Final** tab.',
          'Fill in the four columns for a scene by typing into them.',
          'To ask for a reading, click **Read scene**. It sends that one scene to vc-writer.com and needs you to be signed in with a licence.',
          'Click **Take this as mine** to copy the reading into your grid, or **Discard** to forget it.',
        ],
      },
      {
        heading: 'Story Grid, Polarity and Index',
        body: [
          '**Story Grid** sets out what your story is (its genre and value) and the scenes that genre owes the reader, with a row for each scene. It has its own **Print…** and **Export PDF…**.',
          '**Polarity** asks where each scene begins and where it ends, and draws the turns as a graph. A scene that begins and ends in the same place is marked flat, as a prompt to look at it rather than a verdict.',
          '**Index** appears on a book, and lists the index marks you have placed in the text.',
        ],
      },
    ],
    related: ['read-back', 'spelling', 'preview', 'story-sculptor'],
  },
  {
    slug: 'read-back',
    group: 'rooms',
    title: 'Read back',
    summary: 'Hear your script or manuscript read aloud, with a voice for each character, and follow along on the page.',
    shot: 'help/read-back',
    shotAlt: 'The Read back box floating over the workspace, with the script lit line by line and a list of voices below.',
    sections: [
      {
        heading: 'Listening to your work',
        body: [
          'Read back speaks your writing aloud, so you can hear how it sounds and catch what the eye skips over. The text is shown as it plays: the line being read is lit and the word being spoken is marked, so you can follow along.',
          'It opens in a box that floats over your work. You can drag the box by its bar, and keep reading and editing the page behind it.',
        ],
        steps: [
          'Click **Read back** on the bottom bar, or choose **Editor ▸ Read back**.',
          'The first time, click **Get natural voices** and wait for the download to finish (about 100 MB, once).',
          'Choose the current scene or **Whole project** from the list at the top.',
          'Click **Play**.',
          'Click **Stop** to stop, or **Close** to stop and put the box away.',
        ],
      },
      {
        heading: 'Starting from a particular line',
        body: [
          'Click any line in the text to start reading from there. To start in a different scene, click in that scene on the Write page first, then choose it in Read back.',
        ],
      },
      {
        heading: 'Speed',
        body: [
          'Drag the **Speed** slider to read faster or slower, from half speed to twice as fast. The number beside it shows the speed.',
        ],
      },
      {
        heading: 'Voices for the narrator and each character',
        body: [
          'Action and description are read by the narrator. Each character can have a voice of their own, so a scene plays like a conversation. Anyone without a voice is read by the narrator.',
          'VC Writer reads in its own natural voices: fourteen voices that sound like people, which run on your computer, work offline and send nothing anywhere. George, a British male, is the default narrator.',
        ],
        steps: [
          'Under **Voices**, choose a voice for **Narrator (action and description)**.',
          'Choose a voice beside each character’s name.',
          'Or click **Suggest a cast** to have voices handed out for you, then change any you like.',
        ],
        tip: 'The voices you choose are saved with the project, so they are there next time.',
      },
    ],
    related: ['editors', 'focus', 'character-creator'],
  },
  {
    slug: 'focus',
    group: 'rooms',
    title: 'Focus mode',
    summary: 'Clear everything away and keep only the page you are writing on.',
    shot: 'help/focus',
    shotAlt: 'Focus mode: the writing page alone, with a Leave focus button at the top.',
    sections: [
      {
        heading: 'The page and nothing else',
        body: [
          'Focus mode hides the timeline, the side columns and the bottom bar, and leaves only the page you are writing on. Everything is still there; it is just out of the way until you come back.',
        ],
      },
      {
        heading: 'Going into Focus mode',
        steps: [
          'Click **Focus** on the bottom bar.',
          'Or choose **Window ▸ Focus mode**.',
          'Or press **Ctrl+Shift+F** (**Cmd+Shift+F** on a Mac).',
        ],
        tip: 'Focus always takes you to the Write page, closing any room that was open.',
      },
      {
        heading: 'Leaving Focus mode',
        steps: [
          'Click **Leave focus · Esc** at the top of the page.',
          'Or press **Esc**.',
          'Or press **Ctrl+Shift+F** (**Cmd+Shift+F** on a Mac) again.',
        ],
        body: [
          'Going to another page or opening a room also leaves Focus mode, so you can never get stuck in it.',
        ],
      },
    ],
    related: ['the-workspace', 'read-back', 'getting-started'],
  },
  {
    slug: 'layout',
    group: 'rooms',
    title: 'Layout',
    summary: 'Set your manuscript as a book: trim size, front and back matter, chapter openings, pictures, and export to PDF, eBook or Word.',
    shot: 'help/novel-layout',
    shotAlt: 'The Layout room: the parts of the book down the left and two facing pages in the middle.',
    sections: [
      {
        heading: 'Opening the Layout room',
        body: [
          'Layout is where a novel, a collection of short stories or an instructional book is set as a real book. You write on the Write page as usual; Layout takes the same words and sets them in pages at the size the book will be printed.',
          'Down the left is the book in the order it is bound, under **Front matter**, the story, and **Back matter**. In the middle are two facing pages at a time, exactly as the exported book will have them.',
        ],
        steps: [
          'Click **Layout** on the bottom bar. (It is there only on a book.)',
          'Click a row on the left to turn to that page.',
          'Use the large arrows either side of the pages to turn them, or drag the slider at the foot to move a long way at once.',
          'Click **Exit** at the top right to leave.',
        ],
        tip: 'The pages fit the window by themselves. If you zoom by hand, click **Fit** to go back.',
      },
      {
        heading: 'The trim size and the whole book',
        body: [
          'Start with the trim size, the size of the printed page, such as 5½ × 8½ in, 6 × 9 in or A5, or a custom size. The margins, the lines on a page and the room for the spine are worked out from it, and the inside margin grows by itself as the book gets longer.',
          '**Book settings…** holds everything that runs all the way through the book: the title, author and publisher (under **The book**), **Trim, margins & spine**, **Type**, and **Running heads & page numbers**. Set the title here, and it appears everywhere the book is named.',
        ],
        steps: [
          'Click **Book settings…** on the Layout bar.',
          'Open **The book** and type the title, the author and the publisher.',
          'Open **Trim, margins & spine** and choose a trim size.',
          'Open **Type** and **Running heads & page numbers** to adjust the rest.',
        ],
      },
      {
        heading: 'Chapter openings',
        body: [
          'Choose how each chapter begins: where a picture goes, how the number is shown, how far down the page the chapter starts, and how the first line is treated, such as with a drop cap. A preview shows the opening with your own first words.',
        ],
        steps: [
          'Click **Chapter openings…** on the Layout bar.',
          'Click one of the layouts.',
          'Adjust the sink, the first line and the graphic beside it.',
          'Use **Apply to** to choose whether a change goes to this chapter or every one.',
        ],
      },
      {
        heading: 'Front matter, back matter and pictures',
        body: [
          'A new book starts with a half title, a title page, a copyright page, a contents page and **About the author**. The contents page fills itself in from your chapters. Double-click any page to open it in its own dialog and set its words and look. The copyright page has its own fields for the notice, the ISBN, the edition and a barcode, and About the author takes a photo, a biography and links.',
          'Click **+ Add** at the top of the rail to add more, such as a dedication, an epigraph, acknowledgements, a glossary, a bibliography or an art page. **+ Picture** puts a picture at the top of the page you are looking at. Drag rows to reorder them, and click a row’s **×** to take a page out.',
        ],
        shot: 'help/short-stories-layout',
        shotAlt: 'The Layout room for a collection of short stories, each story listed with its own opening page.',
      },
      {
        heading: 'Exporting the book',
        body: [
          'Three buttons on the Layout bar send the book out. **Export the book…** writes a PDF at the trim size, every page as it stands in the room. This is the file for a printer.',
          '**Export as eBook…** makes an EPUB. Choose the store it is going to (such as Amazon Kindle (KDP), Apple Books, Kobo or IngramSpark) and the book is checked against that store’s rules before anything is written. Problems are listed under **Preflight**, and an error holds the export until it is fixed. Fill in the language, ISBN, description and cover under **The book**, then click **Write the eBook**.',
          '**Export as Word…** writes the book as a Word manuscript, with any citations as Word footnotes and the bibliography at the back.',
        ],
        tip: '**File ▸ Export PDF…** exports the plain manuscript, not the laid-out book. Use **Export the book…** for the book.',
      },
    ],
    related: ['novel', 'short-stories', 'instructional', 'citations', 'preview'],
  },
  {
    slug: 'citations',
    group: 'rooms',
    title: 'Citations and references',
    summary: 'Keep a library of your sources, cite them in the text, and let VC Writer write the notes and the bibliography.',
    shot: 'help/instructional-research',
    shotAlt: 'Research on an instructional book, with References in the side menu and the library of sources open.',
    sections: [
      {
        heading: 'Where citations work',
        body: [
          'Citations are part of the instructional book and the Document module. You enter each source once in the References library, then cite it as often as you like. The numbers, the notes and the bibliography are worked out for you, and they keep up as you add, move or remove citations.',
        ],
      },
      {
        heading: 'Adding a source',
        steps: [
          'Open **Research** from the bottom bar.',
          'Click **References** in the side menu.',
          'On the **Library** tab, click **Add reference**.',
          'Choose the **Kind of source**, such as a book, a journal article or a website.',
          'Fill in the fields. They change with the kind, and each one is checked as you type.',
        ],
        tip: 'Already have sources in another project? Click **Bring in sources from another project…**.',
      },
      {
        heading: 'Citing in the text',
        steps: [
          'On the Write page, put the cursor where the citation goes, or select the words it follows.',
          'Click **Cite** on the writing toolbar, or right-click and choose **Insert citation…**, or press **Ctrl+Shift+C** (**Cmd+Shift+C** on a Mac).',
          'Search for the source, or click **New source…** to make one.',
          'Add a page or other pinpoint, and a note of your own if you like.',
          'Click **Insert**.',
        ],
        body: [
          'The citation shows in the line as a small marker. Click it to change the source, the page or the note, or to **Remove citation**. The source stays in the library.',
        ],
      },
      {
        heading: 'Choosing a style',
        body: [
          'On the **How the book cites** tab, choose a style: **Chicago Notes & Bibliography** (footnotes, the default), **APA** or **MLA** (author and year or page in the text), or **Custom** (footnotes in the form you choose). You can also choose the markers, whether they count through the whole book or from 1 in each chapter, and what the bibliography lists and in what order.',
          'Changing the style re-sets every note and the bibliography at once. Your sources are not touched.',
        ],
      },
      {
        heading: 'The bibliography',
        body: [
          'The **Notes & bibliography** tab shows every note in order, then the bibliography. If the book has no bibliography page yet, click **Add it to the back matter**. In the Layout room, the bibliography page is built from the library while **From the References library** is on, and the notes sit at the foot of each page.',
          'In a Document, use **Insert citation**, **Bibliography** and **Sources & style** on the **References** tab of the ribbon. Each document counts its own notes from 1.',
        ],
      },
    ],
    related: ['instructional', 'document', 'research', 'layout'],
  },
  {
    slug: 'spelling',
    group: 'rooms',
    title: 'Spelling and the thesaurus',
    summary: 'Right-click any word you have typed for spelling suggestions or synonyms, anywhere in VC Writer.',
    sections: [
      {
        heading: 'Right-click wherever you type',
        body: [
          'Every place you type has the same right-click menu: the Write page, notes, titles, cards, research, the Character Creator and every other module. It works the same on every computer, and on the browser preview too.',
          'The menu works on the word under the pointer, or on the words you have selected if the pointer is over them. Whatever you choose is typed in place, so Undo takes it back.',
        ],
      },
      {
        heading: 'A misspelled word',
        steps: [
          'Right-click the underlined word.',
          'Click one of the suggestions at the top to replace it.',
          'Or click **Add to Dictionary** if the word is right, and it will not be marked again.',
          'Or click **Ignore** to leave it alone for now.',
        ],
        tip: '**Ignore** lasts until you close VC Writer. **Add to Dictionary** is kept. Your characters’ and places’ names already count as words.',
      },
      {
        heading: 'A word spelled right: synonyms',
        body: [
          'Right-click a word that is spelled correctly and the menu shows **Synonyms for** that word, best matches first. Click one to put it in place of the word. The thesaurus keeps your capitals, so a word at the start of a sentence stays capitalised.',
        ],
      },
      {
        heading: 'The rest of the menu',
        body: [
          'Below the spelling and synonyms are the usual **Undo**, **Redo**, **Cut**, **Copy**, **Paste** and **Select All**.',
        ],
      },
    ],
    related: ['editors', 'the-workspace', 'document'],
  },
];
