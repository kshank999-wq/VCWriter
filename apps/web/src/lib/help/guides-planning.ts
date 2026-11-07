import type { Guide } from './types';

/**
 * The planning rooms: Research, the Story Sculptor, the Outliner and the
 * Character Creator. Written from the specs (addenda 03, 06, 08, 11, 12, 14,
 * 15, 19, 24, 25, 26, 27, 28) and the renderer's own labels.
 */
export const GUIDES_PLANNING: Guide[] = [
  // ------------------------------------------------------------------ research
  {
    slug: 'research',
    group: 'rooms',
    title: 'Research',
    summary:
      'Where your notes, clippings, places and threads are kept before, during and after you use them, and how a note finds its way onto the page.',
    shot: 'help/research',
    shotAlt: 'The Research room: folders down the left, notes in the middle, the chosen note on the right.',
    sections: [
      {
        heading: 'Folders and notes',
        body: [
          'Research fills the window. Down the left is the side menu: the views of everything, the Character Creator, the extra screens under **Also**, and your **Folders**. The middle shows what is in the folder or view you chose, and the right shows the note you picked.',
          'Folders can hold folders, so a character folder can hold a folder of their journey. Drag a note onto a folder to file it there, or drag a folder onto another to put it inside. Click a folder name twice to rename it, use the colour swatch to give it a colour, and **+** beside it to make a folder inside it.',
        ],
        steps: [
          'Press **+ Folder** in the bar at the top to make a new folder.',
          'Choose the folder in the side menu.',
          'Press **+ Note** to write a note into it.',
          'Type in the search box (*Search titles, notes and tags*) to find anything across all your research.',
        ],
        tip: 'Search finds character work too: a moment filed under a character’s trait turns up under **Character work** above the notes.',
      },
      {
        heading: 'What has been used, and what has not',
        body: [
          'At the top of the side menu, under **Everything**, are five views that are not places: **All research**, **Not yet used**, **Sorted into the outline**, **Used in the script** (the wording follows your project, so a book says *Used in the book*) and **Put away**.',
          'A note counts as used once it is on the track, or once it has been rewritten and worked into the outline. Nothing marks it for you behind your back: cut the beat it was placed in and it goes back to *Not yet used* by itself. A used note carries a red ✕ in its corner.',
          '**All research** shows your folders as tiles, with how many notes each holds and how many of those are used. Click a tile to see its notes here, or press **Show every note instead** for one long list.',
        ],
      },
      {
        heading: 'A note’s details, and a folder in its own window',
        body: [
          'Click a note to open its details on the right: **Title**, **Note**, **Tags** (separated by commas) and **Folder**. Double-click a note to open it on its own screen in the middle, with more room to write.',
          'Under the details are the things you can do with it. **Put away** moves it out of sight into *Put away* without deleting it, and **Take back out** brings it back. While you are writing a beat you also get **Used in the beat I am writing**; a used note offers **Back to not used**.',
          'A folder can be opened in a window of its own, to put on a second monitor while you write. Press **⧉** on its tile, double-click the tile, or choose the folder and press **⧉ Open this folder in its own window**. The window edits the same project, so changes show up everywhere at once.',
        ],
      },
      {
        heading: 'Rewrite and place a note',
        body: [
          'Rough notes are rarely ready to go straight into the script. The rewrite screen keeps the note exactly as you caught it on one side, and gives you a clean page beside it.',
        ],
        steps: [
          'Choose a note and press **Rewrite and place…** (or double-click it in the outline column beside the notes).',
          'Retype the title at the top if it came in wrong. Everything here is saved as you type.',
          'Select words in **Original** and press **Bring across →** to copy them into your rewrite, or press it with nothing selected to bring the whole note.',
          'Shape the words in **Rewrite**. **Start from the original** copies the whole note in to edit from.',
          'Press **Place on the track** to make a beat from your rewrite where the note is filed.',
          'Press **Go to it on the track** to jump to the beat you just made.',
        ],
        tip: 'In a Document project there is no track, so the button reads **Place on page**: the words go into your document where your cursor was, and you are taken back to the page.',
        shot: 'help/research-note',
        shotAlt: 'The rewrite screen: the original note on the left, the rewrite on the right.',
      },
      {
        heading: 'Sorting notes into the outline, importing, and the phone',
        body: [
          'Beside every list of notes stands an **Outline** column, listing your outline’s chapters, sections and scenes in order. Drag a note onto one to sort it there: it leaves its folder and waits in *Sorted into the outline* until it is used. A sorted note shows yellow until its words reach the manuscript. Hide the column with › and bring it back with **‹ Outline**; **Collapse all** and **Expand all** fold it.',
          '**Import notes…** in the top bar brings in one file or many (text, Markdown or Word). Each file becomes a note, a Word document is split at its own headings, and they all land in the **Imported** folder as not yet used.',
          'Notes you catch on your phone arrive under **Mobile App**, on the **This project** tab. Press **File it there** to accept where the program suggests, **Move…** to correct the words or pick the folder yourself, or × to stop it waiting. You can also drag a phone note onto a folder, onto the outline column, or onto a person in the Character Creator list.',
        ],
      },
      {
        heading: 'Links, setups, places and themes',
        body: [
          '**Links & threads**, at the top of the side menu, gathers the story’s wiring on one screen with a tab each: Links & threads, Setups & payoffs, Plots, Themes & motifs, and Arcs. To start a thread, name it and press Add, then mark its moments by right-clicking a line in your writing and choosing **Add to Research ▸ Links…**.',
          '**Setups & payoffs** lists each payoff with a light and a count of how many setups land before it. Tag a passage by right-clicking it and choosing **Make this a setup or a payoff…**; **Go to it** opens the beat it was tagged on.',
          '**Locations** is your library of places: a name, notes, several prepared descriptions (*Night version*, *After the fire*) and the scenes that use it. In a scene’s own dialog you can pick a place, make one with **New location…**, and insert one of its descriptions. Nothing is inserted until you ask.',
          '**Themes & motifs** keeps the two apart, on two tabs. Right-click a passage and choose **Tag a theme or a motif…**; each tagged moment is listed in story order with **Go to it** and **Untag**. Untagging never touches your writing.',
        ],
      },
      {
        heading: 'The Note Sorter and the Graveyard',
        body: [
          '**Note Sorter**, under **Also**, is for a long page of notes: read it, highlight the pieces that matter, and drop them into categories.',
          '**Graveyard**, at the very bottom of the side menu, is where deleted notes, folders, characters, places and threads wait. Press **Restore** to put one back. Only **Forget it** and **Empty the graveyard…** destroy anything, and both ask first. Nothing ages out on its own.',
        ],
      },
    ],
    related: ['phone-notes', 'outliner', 'character-creator', 'story-sculptor'],
  },

  // ---------------------------------------------------------- story sculptor
  {
    slug: 'story-sculptor',
    group: 'rooms',
    title: 'Story Sculptor',
    summary:
      'A story map you can grow as deep as you like: frames, scenes, the characters in them and what they do, cross-linked, folded and unfolded at will.',
    shot: 'help/sculptor',
    shotAlt: 'The Story Sculptor: the palette on the left, the map in the middle, the inspector and library on the right.',
    sections: [
      {
        heading: 'The map',
        body: [
          'Press **Sculptor** on the bottom bar to open the Story Sculptor over the workspace; **Exit** at the top right takes you back. Put in the big movements of the story first, then drill into scenes, the characters in each scene, and what they do, as deep as the story needs.',
          'Drag the background (or use the wheel) to move around, and the **Zoom** slider or Ctrl and the wheel to zoom. When the map is bigger than the window, a minimap in the corner shows where you are; press it to jump there. Everything saves with the project.',
        ],
        steps: [
          'On an empty map, press **+ Add a frame**. A frame is a major movement or plot point.',
          'Drag a type from the palette on the left onto a card to put it inside, or onto the canvas to put it at the top.',
          'Or select a card and click a palette type to add it under that card.',
          'Double-click a card to open it as its own map. The breadcrumbs at the top (*Whole story › Act one › …*) take you back up.',
        ],
      },
      {
        heading: 'Card types and the inspector',
        body: [
          'The palette offers eight kinds of card: **Frame**, **Plot point**, **Scene**, **Character**, **Action**, **Beat**, **Note** and **Custom** (which you name yourself, such as *Reveal*). Each has its own colour stripe and a two-letter badge, so you can tell them apart without relying on colour.',
          'Select a card to see it in the inspector on the right: its title, type, description and the details that type offers (a Scene’s slugline and purpose, a Character’s scene objective, an Action’s verb and outcome). Any card can hold any other, with no limit on depth. Small dots in a card’s corner say what is nested inside it.',
          'A Scene or Beat card can go into the script: **Add to track** creates it in VC Writer, or you can link it to one that already exists. Once linked, renaming either renames both. Moving or deleting a card never changes the script on its own; if the order disagrees, the inspector says so and offers to move it to match.',
        ],
      },
      {
        heading: 'The library',
        body: [
          'The library on the right holds what you can place on the map: **Characters** (your cast), **Places**, **Plot & scenes** you have made reusable, scenes already **In the script**, and **Research**. Search it, star favourites with ★, and see how many times each is placed. Drag one onto a card, or click it to place it under the selected card.',
          'A character on the map is your cast’s own character, not a copy. Put Barbra in five scenes and rename her once, and every card follows. Her *Scene objective* in one scene stays on that card. Press **+ Character** in the library to add someone new to the cast.',
          'Right-click a card for **Make reusable (add to the library)**, **Duplicate placement**, **Copy branch**, **Paste inside** and more.',
        ],
      },
      {
        heading: 'Links between cards',
        body: [
          'Nesting a card inside another is one kind of connection. Cross-links are the other: they join any two cards anywhere on the map. A link can be **Related to**, **Causes**, **Appears in**, **Sets up / pays off**, **Conflict**, **Influences** or **Custom**, with a label and an optional direction.',
        ],
        steps: [
          'Select a card and press **⇄ Connect** in the toolbar (or drag from the card’s ● port).',
          'Click the card it connects to.',
          'Click the line or its label to choose its kind, give it a label, set **Has a direction**, **Reverse** it or **Delete** it.',
        ],
        tip: 'Links survive folding. A link into a folded branch is drawn to the card standing in for it.',
      },
      {
        heading: 'Explode, collapse, views and search',
        body: [
          '**✷ Explode all** shows every card at once; **▣ Collapse all** folds back to the frames. **Collapse to** folds the map to a type (Frame, Scene, Character, Action), to **Full detail**, or to a depth (Level 0, Level 1…). **Explode branch** and **Collapse branch** work on the selected card only. **Show ancestors**, **Fit view**, **Focus selection** and **Auto layout** help you find your way.',
          '**Views** saves the way the map is folded and laid out under a name: type a name and press **Keep this view**, then press it later to come back. The same menu lets you show or hide each kind of link.',
          'The search box (*Search the map*) looks through titles, notes and details, even inside folded branches. Choose a result to open its branch and centre it.',
        ],
      },
      {
        heading: 'Notes and the Outliner beside the map',
        body: [
          '**Notes** in the toolbar swaps the palette for the research shelf and your phone notes, ready to drag onto cards. **Outliner** shows your outline down the left instead, with its own **Collapse all** and **Expand all**.',
          'Drag an outline row onto a card and it goes inside, with everything under it, as typed cards: a chapter becomes a Frame, a scene or section a Scene, a beat or subsection a Beat, and the rest Notes. Drop it on the empty canvas to put it at the top, or click it to place it under the selected card. It is a copy; the outline is not changed.',
        ],
      },
      {
        heading: 'Export, import, and more than one map',
        body: [
          '**Export** offers a **PNG image** or **PDF** of the map as it is on screen, the same again with every card open (**PNG image, everything** and **PDF, everything**), and **JSON data**, the whole map as data for other tools. Exporting everything never changes your view.',
          '**Import…** reads a map saved as JSON data, from this project or another. It shows what is in the file and asks where it goes: **As a new map in this project**, or into this map under the selected card. Nothing already on the map changes, and characters are matched to your cast by name.',
          'When a project has more than one map, a list in the toolbar chooses between them, **✎** renames the current map and **✕** removes it (after asking; the script, cast and research are not touched).',
        ],
      },
    ],
    related: ['outliner', 'research', 'character-creator'],
  },

  // ------------------------------------------------------------------ outliner
  {
    slug: 'outliner',
    group: 'rooms',
    title: 'The Outliner',
    summary:
      'Arrange your story in order, scene by scene and beat by beat, with notes beneath them, and send it to the track when you are ready.',
    shot: 'help/outliner',
    shotAlt: 'The Outliner: the research shelf on the left and the outline of scenes, beats and notes beside it.',
    sections: [
      {
        heading: 'A plan until you say otherwise',
        body: [
          'The Outliner opens from the bottom bar beside Research and Sculptor. Everything in it is a plan: a scene here is a scene you mean to write. It is not in the script or the page count, and deleting it costs nothing. When you are ready, you add it to the track, and from then on the row and the scene are one thing. Rename either and both change.',
          'Every row has a type and a depth, and the two are separate. A **Scene** is the main unit, a **Beat** is something that happens in it, and **Note**, **Idea**, **Character**, **Setting** and **Prop** are your planning around them. Any of them can sit under any other.',
        ],
      },
      {
        heading: 'Adding and moving rows',
        steps: [
          'Press **+ Scene** to add a scene. Scenes always go at the top level.',
          'Select a row and press **+ Beat**, **+ Note** or another type to put one under it.',
          'Type its name straight into the box. Press Return for another row of the same kind beside it (Return on a scene adds a beat under it).',
          'Press Tab to move a row in a level, and Shift+Tab to move it back out. A scene moved in becomes a beat, and whatever is under it comes along.',
          'Drag a row by its grip (⠿) to move it, with everything under it. A line above or below means it lands beside that row; an outlined row means it lands inside.',
          'Use **Collapse all** and **Expand all** to fold or open the whole outline, or the arrow on any row to fold just that one.',
        ],
        tip: 'Alt with the up or down arrow moves the selected row among its neighbours, and the arrow keys on their own walk the list.',
      },
      {
        heading: 'The research shelf',
        body: [
          'Down the left of the Outliner is the research shelf. It lists your notes that are not sorted yet, with a search box (*Search the shelf*). Its tabs show **Research**, your **Phone** notes, and your Story Sculptor map.',
          'Drag a note onto a row to sort it there. The row then lists that note at the top of the shelf; double-click it to open the rewrite screen, shape the words, and press **Add as note** (or add it as the level below) to put it in the outline under that row. The note itself goes to *Put away* once it is worked in.',
          'Drag a card from the map tab into the outline and it arrives as rows, with everything under it.',
        ],
      },
      {
        heading: 'Adding to the track',
        body: [
          'A coloured dot on each scene and beat row tells you where it stands: **red** is not in the track yet, **yellow** is in the track but its words are not in the manuscript yet, and **green** is in. Notes and ideas never go on the track, so they carry no dot.',
        ],
        steps: [
          'Select a scene (or several, with Cmd-click or Shift-click).',
          'Press **Add to track**. The scene goes onto the first track and into the script, with its beats in order.',
          'Or press **Add all to track** to send every red row at once, each where it belongs. The number beside it says how many are missing.',
        ],
        tip: 'The outline and the track stay linked both ways: move a scene in one and it moves in the other.',
      },
      {
        heading: 'Finding rows',
        body: [
          'Type in *Search the outline* to find rows. A match keeps the rows it sits under, so you can still see what it belongs to. The **Everything** list beside it shows one type at a time (Scenes, Beats, Characters and so on).',
          'The next list sets how row names are written: **As typed**, **Title Case** or **Sentence case**. It tidies a name when you leave its box, never while you are typing.',
          'With more than one row chosen, a strip appears to mark them all at once (planned, in progress, written, revised) and to **Move in** or **Move out** together.',
        ],
      },
      {
        heading: 'Printing, copying and sending',
        body: [
          '**Print…** and **PDF…** make the whole outline into a document, folded rows and all. **Copy** puts the outline on the clipboard as indented text, ready to paste into an email or another program. All three take the whole outline, whatever is folded or filtered.',
          'In a Document project, **Send…** sends the chosen rows, with everything under them, to a project. **Delete** takes the chosen rows out of the outline; a row already in the track is offered unbinding rather than deleting the scene.',
        ],
      },
      {
        heading: 'Outlines in other kinds of project',
        body: [
          'The rows are named for your format. A series outline works like a screenplay’s. An instructional book has **+ Chapter** above its sections and subsections, and Tab and Shift+Tab move a row between those levels. A Document project’s outline is its headings, with **+ Heading** and **+ Subheading**.',
        ],
        shot: 'help/instructional-outliner',
        shotAlt: 'An instructional book’s outline with numbered chapters, sections and subsections.',
      },
    ],
    related: ['story-sculptor', 'research', 'series', 'instructional'],
  },

  // -------------------------------------------------------- character creator
  {
    slug: 'character-creator',
    group: 'rooms',
    title: 'The Character Creator',
    summary:
      'Build characters through what they do on the page: traits, the moments that show them, the arc, and how they see each other.',
    sections: [
      {
        heading: 'Making a character',
        body: [
          'The Character Creator lives inside Research, under its own heading in the side menu. Your cast is listed there, grouped by character type, with main characters first.',
          'A trait such as *greedy* is telling; *leaves a tiny tip* is showing. The Creator is built around those showing moments, and whether each one has made it into the writing yet.',
        ],
        steps: [
          'Open **Research** from the bottom bar.',
          'Under **Character Creator** in the side menu, press **+ New character**.',
          'Type their name and press Return. They open in the Creator.',
          'Press **‹ Research** at the top to go back.',
        ],
        tip: 'If the script already names speakers who have no record, the menu offers to add them for you.',
      },
      {
        heading: 'Overview',
        body: [
          'The **Overview** tab is the record: **Name**, **Also called**, **Role in the story** (Protagonist, Antagonist, Supporting, Mentor, Ally, Rival, or **+ Your own**), **Character type** (which heading they are listed under), and **Who they are**.',
          '**Character description** is an optional fold for age, look and backstory. **Links** holds the book’s own topics they touch (*money*, *grief*), and **+ Add field** makes a field of your own, such as *Voice*.',
          'Beside the record, **At a glance** and **Up next** read how far along the character is. **Review in story order** and **Unused material report** open the Character review for this person.',
        ],
      },
      {
        heading: 'Traits and moments',
        body: [
          'On **Traits & Moments**, each trait is a card with its moments inside it. A moment is green once it is in the writing and red while it is still on deck. Nothing sets the colour by hand: cut the scene and the moment turns red again by itself.',
        ],
        steps: [
          'Type a trait in *Another trait* and press **+ Add trait**.',
          'Inside the trait card, type something that shows it (an action, a habit, a choice, a prop) and press **+ Moment**.',
          'To place a moment, press **+ Pin to the beat I am writing**, or choose a scene and beat and press **Pin it**.',
          'Or drag the moment onto a scene in the **Story** panel beside the traits.',
          'Use **All**, **Used**, **On deck** and **Retired** at the top to narrow what is shown.',
        ],
        tip: 'It works the other way too: select a passage in your writing, right-click and choose **Make this a character moment…**.',
      },
      {
        heading: 'The arc',
        body: [
          'The **Arc** tab draws the arc as a line: who they are at the start in a box at one end, what they become at the other. Double-click the line between two boxes to put a moment there. Under **Aiming at**, say whether the arc **Grows**, **Falls** or **Refuses to change**; if the moments you have placed tell a different story, the screen says so.',
          'A moment on the arc can be linked to the script, a theme or a motif with **+ Link**. The beginning and end are states rather than events, so they take no link.',
        ],
      },
      {
        heading: 'Relationships',
        body: [
          'The **Relationships** tab has two halves: **How they see other people** and **How other people see them**. Press **+ Relationship** to add one. Each reading belongs to one person, because two people may see each other very differently; **+ The other way** opens an empty reading from the other side. **+ Step** adds a stage to how the relationship changes over the story.',
        ],
      },
      {
        heading: 'The rail, the map and the review',
        body: [
          'Down the right of the Creator, **Characterizations** lists everything you have made for the character, each row red or green. Click a row to open it where it lives.',
          'Under **Also** in Research’s side menu, **Character map** draws the cast and the relationships between them, one line per pair with each person’s reading at their end. Click a name to open them in the Creator, or a line to see and edit both readings side by side.',
          '**Character review** reads the whole cast four ways: **In the script**, **In story order**, **Still on deck** and **Arc continuity**.',
        ],
        tip: 'Deleted a character by mistake? They wait in the **Graveyard** at the bottom of Research’s side menu until you press **Restore**.',
      },
    ],
    related: ['research', 'story-sculptor', 'outliner'],
  },
];
