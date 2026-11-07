import type { Guide } from './types';

/**
 * The guides for the four script modules: screenplay, series, stage play
 * and short form. Every label is the program's own, read from the menus and
 * the components rather than remembered.
 */
export const GUIDES_SCRIPTS: Guide[] = [
  // ---------------------------------------------------------------------------
  {
    slug: 'screenplay',
    group: 'modules',
    title: 'Writing a screenplay',
    summary:
      'Write a script the way Final Draft taught you, plan it in scenes and beats on plot tracks, and print it in the house style it is going to.',
    shot: 'modules/screenplay',
    shotAlt: 'A screenplay open in the workspace: the Script on the left, plot tracks in the middle, the inspector on the right.',
    sections: [
      {
        heading: 'The two keys: Return and Tab',
        body: [
          'A script is made of elements: **scene heading**, **action**, **character**, **parenthetical**, **dialogue**, **transition** and **shot**. Each line is one of them, and the little menu beside the line says which. You rarely need that menu, because two keys do the work.',
          '**Return** starts the next line in the style that carries on: after a scene heading or action you get action, after a character name you get dialogue, after dialogue you are back in action, and after a transition you get a new scene heading. **Tab** re-types the line you are on: action becomes a character cue, a cue becomes a parenthetical, a parenthetical becomes dialogue, and dialogue becomes a parenthetical. Tab on a character name first offers the extensions, such as (V.O.) and (CONT\'D).',
        ],
        tip: 'Type INT. or EXT. at the start of an action line and it becomes a scene heading on its own. A parenthetical puts its brackets on for you, so type only the words.',
      },
      {
        heading: 'Scenes and beats on plot tracks',
        body: [
          'The story is built from **tracks**, **scenes** and **beats**. A track is a line of the story, such as the main plot or a subplot. A scene sits on a track, and a beat is a piece of the scene you write in. The beat\'s own title is a note to yourself: it never appears in the script.',
          'The toolbar under the plot tracks makes all three. Scenes line up across the tracks in story order, so you can see the main plot and the subplot take turns.',
        ],
        steps: [
          'Click a track, then press **+ Scene** to add a scene to it.',
          'Click the scene\'s header to select it, then press **+ Beat** to give it a beat.',
          'Press **+ Track** when the story needs another line of its own.',
          'Double-click a beat to open the writing screen and write it.',
          'Double-click a scene\'s header to open its pop-up, where the slugline, summary and beats are.',
        ],
      },
      {
        heading: 'Acts and markers',
        body: [
          'An act is a **marker** on the timeline: a point in the story where something begins. Select the scene the act starts on and press **+ Marker**. In a screenplay a new marker is an act, numbered I, II, III, and it shows as a band across the Acts row.',
          'If you are writing a network episode with commercial breaks, tick **Act breaks** in **File ▸ Page setup…**. Each act then starts on a page of its own, with its name at the top and END OF under its last line.',
        ],
      },
      {
        heading: 'Page setup, house styles and the title page',
        body: [
          'A script page is set differently depending on who it is going to. **File ▸ Page setup…** shows four house styles under **Script format**, each with a sample page: **US single-camera** (the default, and what a feature or a drama is written in), **US multi-camera** (the traditional sitcom, double spaced), **BBC drama** (A4) and **BBC taped** (the studio layout, with the cue out in the left margin). The choice belongs to the project, so anyone who opens the script sees the same pages.',
          'Page setup also decides what prints: the title page, page numbers, scene headings, and scene numbers for a shooting script. **Customise…** lets you adjust each element\'s indent and width and save the result as a template of your own.',
        ],
        steps: [
          'Choose **File ▸ Title page…**.',
          'Fill in the **Title**, **Written by**, **Contact** and **Draft date** fields, or any others you need.',
          'Check the page as it will print, on the right.',
          'Press **Update page** to keep it, or **Cancel** to leave the page as it was.',
        ],
        shot: 'help/preview',
        shotAlt: 'A screenplay in Preview, showing the printed pages.',
      },
      {
        heading: 'Setups and payoffs',
        body: [
          'A payoff lands better when it has been set up, and VC Writer counts for you. A payoff should have at least three setups **before** it. One that falls after it is listed but does not count. The list in **Setups & Payoffs**, in Research, shows a red or green light and a count beside each payoff. Red is only a warning: nothing stops you writing.',
        ],
        steps: [
          'In the writing screen, right-click a passage.',
          'Choose **Make this a setup or a payoff…**.',
          'Say whether it is a setup or the payoff, and which payoff it belongs to.',
          'Use **Go to it** on any point in the list to jump back to that passage.',
        ],
        tip: 'Each payoff also gets a row on the timeline, so you can see how far apart its setups are and where it lands.',
      },
      {
        heading: 'Importing a script, and getting it out',
        body: [
          'You can bring in a script you started somewhere else. A Final Draft (.fdx) file says what every line is, so it arrives exactly as written. A PDF is read from where each line sits on the page. Either way the script arrives split into scenes, with the cast filed and the locations written up in Research. Lines VC Writer was unsure of are listed so you know what to check.',
        ],
        steps: [
          'Choose **File ▸ Import…**.',
          'Under **A new project**, choose **A script**.',
          'Press **Choose files…** and pick the .fdx or PDF.',
          'Look over what was found, then press **Import**.',
          'Save the new project where you want it to live.',
          'When it is time to send it, choose **File ▸ Export PDF…**, **File ▸ Print…** or **File ▸ Export Word document…**.',
        ],
      },
    ],
    related: ['series', 'stage-play', 'preview', 'read-back', 'outliner'],
  },

  // ---------------------------------------------------------------------------
  {
    slug: 'series',
    group: 'modules',
    title: 'Writing a series',
    summary:
      'A whole season in one project: each episode is a marker in the story, with its own title page, its own cast to hand and its own page one.',
    shot: 'modules/series',
    shotAlt: 'A series open in the workspace, with episodes marked along the timeline and the Episodes rail on the right.',
    sections: [
      {
        heading: 'One project, divided into episodes',
        body: [
          'A series is written exactly like a screenplay: the same Return and Tab rules, the same tracks, scenes and beats. What is different is that the story is divided into **episodes**. An episode is a marker: it starts at the scene the marker is on and runs until the next episode begins.',
          'Because the whole season is one project, there is one cast and one research shelf, and every episode can reach all of it. The **Episodes** rail down the right-hand edge lists every episode in order with its scenes, words and who is in it. Choose one to go to it.',
        ],
      },
      {
        heading: 'Adding an episode',
        steps: [
          'Choose **File ▸ New episode…**, or open the Episodes rail and press **+ New episode**.',
          'Give the episode a name.',
          'Under **What comes over**, tick the characters to bring along: a whole character heading, or **Whoever actually spoke in the last episode**.',
          'Tick **The setups still unpaid, noted on the episode** if you want a reminder of what is still owed.',
          'Choose whether it is plotted **On the series’ own plot tracks** or **On a fresh track for this episode**.',
          'Press **Start episode** (it carries the new number). The episode starts clean, with one scene and an empty beat, and its title page opens.',
        ],
        tip: 'Your choices under What comes over are remembered, because next week the answer is usually the same.',
      },
      {
        heading: 'Each episode’s title page and number',
        body: [
          'An episode goes out as a script of its own, so it has its own title page. Double-click an episode in the rail to open it again. Anything you leave blank falls back to the series’ own title page.',
          'The **Episode** field is where the episode is numbered: "Episode 4 — The Lamp" is episode four, wherever it sits in the running order. Two episodes cannot carry the same number, and the page says so while you type. When printed, each episode starts on its own title page and numbers from its own page one, and the stack opens with a contents page.',
        ],
      },
      {
        heading: 'Importing episodes',
        body: [
          'You can bring a season in a file at a time. Each script becomes the next episode, after the last one already there, with its own title page and marker.',
        ],
        steps: [
          'Choose **File ▸ Import…**.',
          'Under **Into this project**, choose **More episodes**.',
          'Choose the script files, Final Draft, Word or PDF, and put them in order.',
          'Press **Add to the end**.',
          'Press **Import another episode…** for the next one, or **Done** when you are finished.',
        ],
        tip: 'Starting from nothing? Import **A script**, set the format to Series or episodic, and choose several files at once: each one becomes an episode.',
      },
      {
        heading: 'Threads across the season',
        body: [
          'The **Timeline & Viewer** shows the whole season in screen time. Episodes appear in its Markers row, and under the scenes a row for each character is filled in wherever they speak. Use the character menu in its header to pick one person and dim every scene they are not in. You can see at a glance which episodes someone drops out of.',
          'Setups and payoffs work across episodes too, so a promise made in the pilot can be paid off in the finale and still be counted.',
        ],
        shot: 'help/series-outliner',
        shotAlt: 'The Outliner in a series, with each episode heading the scenes and rows beneath it.',
      },
    ],
    related: ['screenplay', 'outliner', 'preview', 'the-workspace'],
  },

  // ---------------------------------------------------------------------------
  {
    slug: 'stage-play',
    group: 'modules',
    title: 'Writing a stage play',
    summary:
      'Set a play in the house style a theatre expects, write songs into a musical, and build its title page and cast page.',
    shot: 'modules/stage-play',
    shotAlt: 'A stage play open in the workspace.',
    sections: [
      {
        heading: 'Choosing how the play is set',
        body: [
          'A stage play is laid out differently from a film script, and there is more than one way to do it. **File ▸ Page setup…** offers the stage house styles under **Script format**, each with a sample page: **US modern play** (the default), **US traditional play**, **US publisher reading copy**, **UK BBC stage**, **UK contemporary play** and **Continental reading copy**. A seventh, **US musical**, is for a play with songs.',
          'The house style belongs to the play, not to your computer, so it lives in Page setup rather than Preferences. Changing it changes the layout and the page count, never your words. **Customise…** lets you adjust any element and save your version as a template.',
        ],
        steps: [
          'Choose **File ▸ Page setup…**.',
          'Under **Script format**, choose the style the theatre or competition asks for.',
          'If you need changes, press **Customise…**, adjust the elements, and press **Save template** to keep them for your next play.',
        ],
      },
      {
        heading: 'Writing a scene, and songs',
        body: [
          'A play is written with the same Return and Tab rules as a screenplay: Return carries on in the next likely style, and Tab re-types the line you are on. A stage play adds four elements for a musical: **song title**, **lyric**, **music cue** and **dance**. Choose them from the menu beside the line, or keep pressing Tab past the script\'s own styles to reach them.',
          'After a song title, Return gives you a character cue, since someone sings the number. After a lyric, Return gives the next lyric line, the way a verse is written. Tab in a lyric turns it into spoken dialogue. In Read back, a lyric is voiced by whoever is singing it.',
        ],
      },
      {
        heading: 'Acts and scenes',
        body: [
          'Scenes and beats sit on plot tracks just as they do in a screenplay. To start an act, select the scene it begins on and press **+ Marker**. In a play the marker is an act, numbered in Roman numerals unless you change it.',
          'The number of acts you mark also feeds the title page, which uses it to suggest a description such as "A Play in Two Acts".',
        ],
      },
      {
        heading: 'The title page and the cast page',
        body: [
          'A play’s title page says what the work is, under the title. **What it is** offers suggestions built from the play itself, such as "A Musical in One Act", and you can type your own. On a musical, **Add book, music and lyrics** adds those credit lines for you.',
          'The cast page is built from your script, so it never falls out of step. Characters are listed in the order they first enter, or by the cast’s headings, and renaming someone in the Character Creator renames them here too.',
        ],
        steps: [
          'Choose **File ▸ Title page…**, fill it in, and press **Update page**.',
          'Choose **File ▸ Cast page…**.',
          'Pick an **Order**: **As they enter** or **By the cast’s headings**.',
          'For each role, add the line under the name, a playing age and, on a musical, a vocal range.',
          'Choose who a role is doubled with, if one actor plays more than one part.',
          'Add the **Time**, **Place** and **Notes**, then press **Update page**.',
        ],
        tip: 'Untick a role to keep it off the cast page. Everything you typed for it is kept.',
      },
      {
        heading: 'Printing and exporting',
        body: [
          'The printed play opens with the title page, then the cast page, then the script. Page setup decides whether each front page prints, with **Print the title page** and **Print the cast page**.',
          'Theatres and publishers often ask for a Word file. **File ▸ Export Word document…** gives every line a paragraph style named for what it is, such as Character, Dialogue or Lyric, so a literary manager can restyle the whole play at once. **File ▸ Export PDF…** and **File ▸ Print…** give you the pages exactly as they look in Preview.',
        ],
      },
    ],
    related: ['screenplay', 'character-creator', 'preview', 'read-back'],
  },

  // ---------------------------------------------------------------------------
  {
    slug: 'short-form',
    group: 'modules',
    title: 'Writing short form',
    summary:
      'Commercials, spots and web videos on an AV sheet: what is heard beside what is seen, shot by shot, timed to the second.',
    shot: 'modules/short-form',
    shotAlt: 'A short-form project: the AV sheet in the middle, with the board and timeline docked under it.',
    sections: [
      {
        heading: 'The AV sheet',
        body: [
          'In a short-form project the script is replaced by the **sheet**, the two-column document the business has always used. Each row is a **shot**, with **Audio** (what is heard) and **Visual** (what is seen) side by side, an **Image** for its frame, and its **Duration**. Shots are numbered for you, 1.1, 1.2, 2.1, from the order they are in.',
          'Shots are grouped into **segments**. Give each segment a name and a line saying what it is for. Each segment ends with its own running time and word count, and the totals so far. The title at the top comes from the title page, so set it there with **File ▸ Title page…**.',
        ],
        steps: [
          'Type what is heard into **Audio**. Press Return for the next line.',
          'Press Tab to mark a line as spoken dialogue: it goes into quotation marks. Press Tab again to take them off.',
          'Type what is seen into **Visual**.',
          'Press **+ Shot** at the foot of a segment for the next shot.',
          'Press **+ Segment** to start a new segment, then type its name.',
          'Drag a shot by its number to move it, even into another segment.',
        ],
        tip: 'Closing a shot asks first, "Close shot 1.3?", so you can choose **Close it** or **Keep it**.',
      },
      {
        heading: 'Frames and pictures',
        body: [
          'Every shot has a plate in the **Image** column. Drop a picture or a clip on it, or click it to choose one. The audio and visual beside it space out to line up with the frame. Pictures are stored inside the project file, so the board travels with it when you send it.',
          'A clip brings its own length, shown on the **Video** line under Duration. Sound and picture run at the same time, so a shot lasts as long as the longer of the two. When the picture runs past the sound, the sheet says **holds**.',
        ],
      },
      {
        heading: 'Timing each shot',
        body: [
          'A shot is rarely just its line. Something happens, someone speaks, something else happens. So each shot has three times: **Header** (the action before the line), **Dialogue** (how long the line takes) and **Tail** (the action after it). Type times as 4, 0:04 or 00:04.',
          'The dialogue time is estimated from the words, at about two and a half words a second, and shows in italic until you type over it. Clear the box and it goes back to the estimate. **Words +/−** shows what the line’s words come to, and the sheet tells you quietly when a line has more words than its time allows.',
        ],
      },
      {
        heading: 'Running time and the time constraint',
        body: [
          'The top of the sheet shows the **Total RT** and the total words. Type the length you have to hit, such as 30 or 00:30, into **Time constraint**. If the board runs long, the total turns red and the sheet says how much over you are, for example "Over by 00:04".',
          'Nothing is refused. You can write the long version and cut it later. The sheet makes sure you know where you stand.',
        ],
      },
      {
        heading: 'The board, and playing it',
        body: [
          'Under the sheet is the **Timeline**. Along the top is the board, one frame per shot, each as wide as the time it holds. Below it are the segments, with the dialogue stretched along its time. The sheet and the timeline are one thing seen twice: add or move a shot on the sheet and the timeline follows.',
          'Press **▶ Play** at the top of the sheet to play the board like an animatic. The frames advance at their durations, a gold playhead runs along the timeline, and the audio is read aloud in the voices you have assigned. Narration uses the narrator’s voice. Press **■ Stop** to stop.',
        ],
        tip: 'The board holds each shot for the time you gave it, even if the voice has not finished. That is how you find out whether a thirty is really a thirty.',
      },
      {
        heading: 'Printing the sheet and the board',
        body: [
          'A short-form project gives you two documents. **The sheet** prints portrait, just as it looks on screen, for the client and the producer. **The board** prints landscape, with frames in strips of four and the dialogue and action boxed under each, for the wall. Both open with the title page, which you can turn off in **File ▸ Page setup…**.',
        ],
        steps: [
          'Open **Preview** from the bar along the bottom of the window.',
          'Choose **Sheet** or **Board** at the top.',
          'Press **Print…** or **Export PDF…**. Either one acts on whichever document you are looking at.',
          'Or use **File ▸ Print the board…** and **File ▸ Export the board as PDF…** to go straight to the board.',
        ],
        shot: 'help/short-form-preview',
        shotAlt: 'A short-form project in Preview, showing the sheet ready to print.',
      },
    ],
    related: ['read-back', 'preview', 'the-workspace', 'screenplay'],
  },
];
