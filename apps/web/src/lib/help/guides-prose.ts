import type { Guide } from './types';

/**
 * The prose modules' guides: Novel, Short stories and collections,
 * Instructional book and Document. Every label is the program's own.
 */
export const GUIDES_PROSE: Guide[] = [
  // ------------------------------------------------------------------ novel
  {
    slug: 'novel',
    group: 'modules',
    title: 'Writing a novel',
    summary: 'Chapters and passages, the manuscript, bringing in a Word document, and setting the finished book in Layout.',
    shot: 'modules/novel',
    shotAlt: 'A novel open in VC Writer, with the manuscript above and the chapters on the timeline below',
    sections: [
      {
        heading: 'Chapters and passages',
        body: [
          'A novel is made of **chapters**, and each chapter is made of **passages** — the stretches of writing you work on one at a time. The chapters sit along the timeline at the foot of the Write page, and the manuscript above reads them as one continuous book.',
          'A passage is yours to size: a scene, a page, or a whole chapter in one piece. Nothing about the printed book depends on how you divide it.',
        ],
        steps: [
          'Start a project with **New project…** in the File menu and choose the **Novel** card.',
          'Press **+ Chapter** on the timeline’s bar to add a chapter.',
          'Select a chapter and press **+ Passage** to add a passage inside it.',
          'Drag chapters and passages along the timeline to put them in a different order.',
        ],
      },
      {
        heading: 'Writing in the manuscript',
        body: [
          'Click into the manuscript and type. Return starts the next paragraph, and the words are saved as you go.',
          'To divide writing you already have, right-click a paragraph and choose **Split the passage here** or **Split the chapter here**. The words from that line on become a passage or chapter of their own, and not a word is lost.',
        ],
        tip: 'The **Chapter** and **Passage** buttons on the bar above the manuscript divide it by pointing: click where the new chapter or passage starts, then where it ends.',
      },
      {
        heading: 'Chapter markers and chapter pages',
        body: [
          'A **marker** is a point in the book: a chapter, or a part that gathers several chapters together. A chapter marker can give its chapter a page of its own — the leaf the chapter opens on, with its number, its name, an epigraph or a graphic.',
        ],
        steps: [
          'Select the chapter where the marker should fall and press **+ Marker** on the timeline’s bar.',
          'Click the marker to open it, and type its name.',
          'Choose its kind — **Chapter** or **Part** — from the list beside the name.',
          'Tick **Give this chapter a page of its own**, then choose whether to **Show the number** and **Show the name**.',
          'For the look of every chapter page at once, use **Chapter page…** in the File menu.',
        ],
      },
      {
        heading: 'The people in it: the Character Creator',
        body: [
          'Your characters live in Research, under **Character Creator**. Each one has four tabs — **Overview**, **Traits & Moments**, **Arc** and **Relationships** — for who they are, what shows it on the page, and how they change.',
          'While writing, right-click a line and choose **Make this a character moment…** to file the passage under somebody. It is marked as used where it stands.',
        ],
      },
      {
        heading: 'Bringing in a manuscript you already have',
        body: [
          'A Word document (.docx) or a plain text file comes in as one manuscript. A Word document keeps the face and size each paragraph was set in. Before anything is made, you say where the chapters fall.',
        ],
        steps: [
          'Choose **Import…** from the File menu.',
          'Under **A new project**, choose **A novel**, and pick the file.',
          'Type a **Project name**, or leave it empty to use the document’s own title.',
          'Under **Divide it at**, tick what starts a chapter in your document: **A heading**, **The word Chapter**, **A numeral on its own** or **A new page**. The chapter count updates as you tick.',
          'Choose how each chapter arrives: **One passage, to divide by hand**, or **A passage for every paragraph**.',
          'Press **Import**.',
        ],
        tip: 'With nothing ticked, the whole manuscript comes in as one chapter, and you can divide it afterwards.',
      },
      {
        heading: 'Setting it as a book, and the eBook',
        body: [
          'When the words are ready, press **Layout** on the title bar. Layout sets the manuscript as a printed book — the trim, the type, the chapter openings, the pages in front and behind — and shows it spread by spread.',
          'From the Layout bar, **Export the book…** makes the print PDF, **Export as eBook…** makes an EPUB for the eBook stores, and **Export as Word…** makes a Word manuscript. The Layout guide goes through every part of it.',
        ],
        shot: 'help/novel-layout',
        shotAlt: 'The Layout room showing a novel set as a book, open at its first chapter',
      },
    ],
    related: ['layout', 'character-creator', 'research', 'preview', 'editors'],
  },

  // ---------------------------------------------------------- short stories
  {
    slug: 'short-stories',
    group: 'modules',
    title: 'Short stories and collections',
    summary: 'One story or a whole collection: adding stories, bringing in several documents at once, filing notes, and laying the collection out as a book.',
    shot: 'modules/short-stories',
    shotAlt: 'A collection of short stories open in VC Writer, with its stories listed down the right',
    sections: [
      {
        heading: 'One story or many',
        body: [
          'A **Short stories and collections** project holds one story or twenty — it is a collection either way, and a single story is simply a collection of one.',
          'Each story is made of **sections**, and each section of **passages**. A story begins with a story marker on its first section and runs until the next story begins, so moving sections moves the stories with them.',
        ],
        steps: [
          'Choose **New project…** from the File menu.',
          'Choose the **Short stories and collections** card, give it a title, and press **Create project**.',
          'Write in the manuscript as you would in any book.',
        ],
      },
      {
        heading: 'Adding a story',
        body: [
          'A new story always starts on a section of its own at the end of the collection, so it never cuts into the story before it.',
        ],
        steps: [
          'Open the stories down the right with **Stories** in the Window menu.',
          'Press **+ New story** at the foot of the list. (On the timeline, **+ Story** does the same.)',
          'Click a story to go to it. Double-click it to open the page it opens on.',
          'To take a story out, hover over it and press its **×**. You are asked first.',
        ],
        tip: 'Removing a story never throws away writing. If it has words in it, only the break goes, and its sections join the story before.',
      },
      {
        heading: 'Bringing in several documents',
        body: [
          'Each document is one story. A Word document (.docx) or a plain text file is read by its headings, which divide the story into sections. A numeral on its own, such as *II*, divides a story rather than beginning a new one.',
        ],
        steps: [
          'Choose **Import…** from the File menu.',
          'For a new collection, choose **A collection of short stories** under **A new project**. To add to the one that is open, choose **More stories** under **Into this project**.',
          'Pick one file or several. They are listed in the order they will go in; use the arrows to reorder them, or **×** to leave one out.',
          'If a single document holds more than one story, say so under **What the document is**: **One story**, or **A collection**, where each named heading begins a story.',
          'Press **Import** (or **Add to the end** when adding). The Layout room opens on the stories, ready to put in order.',
          'To bring in the next one straight away, press **Import another story…**.',
        ],
      },
      {
        heading: 'Notes for a particular story',
        body: [
          'On the phone, a collection’s note screen has a **Story** dropdown. Choose the story a note belongs to before you dictate, and the note carries that story with it.',
          'When it arrives on the desktop, the note shows the story’s name in Research under **Mobile App**, so you can see at a glance which story it was meant for.',
        ],
      },
      {
        heading: 'Laying out the collection as a book',
        body: [
          'Press **Layout** on the title bar. Each story opens on its own page, on a right-hand page where the book asks for one, and the contents page lists every story with the page it begins on.',
          'In Layout’s list, each story has its story page in front of it. Drag a story to move it, with all its sections, to another place in the collection. A full blank sheet stands between stories by default; you can turn it off in **Book settings…**, or take it out before one story with the **×** on its page.',
        ],
        shot: 'help/short-stories-layout',
        shotAlt: 'The Layout room showing a collection of short stories set as a book',
      },
    ],
    related: ['layout', 'phone-notes', 'research', 'preview'],
  },

  // ----------------------------------------------------------- instructional
  {
    slug: 'instructional',
    group: 'modules',
    title: 'Instructional books',
    summary: 'Textbooks and nonfiction: chapters, numbered sections and subsections, figures, end-of-section aids, an index and a table of contents.',
    shot: 'modules/instructional',
    shotAlt: 'An instructional book open in VC Writer, with numbered sections and subsections',
    sections: [
      {
        heading: 'Chapters, sections and subsections',
        body: [
          'An instructional book is arranged like a textbook. A **chapter** announces a subject; under it come **sections** and **subsections**, numbered 1, 1.1, 1.1.1. Nothing is written in a chapter itself — the writing starts at its first section.',
          'The numbers are worked out from where each part falls, so moving a section renumbers everything after it. There is no box to type a number in. To turn numbering off, use **Page setup…** in the File menu, under **Numbering**.',
        ],
        steps: [
          'Choose **New project…** from the File menu.',
          'Choose the **Instructional book** card, give it a title, and press **Create project**.',
        ],
        tip: 'Every section and subsection prints its heading. Click a heading’s switch in the manuscript to leave it out, so two parts read as one.',
      },
      {
        heading: 'Planning on the Outline page',
        body: [
          'A book opens on its outline. **Outline** sits before **Write** on the page bar, and you can switch between them whenever you like.',
          'Each row carries a dot: red while it is only in the plan, yellow once it is in the book but its words are not written yet, and green when it is in the book.',
        ],
        steps: [
          'Press **+ Chapter**, then **+ Section** and **+ Subsection** to build the outline.',
          'Return makes another row of the same kind. Tab moves a row in a level, and Shift+Tab moves it out.',
          'Drag a row by its grip (⠿) to move it; its subsections come with it.',
          'Select rows and press **Add to track** to put them in the book, or **Add all to track** for everything still in the plan.',
          'To take a row out, select it and press **Delete**.',
        ],
        shot: 'help/instructional-outliner',
        shotAlt: 'The book outliner with chapters, numbered sections and subsections',
      },
      {
        heading: 'Graphics in the manuscript',
        body: [
          'Pictures live in Research ▸ **Graphics**. Each one has a **Name**, a **Caption** and **What it shows** — a description for a reader who cannot see it.',
          'Figures are numbered in reading order, so moving a section renumbers them. A figure is as wide as the text and its height follows from the picture.',
        ],
        steps: [
          'Open **Research** on the title bar and choose **Graphics**.',
          'Drop pictures onto it, or press **Choose files…**.',
          'In the manuscript, right-click the paragraph the figure belongs under.',
          'Choose **Put a figure here…** and pick the graphic.',
        ],
      },
      {
        heading: 'End-of-section learning aids',
        body: [
          'Each subsection can end with a **Summary**, **What you learned** and **Review questions**. They are optional, and nothing prints until you tick **In the book**.',
          'Where suggestions are available, **Suggest one** offers wording in a box of its own. **Use this** takes it, and **Put it back** restores what you had written. A suggestion never overwrites your own words without you choosing it.',
        ],
        steps: [
          'Select a subsection and open the **Inspector** from the timeline’s bar.',
          'Under **End of section**, write the summary, or one thing learned per line.',
          'For review questions, type each question and, if the book prints one, its answer. **+ Another question** adds a row.',
          'Tick **In the book** for each aid you want printed.',
        ],
      },
      {
        heading: 'The index and the table of contents',
        body: [
          'The **table of contents** builds itself from your chapters and sections, with the page each starts on, and stays right as the pages move. Turn it on or off with **Contents page** in **Page setup…**, and choose what it lists on the contents page in Layout.',
          'The **index** is made of passages you mark. Right-click a line and choose **Add to the index…**, then give it a heading. The page numbers are worked out every time the book is set. **Index…** in the Editor menu shows every heading, and **Build it from the book** offers headings from what you have already tagged elsewhere.',
        ],
        tip: 'The same right-click offers **Add to the glossary…** and **Add to the appendix…**.',
      },
      {
        heading: 'Notes, sources and citations',
        body: [
          'Research starts with **General Notes**, **Ideas** and an **Imported** shelf. **Import notes…** brings in a group of files at once; each becomes a note in Imported, ready to sort into the outline.',
          'Sources are kept in Research ▸ **References**. Press **Cite** on the writing toolbar, or right-click and choose **Insert citation…**, to cite one at the cursor. The citations guide covers styles, notes and the bibliography.',
        ],
        shot: 'help/instructional-research',
        shotAlt: 'Research in an instructional book, with the References library open',
      },
    ],
    related: ['citations', 'outliner', 'research', 'layout', 'preview'],
  },

  // ---------------------------------------------------------------- document
  {
    slug: 'document',
    group: 'modules',
    title: 'Documents',
    summary: 'A word processor with a ribbon, styles, headers and footers, notes, comments and tracked changes — and Research beside the page.',
    shot: 'modules/document',
    shotAlt: 'A Document project open in VC Writer: the ribbon above a white page, and the right-hand menu',
    sections: [
      {
        heading: 'The ribbon',
        body: [
          'A **Document** project looks and works like a familiar word processor. The ribbon over the page has seven tabs:',
          '**File** saves, prints and exports. **Home** has the font, the paragraph, the **Styles** box and find. **Insert** adds page breaks, tables, pictures, shapes, links, the date and symbols, and headers and footers. **Layout** sets the paper, orientation and margins. **References** holds the table of contents, footnotes and citations. **Review** has comments, tracked changes, speech, spelling and the word count. **View** switches between **Print layout** and **Web layout** and sets the zoom.',
        ],
        tip: 'Styles come from the **Styles** box on Home: **Normal**, **Title**, **Subtitle**, **Heading 1** to **Heading 6** and **Quote**.',
      },
      {
        heading: 'Pages, headers and notes',
        steps: [
          'For page numbers, open **Insert** and choose a place from the **Page numbers** list, such as **Bottom of page, centre: 1**.',
          'For your own header or footer, press **Header & footer** and type into the left, centre or right slot. Untick **On the first page too** to leave the first page bare.',
          'For a footnote, place the cursor and press **Insert footnote** on **References**. **Insert endnote** puts the note at the end instead.',
          'For a table of contents, place the cursor and press **Table of contents** on **References**. It is drawn from your headings and keeps itself current.',
        ],
      },
      {
        heading: 'Comments and tracked changes',
        steps: [
          'Select some words, open **Review**, and press **New comment**.',
          'Comments appear in a column beside the page, where each one can be answered, edited, resolved or deleted.',
          'Press **Track changes** to start tracking. What you type is underlined and what you delete is struck through.',
          'Use **Accept** and **Reject** for one change, or **Accept all** and **Reject all** for every one.',
        ],
      },
      {
        heading: 'Word files, PDF, and your voice',
        body: [
          'To bring in a Word or text file, open **File** on the ribbon and press **Insert a file…** — its words go in at the cursor, with headings, emphasis and pictures kept. To send the document out, the same tab has **Word (.docx)**, **PDF** and **Plain text**, beside **Print…**.',
          'On **Review**, **Dictate** types what you say at the cursor, and **Read aloud** reads the selection, or from the cursor to the end, in the voice and speed you choose. Press either again to stop. The first time, **Get voices** downloads VC Writer’s natural voices (about 100 MB, once).',
        ],
      },
      {
        heading: 'The right-hand menu',
        body: [
          'A column down the right edge holds the writer’s tools. **Document** and **Outliner** switch between the page and an outline of its headings. **Navigate** shows the headings beside the page. **Research** opens your notes. **Extract** opens Extract & Organize. **Sources** is the library and the citation style, **Cite** puts a citation at the cursor, and **Find** searches the document.',
          '**Extract** is for pulling passages out of what you have written. Select some words and press a category — **Character**, **Location**, **Idea** and so on. The words stay in the page, a copy goes into that category’s bin, and **Send…** copies extracts on to another project.',
        ],
        shot: 'help/document-research',
        shotAlt: 'Research opened from the right-hand menu of a Document project',
      },
      {
        heading: 'Research, and Place on page',
        body: [
          'Your notes are a click away while you write. **Place on page** puts a note’s words straight into the document where you left the cursor.',
        ],
        steps: [
          'Click in the page where the words should go.',
          'Press **Research** on the right-hand menu.',
          'Choose a note and press **Rewrite and place…**.',
          'Rewrite it on the right if you like. **Bring across →** copies words from the original beside it.',
          'Press **Place on page**. The words go in at the cursor, Research closes, and you are back on the page.',
        ],
        tip: 'The note then reads **Placed on the page**, and the button becomes **Place on page again**.',
        shot: 'help/document-place-on-page',
        shotAlt: 'A note open beside its rewrite, with the Place on page button',
      },
    ],
    related: ['research', 'citations', 'spelling', 'outliner', 'saving-and-recovery'],
  },
];
