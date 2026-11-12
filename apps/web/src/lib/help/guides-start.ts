import type { Guide } from './types';

/**
 * The four guides a new writer reads first (group 'start'): getting the
 * program, finding your way round the Write page, how your work is kept, and
 * the phone. Every label is the program's own, as it appears on screen.
 */
export const GUIDES_START: Guide[] = [
  {
    slug: 'getting-started',
    group: 'start',
    title: 'Getting started',
    summary: 'Buy and install VC Writer, activate it, and start or open your first project.',
    shot: 'help/new-project',
    shotAlt: 'The New project panel: Title, Author, the format cards and where the project will be saved.',
    sections: [
      {
        heading: 'Buy and download',
        body: [
          'VC Writer is a subscription that runs on Windows 10 and 11 (64-bit) and on macOS, both Apple silicon and Intel. Pick the platform you want to install on first. Your subscription covers the other one as well, so you can switch later.',
        ],
        steps: [
          'Go to **vc-writer.com/download**.',
          'Choose a plan, then choose **Download for Windows** or **Download for Mac**.',
          'If you have a discount code, type it under **Discount code** and press **Apply**.',
          'Press **Continue to checkout** and pay.',
          'When the purchase is complete, download the installer. You can download it again at any time from **My account**, under **Downloads**.',
        ],
        tip: 'Lost the email with your licence? On **My account**, press **Email me my license again**.',
      },
      {
        heading: 'Install it',
        body: [
          'On Windows, run **VC-Writer-…-Setup.exe**. The installer lets you choose where the program goes, and it puts a shortcut on your desktop.',
          'On a Mac, open **VC-Writer-…-mac.dmg** and drag VC Writer into your Applications folder. There is one Mac installer, and it works on every Mac.',
        ],
      },
      {
        heading: 'Sign in and activate this computer',
        body: [
          'The first time VC Writer opens, it asks you to activate it. Until you do, your work opens, prints and exports, but it cannot be changed. Once a computer is activated, it keeps working offline.',
        ],
        steps: [
          'In **Activate VC Writer**, type the email address you bought VC Writer with and press **Email me a code**.',
          'Type the 6-digit code from the email and press **Sign in**.',
          'Press **Activate this computer**.',
          'Press **Start writing**.',
        ],
        tip: 'If your account has more than one licence, choose **Use a serial number instead** and type the serial. You can free a computer you no longer use on your account page.',
      },
      {
        heading: 'Start a new project',
        body: [
          'The first screen you see is where projects start. Choosing the format is the first decision, and it decides how the program speaks to you: a screenplay has scenes and beats, a novel has chapters.',
        ],
        steps: [
          'Under **New project**, type a **Title**.',
          'Type your name under **Author**. It goes on the title page.',
          'Under **Format**, press the card for the kind of work you are writing: Screenplay, Series or episodic, Novel, Instructional book, Stage play, Short stories and collections, Short form or Document.',
          'Check **Where it goes**. This is the folder the project is saved in. Press **Change…** to choose another.',
          'Press **Create project**.',
        ],
        tip: 'Any folder will do, including one that iCloud Drive, Dropbox or OneDrive keeps in step. The file is named from the title, and nothing already in the folder is replaced.',
        shot: 'help/new-project',
        shotAlt: 'The New project panel with the format cards and the Where it goes row.',
      },
      {
        heading: 'Open a project you already have',
        body: [
          'The **Open** panel, beside New project, lists your work. **In your projects folder** shows every project in the folder, newest first, with its format and when it was last changed. **Opened on this computer** shows the projects you have opened on this machine recently. Click a name to open it.',
        ],
        steps: [
          'To open a file that is not on either list, press **Open a project file…** (or, with a project already open, choose **File ▸ Open…**).',
          'Find the project file (it ends in **.vcw**) and open it.',
        ],
        tip: 'With a project open, **File ▸ New project…** brings you back to this screen. Press **← Back to** your project to return without changing anything.',
      },
      {
        heading: 'Try a sample project',
        body: [
          'There is a finished sample for every kind of project: a screenplay (*Night of the Living Dead*), a series (Sherlock Holmes), a stage play (*Hamlet*), a novel (*Great Expectations*), short stories (Poe), an instructional book, a short-form spot and a document. The classics are all in the public domain.',
        ],
        steps: [
          'On the start screen, open **Open a sample…** under the Open buttons.',
          'Click the sample you want. It opens as a new project of your own, saved in your projects folder.',
        ],
        tip: 'Change a sample as much as you like: it is your copy. Open the sample again for a fresh one.',
      },
    ],
    related: ['the-workspace', 'saving-and-recovery', 'screenplay', 'novel'],
  },

  {
    slug: 'the-workspace',
    group: 'start',
    title: 'Finding your way round',
    summary: 'The Write page, the plot tracks, the Inspector, the bar along the bottom, the menus and the two keys you write with.',
    shot: 'modules/screenplay',
    shotAlt: 'The Write page of a screenplay: the script on the left, the plot tracks and Inspector on the right, the timeline below.',
    sections: [
      {
        heading: 'The Write page',
        body: [
          'Every project opens on the **Write** page. Down the left is your script (in a novel, the manuscript): the whole thing in story order, written and edited in place. To its right are the **plot tracks**, with the **Inspector** beside them, and the **Timeline & Viewer** underneath.',
          'Selecting something anywhere selects it everywhere. Click a scene on the tracks and the script, the timeline and the Inspector all move to it.',
        ],
        shot: 'modules/screenplay',
        shotAlt: 'The Write page of a screenplay.',
      },
      {
        heading: 'Plot tracks, scenes and beats',
        body: [
          'Each plot track is one thread of the story: the main plot, a subplot, a character’s line. Scenes sit in the tracks as blocks, as wide as the pages they take, with their beats listed inside. One click selects a scene or a beat; a double-click opens it. Double-clicking a beat opens the writing screen, the beat on its own as a page.',
          'The buttons under the tracks add to the story. Their names follow your format, so a novel says **+ Chapter** where a screenplay says **+ Scene**.',
        ],
        steps: [
          'Click a track, then press **+ Scene** to add a scene to it.',
          'Click a scene, then press **+ Beat** to add a beat inside it.',
          'Press **+ Track** to start a new plot track.',
          'Click a scene and press **+ Marker** to mark a point in the story there, such as an act or a chapter.',
        ],
        tip: 'Scenes, beats and tracks can all be dragged to a new place.',
      },
      {
        heading: 'The Inspector and the Timeline & Viewer',
        body: [
          'The **Inspector** shows the details of whatever is selected: a beat’s title, status and summary, a scene’s label and notes, a track’s name and colour. What you type there shows in the script and on the tracks at once.',
          'The **Timeline & Viewer** is the overview. It lays the story out in running time and shows who and what runs through each scene: a row for each character, filled wherever they speak, and a row for each theme.',
        ],
      },
      {
        heading: 'Writing: Return and Tab',
        body: [
          'A script is written the way Final Draft taught a generation of writers. **Return** starts the next line in the style that naturally follows: after a scene heading comes action, after a character’s name comes dialogue. **Tab** re-types the line you are on: press it on an action line and the line becomes a character cue. **Shift+Tab** walks back through the styles.',
          'In prose, Return starts a new paragraph, and Tab changes the style of the line you are on.',
        ],
        tip: 'Type INT. or EXT. at the start of a line and it becomes a scene heading on its own.',
      },
      {
        heading: 'The bar along the bottom',
        body: [
          'The left of the bar holds the pages: **Home**, **Write**, **Preview** (the pages as they will print), **Editors** (the Daily editor and the Final editor), and **Read back**, which reads your work aloud. An Instructional book also has an **Outline** page.',
          'To the right are the rooms, which open over the page you are on: **Research**, **Sculptor**, **Outliner** and, in a novel or short stories, **Layout**. **Focus** hides everything but the script; press **Leave focus · Esc** to come back.',
        ],
        shot: 'help/focus',
        shotAlt: 'Focus mode: the script alone, full width.',
      },
      {
        heading: 'The menus and the Home page',
        body: [
          '**File** holds New project, Open, Save, printing and exporting, **Preferences…**, **Account…** and **Recovery…**. **Editor** has Undo, Find, the editors and Read back. **Reports** has the **Writing log…** and **Story statistics…**. **Window** lets you move any part of the workspace into a window of its own, for a second monitor, and **Reset windows to default** puts everything back. **Help** has **What this build does** and **About VC Writer**.',
          'The **Home** page is the project itself: its title, author, genre, logline, elevator pitch, synopsis, notes and status, with a picture for key art. Beside them, **Where you left off**, **Where it stands** and **Recent work** say how the writing is going, and **One-sheet** prints or emails a page made from what you have filled in.',
        ],
        shot: 'help/project-home',
        shotAlt: 'A project’s Home page with the logline, synopsis and where it stands.',
      },
    ],
    related: ['getting-started', 'saving-and-recovery', 'research', 'focus', 'preview', 'editors'],
  },

  {
    slug: 'saving-and-recovery',
    group: 'start',
    title: 'Saving and recovery',
    summary: 'How VC Writer saves as you write, how to save somewhere else, and how to get an older version back.',
    sections: [
      {
        heading: 'It saves as you write',
        body: [
          'VC Writer saves your project every few seconds while you work, and again when you close it. You do not have to remember to save. The word at the top right of the window says where things stand: **Unsaved changes**, **Saving…**, then **Saved**.',
          'To save straight away, choose **File ▸ Save** (Ctrl+S on Windows, ⌘S on a Mac).',
        ],
      },
      {
        heading: 'Save as, or save a copy',
        body: [
          'The two look alike but leave you in different places. **Save as** moves you: you carry on in the new file, and the old one stays where it was, holding the work as it stood. **Save a copy** leaves a copy behind and keeps you where you are. A copy has “copy” added to its title, so you can tell the two apart.',
        ],
        steps: [
          'Choose **File ▸ Save as…** (Ctrl+Shift+S, or ⌘⇧S on a Mac), or **File ▸ Save a copy…** (Ctrl+Alt+S, or ⌘⌥S).',
          'Choose a folder and a name. The dialog opens in the folder the project is already in.',
          'Press Save. The new file goes on your recent list, so it is easy to find again.',
        ],
        tip: 'Inside a room such as Research or the Outliner, the menus are covered. Use the **Save ▾** button on the room’s own bar instead.',
      },
      {
        heading: 'Your projects folder',
        body: [
          'New projects go into one folder, shown under **Where it goes** on the New project screen. Change it there, or in **File ▸ Preferences…** under **Projects folder**. A cloud drive’s folder works like any other.',
          'If you use VC Writer on more than one computer, point each of them at the same cloud folder. Every computer then lists every project under **In your projects folder**. Work on a project on one computer at a time, so the cloud drive never has two versions to choose between.',
        ],
      },
      {
        heading: 'Getting an older version back',
        body: [
          'As you write, VC Writer keeps recovery points: copies of the project taken along the way, and before anything that rewrites the file. They are kept in a folder beside the project.',
        ],
        steps: [
          'Choose **File ▸ Recovery…**.',
          'Under **Snapshots**, find the copy you want by its date and time.',
          'Press **Restore**.',
        ],
        tip: 'Restoring takes a snapshot of what you have now first, so you can always change your mind.',
      },
      {
        heading: 'Changes from a sync',
        body: [
          'If you sync a project and the same thing was changed in two places, VC Writer keeps one version and lists the other on the Recovery page under **Overwritten by a sync**. Press **Show what was overwritten** to read it, or **Put that version back** to use it instead.',
        ],
      },
      {
        heading: 'Moving between Windows and Mac',
        body: [
          'A project is one file ending in **.vcw**, and it is the same file on both platforms. A project written on Windows opens on a Mac, and the other way round. Copy the file across, or keep it in a cloud folder both computers can see, and open it with **File ▸ Open…**.',
        ],
      },
    ],
    related: ['getting-started', 'the-workspace', 'phone-notes'],
  },

  {
    slug: 'phone-notes',
    group: 'start',
    title: 'Notes from your phone',
    summary: 'Catch a thought on your phone with VC Writer Notes, then file it into your project on the desktop.',
    shot: 'help/research',
    shotAlt: 'The Research room, where notes from the phone arrive under Mobile App.',
    sections: [
      {
        heading: 'VC Writer Notes',
        body: [
          'VC Writer Notes is a voice notebook for iPhone and Android, for catching a thought while you walk. The phone catches the note; the desktop decides where it goes. Nothing goes into your project until you put it there.',
          'Sign in on the phone with the email address you bought VC Writer with, and your password. You only sign in once. Notes is a subscription bought in the app; without one, notes are kept on the phone and not sent until you subscribe.',
        ],
      },
      {
        heading: 'Choose the project',
        body: [
          'The phone always opens on your list of projects, so you never dictate into the wrong one by accident. Tap a project to start taking notes for it. **Which projects** chooses which ones the list shows, and **New project** starts one from the phone.',
          'In a collection of short stories, a **Story** list on the note screen chooses which story the note is for.',
        ],
      },
      {
        heading: 'Take a note',
        body: [
          'First choose the kind of note with the small buttons at the top of the controls. The kinds follow the project: a story offers Character, Setting, Dialogue, Plot Point, Arc, Idea, Theme and Research, among others.',
        ],
        steps: [
          'Tap **🎙 Dictate** and say the note’s title. When you pause, the phone moves on to the note itself.',
          'Say the note. Tap **Title** or **Note** under **Dictate into** to choose which box the words go into.',
          'To type instead, tap **⌨ Keyboard** in the corner. Tap **⌄ Hide** to put the keyboard away.',
          'Tap **Read it back** to hear what you have.',
          'Tap **Save it**. The button reads **✓ Saved and sent** once the note has gone.',
        ],
        tip: 'Out of signal? The note reads **Saved on this phone — not sent** and goes the next time it can. **↺ Reset** clears a note and starts again.',
      },
      {
        heading: 'Hands free',
        body: [
          'Tap **Hands free** to take notes without looking. The phone asks what kind of note it is, then its title, then the note, and shows each question in large type. When you have finished, say “save”, “continue”, “read it back”, “start over” or “throw it away”.',
        ],
      },
      {
        heading: 'Notes arriving on the desktop',
        body: [
          'Open your project on the desktop, signed in to the same account, and open **Research**. Notes from the phone wait under **Mobile App**, each headed as it was on the phone, with its kind, its title and the day you caught it.',
        ],
        steps: [
          'In **Research**, click **Mobile App**. The **This project** tab lists the notes waiting for this project.',
          'Read the suggestion under a note, then press **File it there** to accept it.',
          'Or drag the note onto a folder, or onto somebody in the cast, down the left.',
          'Or press **Move…** to correct its words, choose a folder and press **File it there**.',
          'Press **×** to set a note aside. It moves to the **Archive** tab rather than being lost.',
        ],
        tip: 'If a note was said under a project with a different name, find it on the **On the phone** tab and press **Transfer to this project**.',
        shot: 'help/research',
        shotAlt: 'Research with Mobile App open, showing notes waiting to be filed.',
      },
      {
        heading: 'Filed notes, and fixing a title',
        body: [
          'A filed note becomes a Research note that keeps its kind, title and date. It goes to the folder whose name matches its title, or else to the folder for its kind, such as Ideas or Themes; VC Writer makes the folder the first time one is needed.',
          'If a dictated title came out wrong, double-click the note in Research. Its title is the field at the top of the window that opens: type over it, and it is saved as you type.',
          'On the phone, **Review** shows a filed note as **✓ Transferred to VC Writer**. **Clear transferred notes** takes them off the phone; they stay in your project and in the desktop’s Archive.',
        ],
        shot: 'help/research-note',
        shotAlt: 'A phone note opened in Research, with its title ready to retype.',
      },
      {
        heading: 'Recently deleted',
        body: [
          'A note you delete — on the phone, on the desktop or on the website — is kept in **Recently deleted** for 30 days before it is gone for good.',
        ],
        steps: [
          'On the phone, tap **Account**, then **Recently deleted notes**.',
          'Tap **Restore** under a note to put it back where it was, or **Restore all**.',
          'Tap **Delete now** to remove one sooner, or **Empty Recently deleted** to remove them all.',
          'On the desktop, open **Research**, click **Mobile App** and choose the **Recently deleted** tab to do the same.',
        ],
      },
    ],
    related: ['research', 'getting-started', 'saving-and-recovery'],
  },
];
