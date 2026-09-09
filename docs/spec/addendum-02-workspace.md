# Addendum 02 — The writing workspace

Status: approved for build, 8 September 2026. Extends §5 (story structure)
and §6 (writing workspace) of the master specification, and replaces the
layout paragraph in `docs/brand.md`. The master spec says *what* the
structure is — lanes hold scenes, scenes hold beats, beats hold manuscript —
and asks for a professional editor with structural panels. It does not say
how those are arranged on screen. This addendum does.

## 1. Objective

The workspace is laid out like a non-linear video editor's edit page, for
writing. The left quarter, top to bottom, is the **master panel**: the
script itself, and under a second tab the research. To its right, above, is
the **viewport**, where an editor shows the picture and this shows the
story: the selected scene as it prints, or the whole story as a diagram of
its threads. Beside the viewport is the **inspector**, with the properties
of whatever is selected. Below them is the **master timeline**: the story in
order, its plot lanes as tracks, scenes as blocks in the lanes, beats inside
the scenes, and every setup, payoff and link drawn across it as a curve.
Selecting anything in any window selects it everywhere.

The arrangement is familiar to anyone who has used Causality (Hollywood
Camera Work) — script, lanes and blocks, properties — and the finish is
DaVinci Resolve's: flat dark panels, hairline separators, small uniform
controls, one accent, tracks with headers, a playhead, pages along the
bottom. The palette does not change; it is `docs/brand.md`'s black, gold and
red. What changes is that the gold is spent sparingly, on selection and the
working accent, and the surfaces do the rest.

The workflow itself is VC Writer's own. Nothing here copies another
product's behaviour; the layout is what is familiar.

## 2. Names

These are the names used in the interface and in code. Earlier names in
parentheses are retired.

| Name | What it is |
| --- | --- |
| **Master timeline** (was: structure board, timeline strip) | The story in order, below the viewport: ruler, acts, links, then one track per plot lane |
| **Timeline & Viewer** (was: viewport) | Above the lanes, where the viewer would be: the scenes in time, and the characters, themes and links that run through them |
| **Plot pop-up** | The plot's summary and arc, opened from a lane's track header |
| **Plot lane** | A track on the master timeline; a story thread (§5.1) |
| **Scene block** (was: unit column, scene group) | A scene or chapter as it appears in a lane, with its beats inside |
| **Links track** | The row of the timeline where setups, payoffs and story links are drawn |
| **Master panel** | The left editor window: the **Script** tab and the **Research** tabs |
| **Script** (was: the beat editor) | The whole manuscript in story order, editable in place |
| **Inspector** | Properties of the selected beat, scene, lane and act |
| **Page bar** | The row of pages along the bottom: Write, Preview, Editors, Read back, Captures, Recovery |
| **Act marker** | A labelled point in the story order, drawn as a band on the timeline |

"Plot lane", "scene", "chapter" and "beat" keep their meanings from §5.

## 3. Layout

The Write page, which is the workspace, in the proportions of an editor's
edit page: a quarter for the script column, and of the rest just under half
for the viewport above the lanes.

```
┌ title bar ─────────────────────────────────────────────────────────────────┐
│ VC WRITER · Project title                    pages · beats · words  Focus ⚙ │
├──────────────┬────────────────────────────────────────────────┬────────────┤
│ MASTER PANEL │ VIEWPORT   Page | Threads   SC 2 · MEGA CHURCH  p. 1 / 4 │ INSPECTOR  │
│ Script│Resrch│ ┌──────────────────────────────────────────┐  │ Beat       │
│ ─────────────│ │                                          │  │  title     │
│ ▾ Sc 1 · HOME│ │      the scene, as it prints             │  │  status    │
│   ▾ Home life│ │                                          │  │ Scene      │
│     INT. …   │ └──────────────────────────────────────────┘  │ Lane       │
│     He liste…│  1 / 13 · Home life     ⏮ ◀ ▶ ⏭              │ Act        │
│   ▾ On the … ├════════════ divider ═══════════════════════════┴────────────┤
│     …        │ Pages │ 1        │ 2      │ 4              │ 5   │           │
│              │ Acts  │ ACT I ────────────┤ ACT II ─────────────────         │
│              │ Links │   ╭───────────────╮      ╭──────╮                    │
│              │ P1 Main    [Sc 1 ▸ ▸ ] [Sc 2 ▸ ]   [Sc 4 ▸ ▸ ▸ ]             │
│              │ P2 Subplot              [Sc 3 ▸ ]         [Sc 5 ▸ ]          │
│              │ + Scene  + Beat  + Lane  + Act    zoom ───●───   Inspector ▣ │
├──────────────┴─────────────────────────────────────────────────────────────┤
│              WRITE  PREVIEW  EDITORS  READ BACK  CAPTURES  RECOVERY        │
└────────────────────────────────────────────────────────────────────────────┘
```

This is the **default** arrangement, not a fixed one. Each section sits in
one of four places and can be moved to any other, or taken out into a window
of its own; §8 has the rules.

The title bar carries the two controls that must not depend on any
particular section being in the workspace: **Research**, which opens the
research window (§7), and a chip for each section that is currently in a
window of its own, which brings it back. Research used to be a tab beside
the Script, which meant that taking the Script to another monitor took
research with it; that was wrong, and it lives here now.

The strip along the top of each section — its name, the menu of places, and
the control that takes it out — is 18px and carries nothing else, because a
section's own controls belong inside it.

- The divider between the master panel and the stage drags, as does the one
  between the viewport and the timeline. Both positions are remembered per
  machine (a preference, not project data).
- The inspector is 300px and can be hidden from the timeline toolbar or with
  `Ctrl/Cmd+Shift+P`; hidden is remembered too.
- The timeline can be hidden with `Ctrl/Cmd+Shift+L` to give the viewport
  the height, and shown again the same way.
- Focus mode (`Ctrl/Cmd+Shift+F`, `Escape` to leave) keeps only the Script,
  full width, and dims the title bar. Unchanged from §6.
- Below 1100px of window width the inspector hides itself.

The other pages (Preview, Editors, …) are unchanged and fill the area
between the title bar and the page bar.

## 4. Master timeline

The horizontal axis is **story order measured in pages**, and therefore in
time: a page is a minute (§5), so the ruler carries both and the toolbar's
zoom is the scale of a sequencer. Each scene block is as wide as the pages
it takes. The floor under an empty scene is a *fraction of a page* rather
than a fixed number of pixels, so every block answers the zoom — a timeline
whose short clips stop responding to the zoom is not a timeline. A long
scene is a wide block, and a glance at a lane says where the story's weight
is. That is §5.1's "lane dimensions adapt to contained material" made
literal.

Tracks, top to bottom, each with a header on the left the way an editor
names its tracks:

1. **Pages · time.** The ruler: the page each scene starts on and the minute
   it starts at, at the block's left edge; the tail carries the total of
   both. A zoom slider on the toolbar sets pixels per page; ruler and blocks
   share the scale.
2. **Acts.** Act markers as labelled bands from one marker to the next. A
   project without markers shows an empty track; `+ Act` on the toolbar
   starts one at the selected scene. The band is the only place the display
   face is used inside the timeline.
3. **Links.** Every setup and payoff (§7.3) and every story link (§7.4) whose
   two ends fall in different scenes, drawn as a curve from the scene where
   it starts to the scene where it lands. A setup with a recorded payoff is
   a solid gold curve; one still waiting for its payoff is a dashed curve
   that ends in the air; a story link is a thin muted curve. Hovering names
   it; clicking selects the scene it lands in. This is the track that shows
   whether the story's promises are kept, in one look.
4. **One track per plot lane**, in lane order. The header carries the
   track's code — `P1`, `P2`, the way an editor labels `V1`, `V2` — its name
   (rename in place), scene count and collapse. Clicking the code opens the
   **plot pop-up**: the plot's name, kind and colour, its **summary**, and
   its **arc** — how the thread develops — as text to think in, over the
   workspace. Closing it returns to the lanes with nothing else changed;
   what was typed is kept as it was typed. In
   the body, that lane's scene blocks sit at their story position, and the
   space a scene in *another* lane occupies is left empty, so blocks line up
   vertically across lanes and the eye can read the interleaving: main plot,
   subplot, main plot. A collapsed lane is one thin row of bars.

A **scene block** shows its sequence label and title in a header and its
beats as compact rows — a status glyph, the title, and at the right a dot
per character who speaks in the beat, in the character's colour (§6) —
stacked in order. A beat the writer has coloured carries that colour as an
edge on its row, and in the Script and the Threads view.
Clicking a beat row selects it; clicking the header selects the scene's
first beat and opens the **scene pop-up**; double-clicking a beat row opens
the **beat pop-up**. Blocks collapse to a header. The **playhead** is a
gold rule through every track at the left edge of the selected beat's
scene, the way an editor's playhead marks the frame; it moves when the
selection does. A scene that is **switched off** (below) is drawn dimmed
with a dashed edge, still at its story position.

### The scene pop-up

Opened from a scene block, or by double-clicking a scene bar in the Script.
Laid out the way an editing program's clip dialog is, and differently from
the plot pop-up:

- The **scene's name**, top centre. To its left the sequence label and the
  lane; to its right the **in-script switch** and Close.
- Under the name, for a screenplay, the **slugline** as three fields —
  INT./EXT., the location, the time of day — exactly as it reads in the
  script. They are not stored anywhere of their own: they read from, and
  write back to, the scene's first scene-heading element, so a heading
  typed in the Script shows here and one set here appears in the Script. A
  scene with no heading yet gets one at the top of its first beat. A novel
  or short story has no slugline, so the row is not there.
- A **left column** that fills itself from the text: the **characters**
  who speak in the scene, in order of first line, and the **setups and
  payoffs** placed in or landing in the scene (§7.3), each marked *setup*
  or *payoff*.
- A **right column** listing the scene's **beats** in order. Selecting one
  and pressing **Split at this beat** cuts the scene there: that beat and
  everything after it become the next scene along — same lane, untitled,
  taking the story position immediately after this one, with everything
  after it scooting along as an editing timeline does. Nothing about the
  manuscript changes; the script reads exactly as it did before the cut. A
  cut at the first beat would leave an empty scene behind and is refused.
  Double-clicking a beat in the list opens it in the writing screen (§7).
- The rest: status, label, summary, notes, the beat and page count, and how
  long the scene plays.

The **in-script switch** takes the scene out of the script without
deleting it: off, the scene leaves the Script, the page view, the preview,
every export and the page count, and stays on the timeline, dimmed, where
it opens and switches back on. It is a way to hold a scene in reserve
while trying the story without it. The field syncs with the scene.

### The beat's screen: where the writing happens

Double-clicking a beat — on the timeline, on its name in the Script, or on
the **✎** in the Script's margin — opens **the writing screen**: that one
beat, most of the window, the page on a desk. This is the main writing
place. It has no sidebar: what is not the page is one bar across the top,
carrying the three things that belong to the beat as a whole.

- The beat's **name**, centred, captioned *Beat name*.
- **Version**: the version being written, every kept version by name, and
  *New version…*. A new version asks for a name inline and starts as a copy
  of the working text, which is kept under its old name; what is typed from
  then on belongs to the new one. Choosing a kept version brings its text
  back and keeps the text that was there in its place. A beat holds as many
  versions as the writer wants, each in full. The Script shows the working
  version's name beside a beat that has more than one.
- **In script**: a checkbox. Off, the beat keeps its text and leaves the
  script, the page count and every export — the same switch a scene has
  (§4) — and its row on the timeline is struck through.

Below the bar is the page, and nothing else — and it is a **page**, not a
column of text on a dark ground. US Letter is 8½ by 11, and a script's
margins are an inch and a half at the left, where the brads go, and an inch
on the other three sides. That leaves a six-inch column, which is exactly
sixty characters of 12pt Courier: the geometry the paginator counts in, so a
line that turns here turns on paper. The rules across it are the printed
page breaks, from the same paginator the PDF uses.

The **Page** control in the status line scales the whole page rather than
the text alone, from 75% to 160%, so what is on screen stays a page and
never becomes a wider one. The rest of the status line names the scene and
lane the beat is in, its word count, and the two keys.

The writing screen is the same component whether it opens over the workspace
or in **a window of its own** on another monitor (§8); the bar carries the
control that moves it there.

Colour, status, summary, links and what the beat sets up or pays off are
the **inspector's** business (§9) rather the page's, so that the
writing screen is the page.

### 7.1 The two keys

The manuscript is written the way Final Draft taught a generation to write
one, and the rules live in the domain (`editing.ts`) so they are pinned by
tests rather than by a keydown handler:

| Style | Return gives | Tab makes this line | Shortcut |
| --- | --- | --- | --- |
| Scene heading | Action | Action | Ctrl/Cmd+1 |
| Action | Action | Character | Ctrl/Cmd+2 |
| Character | Dialogue | Parenthetical | Ctrl/Cmd+3 |
| Parenthetical | Dialogue | Dialogue | Ctrl/Cmd+4 |
| Dialogue | Action | Character | Ctrl/Cmd+5 |
| Transition | Scene heading | Scene heading | Ctrl/Cmd+6 |

**Return** starts the next line in the style that continues the work;
**Tab** re-types the line you are on; **Shift+Tab** walks back. (Causality's
variant starts a new line on Tab and sends a cue to dialogue; Final Draft's
is the table above, and it is the one implemented.) Return on an empty
parenthetical drops it and returns to the speech. Shot is Ctrl/Cmd+7 and a
note is Ctrl/Cmd+9; prose has heading, paragraph, blockquote and scene break
on 1–4, and Tab there walks the ring in place.

**A line becomes what it plainly is.** Type `INT.` or `EXT.` at the head of
an action line and it is a scene heading; type `CUT TO:` on its own and it
is a transition. Shot detection (`ANGLE ON`, `INSERT`, `POV`) is off by
default, because those are words writers use in action.

**SmartType.** A character cue completes from the cast and from every cue in
the script, offering whoever is most likely to speak next — the beat's own
speakers first, and the one who just spoke last, because dialogue
alternates — with the extensions `(CONT'D)`, `(O.S.)`, `(O.C.)`, `(V.O.)`
offered on the likeliest few. A slugline completes from the headings the
script already has, plus every location it knows crossed with INT./EXT. and
the times of day, so the second scene in a location is a few keystrokes.

**(MORE)** and **(CONT'D)** are the paginator's, and have been since §6 of
the main spec: a speech split across a page break is marked at the foot and
resumed under `NAME (CONT'D)`, and a scene heading or a cue never ends a
page.

**Emphasis.** `Ctrl/Cmd+B`, `I` and `U` put bold, italic and underline on
the selection, and take it off again. It is written into the text with the
marks the screenplay world already uses — `**bold**`, `*italic*`,
`_underline_`, `\*` for a literal star — so a project file stays plain text
(§14) and a script exported to Fountain keeps its emphasis. A mark counts
only when it is closed, so `5 * 3` and `a_b` are what they look like.

While writing, the styling is drawn *under the cursor*: behind each line
sits the same characters wearing their emphasis, marks and all, dimmed. The
editor does not become a rich text engine and nothing shifts as it is
typed. On the page — the viewport, the preview, the PDF, the printed
document — the marks are gone and only the emphasis is left, and the
paginator wraps on the printed text, so a bold line takes the width it will
actually take.

**Dual dialogue.** `Ctrl/Cmd+Alt+D`, or the **⇹** beside a character cue,
prints that speech beside the one above it, which is how two characters are
shown talking at once. The mark sits on the cue and means "alongside the
one above", so a beat's text stays one flat list of elements: a speech with
nothing to sit beside is an ordinary speech until there is. The pair is
edited side by side in two columns exactly as it is printed — two
27-character columns with 6 between them, in the 60-character body — and it
moves to the next page as one, never split under a `(MORE)`.

**Text from somewhere else.** Paste a scene from a mail, a text editor or
another program and it arrives as typed elements, not as one block to
re-type by hand: the reformat tool (`reformat.ts`) reads the shape a
screenplay has even in plain text — the capitals, the blank lines, the
parentheses — and gives back sluglines, cues, parentheticals, dialogue,
transitions and action. Hard-wrapped lines are rejoined into the paragraph
they were before someone's column width broke them, a cue whose speech was
left in the block below it is put back together, and Fountain's forcing
characters (`.slug`, `@CUE`, `>TRANSITION:`) are honoured. A paste with
nothing to read — a phrase, a single line — is left to the ordinary paste.

The same reading is available after the fact: **Reformat**, in the writing
screen's status line, re-reads the beat's plain lines and leaves every line
that was deliberately styled exactly as it is. It offers itself only when
it would change something, so a beat that is already a script leaves it
greyed out, and running it twice does nothing further. Elements keep their
identity through it, so nothing hanging off them is lost.

Every pop-up writes through the same domain mutations as everything else,
as the fields are typed; Close returns to the workspace with nothing else
changed.

The **toolbar** along the bottom of the timeline: `+ Scene` (after the
selected scene, in its lane), `+ Beat` (after the selected beat, in its
scene), `+ Lane`, `+ Act`, a zoom slider, and the inspector toggle. The
nouns follow the format: "Chapter" for a novel. A new scene or beat is
selected as it is created and its title takes focus for typing.

Everything reorders by drag and by keyboard, as today:

- Beats: within a block, and between blocks in any lane.
- Scene blocks: along the story axis, and between lanes. A block dropped on
  another lands before or after it in story order; dropped in a track's
  empty space at a position, it takes that story position in that lane.
- Lanes: by their track header.
- Keyboard: `Alt+↑/↓` moves the focused beat within its scene, a scene
  earlier/later in the story, or a lane up/down; `Alt+Shift+↑/↓` moves a
  beat to the previous/next scene, or a scene to the previous/next lane.

## 5. Timeline & Viewer

Where an editing bay shows the picture, this shows the story — and it shows
it **in time**. A page of script is a minute of screen time, which is the
rule the industry budgets and schedules by, so the axis across this screen
is a running time and the length of a scene is how long it plays. The
header carries the whole thing's **runtime** on the right, the way a viewer
shows a timecode.

Two rows stay put at the top while everything else scrolls:

- **Time.** The minute each scene starts at.
- **Scenes.** The scene as a block, its number and its title, as wide as it
  plays. Clicking one selects it; the selected scene keeps the gold
  playhead edge it has on the lanes below. A scene switched off (§4) is
  drawn dimmed.

Under them, the threads that run through the story — and only threads,
because this screen answers "who and what is where", not "what does it
say":

- A row per **character**, filled in every scene they speak in. The cast
  keeps itself: a character joins the list the first time a cue names them,
  the way a screenwriting program's character list does.
- A row per **theme**, filled in every scene it is linked to (§7.4).
  A theme leaves no trace in the text, so this is the one thread the writer
  draws by hand.
- The **links between objects** (§7.4), as curves from the scene one end
  falls in to the scene the other does. Clicking one removes it.

**Isolating a character** — the dropdown in the header — leaves their row
alone and dims every scene they are not in, which is how you see at a
glance where someone is in the script and where the gaps in their arc are.

**Zoom** sets pixels per page, the same unit the lanes below use, and it
changes the width of *every* block: the floor a short scene is given is a
fraction of a page rather than a fixed number of pixels, so an empty scene
still grows and shrinks with the zoom instead of sitting at one width.
Both this screen and the lanes have their own zoom, each remembered.

The page itself is not here — the Script (§6) is the manuscript, and the
Preview page prints it — and neither are the promises or the beats, which
belong to the lanes and the scene's own screen.

## 6. Master panel: Script

**The Script is the finished thing.** All of the manuscript, in the order it
will print (§5, §14) — every scene in story order, every beat in its scene,
every element in its beat — set as it will be delivered: the format's real
page geometry, its indents, its capitals, on paper, with the page breaks
ruled exactly where the printed pages break. This is where the work comes
together and is read; the writing itself is done in a beat's own screen
(§7). Moving a beat or a scene moves its text here, because the page is the
structure rendered, not a second copy of it.

What is *about* the story rather than in it is off by default and comes back
one **Display** toggle at a time, in a thin bar above the page:

| Toggle | Shows | Default |
| --- | --- | --- |
| **Scene headings** | The sluglines. A screenplay only — prose has none | On |
| **Scene names** / **Chapter names** | The scene's number and name, editable in place: structure, not manuscript | Off |
| **Beat names** | The beats' internal titles, which never enter the manuscript (§5.3, §19), each with its version when it has more than one | Off |
| **Acts** | An act bar where a marker starts | On |
| **Page breaks** | A rule and page number where the printed page breaks | On |

A writer reading for flow and a writer working on structure want different
amounts of scaffolding, and this is the one control that decides it. The
choice is per machine, not project data (§14).

The page opens with the title and the author, the way a script does. Putting
the cursor in a beat's text selects that beat, and selecting a beat anywhere
else scrolls the Script to it; the selected beat is marked by a gold rule in
the page's left margin, and a beat given a colour by a rule in its own. A
beat or scene switched off (§4, §7) is not on the page at all.

**The Script is written in, not only read.** Putting the cursor in a line
and typing is the same edit the beat's own screen makes, through the same
mutations, with the same two keys (§7.1), the same auto-typing, the same
emphasis and the same dual dialogue: the page is the manuscript, not a
preview of it. What the writing screen adds is a page of its own to do it
on, one beat at a time, and it does not compete with the Script for
double-click: hovering a beat offers a **✎** in the left margin that opens
that beat's screen, and the footer says plainly that you can also just type.

The Script also opens in **a window of its own** (§8), which is what makes
the second monitor worth having: the finished script on one screen, the beat
being written on the other.

### 6.1 Continuous, or pages

The first control in the Display bar is the one that decides what the page
*is*:

| Layout | What it draws |
| --- | --- |
| **Continuous** | One column, scrolled, with a numbered rule where each printed page breaks. The default. |
| **Pages** | The script as sheets of paper — 8½ by 11 — one after another, scrolled through. |

The sheets are the paginator's, not a guess at them. `pageBreaks` says which
element opens each printed page, and a beat whose elements straddle one is
drawn in two runs, on the sheet each run belongs to; the beat's keyboard, its
cue list and its element ids are unaffected, because only the *drawing* is
divided. Act bars, scene names and beat names print nothing and take no
printed lines, so each is held until the first manuscript run after it and
goes onto whichever sheet that lands on — otherwise a scene name could sit
alone at the foot of a page while its first line is over the leaf.

The page is the printed page: 8½ by 11, an inch and a half at the left where
the brads go and an inch on the other three sides, 12pt Courier on 12pt —
six lines to the inch — which is what makes fifty-five lines fill the nine
inches between the margins, and a blank line between every block, which is
what the paginator counts. The line that turns on screen is the line that
turns on paper. The sheet's height is a *minimum*: if a page's content ever
runs a line long the paper grows rather than the words being cut off.

**Page** sets the size, from *Fit width* — the default, because a page is 8½
inches and the Script's own column is not — up to 135%. The size is a
transform on the finished stack, not a multiplier on each of those lengths:
scaling the lengths would re-round the type at every step (at half size 12pt
becomes 8px, whose characters are not half as wide as 12pt's) and the page
would quietly stop being the page. Scaled this way the geometry is identical
at every size, and a sheet in a quarter-width column is laid out at 816 by
1056 and merely drawn at 359 by 465.

Pages are written in exactly as the continuous view is. It is the same
manuscript, the same mutations and the same two keys; what changes is where
the paper ends.

### 6.2 The gear: paper, ink and face

Everything about *how the page looks* is behind one gear at the left of the
bar, rather than strung across it. The bar above a page should be the page's.

- **Paper and ink.** Four papers a manuscript is actually read on — white,
  cream, cool grey, night — and, under them, a colour for each, because a
  writer who wants their own is not wrong. The ink follows the paper when a
  swatch is picked and can be set on its own after.
- **Typeface.** Courier, Courier Prime, Consolas, Georgia, Times, Palatino.
  What is *not* on offer is a size: the column stays sixty characters wide
  whatever the face, because that is what makes a page a page, and the size
  control is the page zoom of §6.1.
- **Layout**, the continuous/pages choice of §6.1.
- **What shows**: the display switches that used to be chips in the bar.

None of it is project data. A colleague opening the file should not inherit
somebody's dark mode, so it lives with the other per-machine preferences.

Large projects: the view renders every beat, and the performance test in the
domain package is the gate; when it fails, the loader lazy-reads beats, not
the view (ADR 0002).

## 7. The research window

Research is where the material is kept **before, during and after** it is
used in the script — a working inventory, not a junk drawer — so it is not
a quarter of the screen with a strip of category tabs across the top. It is
its own window over the whole of the workspace, opened from **Research**
beside the Script tab, and closed with `Escape`.

Three columns:

| Column | What it is |
| --- | --- |
| **Folders**, down the left | The side menu: the views that are not places, then the folder tree, then the two other things that are not the script |
| **Contents**, in the middle | What is in the selected folder, as cards |
| **Detail**, on the right | The selected note itself |

### The side menu

**Everything** — the views that are not places to file in, and the part a
fixed set of folders cannot do: *All research*, *Not yet used*, *Used in the
script*, *Put away*. Each carries its count.

**Folders** — a tree. A folder holds folders: Characters ▸ Mike ▸ Journey,
with notes at any level. Each shows the count of what is in it *and*
everything under it, a colour of its own, a **+** that makes a folder inside
it, and a **×** that removes it. Removing a folder never loses anything:
its notes and the folders under it move up to where it was. The six seeded
folders (Characters, Ideas, Plot Points, Locations, Props, Themes) cannot be
moved or removed, the way Causality's blue folders cannot; everything else
can go anywhere. Dragging a note onto a folder files it there, and dragging
a folder onto another files that — except into itself or its own
descendants, which would cut it out of the tree.

Selecting a folder shows what is filed in it **and everything under it**, so
selecting Mike shows his journey too. The search box narrows whatever is on
screen, across titles, notes and tags.

**Also** — the two other things that are not the script: the **plot lanes**
as records, and the **setups and payoffs** tracker (§7.3). They were tabs in
the master panel; they belong in the one window that holds everything the
script is made from.

### The detail

Title, the note itself, tags, and the folder it is filed in (a select, so a
note can be moved without dragging). Under them: **Mark used** — as *used in
the beat I am writing* when there is one, which is the §7.2 workflow — and
**Put away**, both reversible, because moving something to used has never
been a delete. Then where it was used, and the related-elements panel
(§7.4).

Research also opens in **a window of its own** (§8), which is what a second
monitor is for: the material on one screen, the script on the other.

## 8. Sections, places and windows

A workspace is not a layout the program gets to decide. Someone cutting a
sequence wants the lanes big and the script small; someone drafting wants
the opposite; someone with two monitors wants the page on one of them and
everything else on the other. So the sections move.

### The four places

The workspace has four places a section can be — the tall column down one
side, the two stacked halves of the stage beside it, and the narrow column
on the far side — and four sections to put in them: the **Script**, the
**Timeline & Viewer**, the **plot lanes** and the **inspector**. Any section
can go in any place.

Each section carries a thin strip along its top: its name, which is also the
grip you drag it by; a menu of the four places, so the arrangement can be
changed without a mouse; and the control that takes it out into a window of
its own. Dragging one section onto another **swaps the two**. There is no
notion of an empty place or of a section pushed off the edge — four
sections, four places, and every rearrangement is a permutation of them. A
remembered arrangement that is not a permutation (written by an older
version, or by hand) falls back to the default rather than losing a section.

The arrangement is a preference, per machine, not project data.

### A section in a window of its own

Any of the four, plus **research** and **any number of beats**, can be
opened as a real window and pushed onto another monitor. The window runs the
same renderer with `?pane=` naming what it holds: `script`, `viewer`,
`lanes`, `inspector`, `research`, or `beat:<id>` — beats key on their own id,
so two beats can be open side by side. Asking twice for the same section
raises the window that already exists rather than making a second one.

**The workspace closes over the place a section left.** The Script taken to
another monitor does not leave a striped rectangle where it was: the column
disappears and the Timeline & Viewer and the plot lanes take the width. The
way back is the chip in the title bar (§3), which is in the same place
whatever is out — better than a hole in the layout, which costs the room the
writer moved the section to gain.

Closing the workspace closes them: the workspace holds the document, and a
window with nothing to edit and nothing to save it is worse than no window.

### One document, several windows

The windows edit the **same project**, not copies of it. A line typed in the
beat window is in the Script a moment later; a beat dragged in the lanes
moves its text in the beat window. Exactly one window — the workspace — holds
the document and runs the autosave, which keeps a single writer to the file.

The rule between them is the ordinary one for optimistic editing:

1. A window applies its own edit **at once**, so typing never waits for a
   round trip, and proposes the result to the workspace along with the
   version it was working from.
2. The workspace accepts a proposal whose version is the one it holds, and
   publishes the result to every window.
3. A proposal written against an older version is **refused**. The window is
   handed the current document and **replays** the edits it has not had
   acknowledged on top of it, then proposes again.

So two windows writing at the same moment keep both edits: the beat window
taking a beat out of the script while the workspace renames it ends with the
beat renamed *and* out of the script, and neither window shows a document
the other has moved past. A document older than the one in hand is ignored
rather than applied — a refusal that crossed with the acceptance of the very
edit it refused must not put back what has already been superseded.

Proposals and publications are coalesced to a few a second, so a held-down
key sends the document a handful of times rather than once per character;
what is on screen in the window doing the typing is never delayed by it.

The transport is not part of the rule. In the desktop application the main
process relays between windows and never reads what it relays; in the
browser preview the windows are tabs of the same origin and talk over a
`BroadcastChannel`. Both are the same three lines.

## 9. Inspector

The properties of the current selection, as a column of collapsible
sections, top to bottom:

| Section | Fields |
| --- | --- |
| **Beat** | Title, status, summary, words and pages, characters who speak in it (derived from character cues, read-only), related elements (§7.4 — the panel that used to sit under the editor moves here) |
| **Scene** / **Chapter** | Sequence label, title, status, summary, notes, lane (a select that moves the scene without changing its story position), pages |
| **Lane** | Name, kind, colour, description |
| **Act** | The marker the selected scene starts: title and kind, or a control to start one |

Every field writes through the same domain mutations the panes use, so an
edit here shows in the Script and on the timeline at once.

## 10. Page bar

The row of pages along the bottom of the window, centred, in the display
face at 11px uppercase, the current page in gold with a gold rule above it:
Write, Preview, Editors, Read back, Captures, Recovery. It replaces the view
buttons that were in the title bar, which now holds only the project's
identity on the left and its state and actions on the right. Counts stay on
the page names (conflicts on Recovery); the research and setup counts move
to the master panel's Research tab.

## 11. Story order is global

This addendum changes one rule of §5 and §13. Until now the print order was
*lane order, then scene order within the lane*: every scene of the main plot
printed before the first scene of any subplot. A timeline cannot show that
as anything but wrong, because it is: a subplot scene belongs between two
main-plot scenes, not after all of them.

From this addendum, **scenes have one order across the whole project**.
`StructuralUnit.orderKey` is a position on the story axis, and a scene's
lane is the row it is drawn in, nothing more. Beats keep their order within
their scene; lanes keep their order as tracks. The print order, the Script,
the Preview and every export follow the global scene order.

Existing files are migrated (format version 2): scenes are re-keyed in the
order they printed before — lane by lane — so nothing changes in the
manuscript until the writer moves something. The migration takes the usual
pre-migration snapshot.

## 12. Markers: acts, chapters, and what hangs off one

Every format puts points in its story, and every format means something
different by them.

| Format | What a marker is | What hangs off it |
| --- | --- | --- |
| Screenplay, stage play | An **act** | **Notes** — a script prints no leaf between its acts |
| Novel | A **chapter** | A **chapter page**, if the writer wants one |
| Short story | A **chapter**, numbered I, II, III | The same |

They are drawn on the **Timeline & Viewer** as an editing program draws
markers: a tick at the point in the story with its label beside it, in a row
of its own above the scenes, sticky like the rest of that header. Clicking
one opens it.

### Numbering

One scheme for the whole project, because a book whose chapters are numbered
three different ways is not a book: numbers, Roman numerals upper or lower,
letters, words (*Chapter Thirty-Two*), a symbol, or nothing. A format starts
with the scheme it is written in — Roman for a screenplay's acts and a short
story's sections, plain numbers for a novel's chapters — and the writer can
change it from any marker, which says that it changes them all. What the
writer types as a marker's *title* sits beside the number, never instead of
it. Each kind counts on its own, so parts do not disturb the chapter count.

### The chapter page

The leaf a book puts between chapters: the chapter's number, its name, an
epigraph, and a device or illustration. Each of the four is a switch, so a
page showing only a device on blank paper is possible, which is a real thing
books do. It sits a third of the way down the sheet, centred or ranged left.

It is **not manuscript**. Nothing on it is text the writer is writing, so it
lives on the marker rather than among the elements, and a printing can leave
every one of them out without touching a word — the Preview and the export
carry a switch for exactly that, and switching a page off keeps its design
for the next printing that wants it.

In the paginator it is a page of its own, ahead of the chapter it opens.
That is not a compromise: a chapter starts on a fresh page in every book ever
printed, so the story is paginated in runs between the leaves and the pages
are numbered straight through.

The graphic is held in the document as a data URL and capped at 5MB. The
project is a text file that syncs; a full-bleed photograph in it would make
every save enormous, and a printer's ornament is what this is for.

### The older act-marker rules, unchanged

A marker is a label at a position in the story order: `{ id, title,
kind: 'act' | 'sequence' | 'note', unitId }`, meaning *this scene starts
this act*. It is not a container — scenes do not belong to acts — because
the master spec's hierarchy is lanes → scenes → beats (§19) and an act that
owned scenes would cut across lanes. A marker is deliberately light: rename
it, move it to another scene, remove it.

When the scene a marker starts is removed, the marker moves to the next
scene in story order, or goes with the last scene if there is none.

Markers are stored in the project file (`markers[]`) and synced like any
other structural record (`story_markers`).

## 13. The menu bar

A desktop application has menus. The workspace has grown enough controls that
hunting for them in the chrome is no longer reasonable, so there is a menu
bar across the top, and it is the same list twice: the bar drawn in the
window — which is what Windows shows and what the **browser preview** has —
and the native application menu the main process builds from that same list,
so a Mac gets its menus where a Mac keeps them and no accelerator can mean
two different things.

A menu item is **a command name and a label, nothing else**. What a command
does lives in the workspace, which is the only place that knows what is open.

| Menu | What is in it |
| --- | --- |
| **File** | New screenplay / series / novel / short story / short-form piece, **New episode**, Open, **Import a script**, Save, Save a copy, **Page setup**, Print, Export PDF, Preferences, Close project |
| **Editor** | Find, Find next, Find and replace, Reformat pasted text, and the two editors of spec §8 — Daily and Final — plus Read back |
| **Reports** | Writing log, Story statistics (§15) |
| **Window** | The episode rail; each section, ticked when it is in a window of its own and choosing it brings it back; this beat in its own window; bring everything back; focus mode; window preferences |
| **Help** | What this build does, About |

It is called **Editor**, not Edit, because the clipboard is not what it is
for. On macOS the clipboard roles are added to the native menu regardless —
an Electron application with no menu loses ⌘C, ⌘V and ⌘A entirely, because
on a Mac those live on the menu and nowhere else.

More menus go here as they are earned; the list is one array.

### Page setup

What a printing carries, in one dialog instead of scattered across the
Preview page. The Preview, the print and the PDF export read the same
answer, which is the only thing a page setup is for.

It is in two groups, and the division is the point.

**The document** — the things that are part of a manuscript:

| Switch | Default | |
| --- | --- | --- |
| Title page | on | |
| Chapter pages | on | §12, and only for a format that has them |
| Scene headings | on | Off gives a read-through with no sluglines |
| Page numbers | on | Top right, from page two |
| Scene numbers | **off** | In the margins at both edges, as a shooting script sets them. A draft is not numbered; numbering one misrepresents it |

**Notes to yourself** — a reference copy, not the delivered draft. None of it
is the writing, so none of it prints by accident:

| Switch | |
| --- | --- |
| Beat titles | Authoring metadata (§5.3, §19) |
| Each scene's summary | |
| What each scene is linked to | Setups, payoffs, research, characters |
| The day and time it was printed | |

Annotations print **under the slugline, never above it**: a note above the
heading reads as belonging to the scene before. The scene's own notes come
first, then the beat's, because the scene holds the beat.

A scene number is set in the margins rather than in the column, so it takes
no room from the sixty characters the text is set in — the paginated text is
byte-for-byte what it is without numbering.

### Nothing but the document on the page

`@page` has a **zero margin**, deliberately, and the manuscript's real
margins are the page element's own padding. The `@page` margin band is the
only place a browser can draw its own furniture — the date, the time, the
file's name, its own page numbers, the URL — so with no band there is
nothing to draw in, and what prints is the document. The date and time are
available as a switch above, off by default, drawn by us on every page
(pages get separated) rather than once at the end.

### Find and replace

It searches the manuscript, not the screen: every beat in story order,
whatever is scrolled into view. Case and whole-word are switches; a match
list shows the line each hit is on, so the writer picks the right one instead
of stepping through forty; and stepping to a match **selects its beat**, so
the Script scrolls to it and the timeline and inspector follow — which is what
makes it useful in a document that is several windows wide.

Replacing is two buttons and never one. **Replace** takes the match in hand
and leaves the rest; **Replace all** says how many it changed. A replacement
rebuilds one element's text and leaves its id, its type and everything hanging
off it alone, and a beat with no match in it is not touched at all.

## 14. What a project can be

Six formats, and two of them are new.

| Format | Written as | Divided into | Opens each division with |
| --- | --- | --- | --- |
| Screenplay | Script | Acts | A note, not a page |
| **Series or episodic** | Script | **Episodes** | A title card |
| Novel | Prose | Chapters | A chapter page |
| Stage play | Script | Acts | A note |
| Short story | Prose | Chapters, in Roman numerals | A chapter page |
| **Short form** | Script | Acts | A note |

**Series or episodic** is a screenplay divided into episodes and holding the
elements of a series together across them. An episode is a **marker** (§12),
not a new kind of container: it is the same point in the story order that a
book calls a chapter and a feature calls an act, so everything markers
already do — the track on the timeline, the numbering, the page that opens
one — works for episodes without a line of new machinery. Episodes are
numbered `1, 2, 3` by default, because nobody writes *Episode IV* on a call
sheet, and their labels shout: `EPISODE 2`, the way `ACT TWO` does.

**Short form** is for commercials, web video, and the short pieces made for
social. The framework is here — the format exists, a project can be created
in it, and it is written in script format — and the module that makes
something of it, with the timings and the shapes that kind of work needs, is
a later piece of work.

## 15. The writing log

The application knows when writing is happening, so it may as well keep the
record. A **sitting** is one stretch of work: the day it was, the hour it
started, the hour it ended, and the word count of the manuscript at each end.

The clock starts at the first keystroke into something you can type into,
and is held open by a tick a minute while the typing continues. When the
typing stops the ticks stop, and a gap of five minutes closes the sitting.
So the log measures **time spent writing**, not time spent with the
application open, which is the only figure worth having. Clicking around the
timeline for an evening is not writing and does not read as it.

Nothing about *what* was written is kept — no keystroke log, no text. The
sittings live in the project file, so the record follows the work to another
machine and into the sync, and a writer who never signs in still has their
own history.

The difference between the two counts is left to be worked out rather than
stored: the count at each end is the fact, and every reading of it is a
reading. A day spent cutting is honestly **negative**, and shows as a loss.

**Reports**, on the menu bar, opens two:

- **Writing log** — days written, time at it, words, words an hour, the
  current streak and the longest one; then a row per day, which opens to the
  sittings inside it with the hours each ran. A streak counts only while it
  is still alive: one that reaches today or yesterday. One that ended a week
  ago is history, not a streak.
- **Story statistics** — what the document says about itself: words, pages,
  scenes, beats, how many are written, markers, lanes, research not yet used,
  setups not yet paid.

Both are read-only. A report that could be edited would be a claim rather
than a record.

## 16. The cast, and the headings it is filed under

Every project keeps its people under headings. **Main characters** and
**minor characters** in every format; a series has **recurring characters**
between them, because that is the distinction a series actually makes and the
one that decides who carries over into next week.

The headings are **data, not an enum**. Rename them, reorder them, add "The
family" or "The precinct" if that is how this story thinks. A character filed
under none is not lost — they are unfiled, and shown last.

They live in Research, under **Characters**: the cast at the top of that
folder, the notes about them below it. Not a second folder also called
Characters — one folder, the people and what is written about them.

What the headings are *for* is not tidiness. **The order here is the order
names are offered while a character cue is being typed.** Main characters
first, because they are who you are usually about to type. That is why filing
someone under "Main" is a working decision rather than a label, and why
`cueSuggestions` keeps the order it is handed instead of alphabetising over
it.

Removing a heading **unfiles** the people under it. It never deletes them.
Losing a character because a heading was tidied away would be indefensible.

## 17. Episodes

A series is one project divided into episodes, and **an episode is a run of
the story order** — it starts at the scene its marker is on and runs to the
scene before the next episode's. Nothing new holds it: no episode container,
no episode field on a scene. A container would cut across the lanes, and the
hierarchy is lanes → scenes → beats (spec §19); a field on the scene would be
a second source of truth for something the story order already says.

The consequence worth having: everything that already works on a run of
scenes — the timeline, the pagination, find, the reports — works on an
episode without knowing episodes exist.

### The rail

Down the right-hand edge, and only in a series. Shut, it is a tab; open, it
is every episode in order with its number, its name, how many scenes and
words are in it, and who is in it. Choosing one goes to it. Open, the rail
takes its room from the workspace rather than covering the inspector — a list
that hides the panel beside it is not worth having.

### Starting one

From the rail's **+ New episode** or **File → New episode**. Two questions,
and the second is the one that matters:

1. What is it called. Just a name; the **number is its position**, so
   episodes cannot disagree about what they are called.
2. **What comes over.** A list of switches, not a guess — and the answer is
   remembered, because next week the answer is almost always the same.

| Carries over | What it means |
| --- | --- |
| A character heading | Everyone under it joins the new episode's cast |
| Whoever spoke last episode | The people who actually had lines, whatever heading they are under |
| The setups still unpaid | Noted on the episode, where it will be read while writing |
| Plot lanes | The series' own lanes, or a fresh one for this episode |

Everything in a project is available to every episode already — one document,
one cast, one research shelf. So carrying over is not copying; it is
**deciding what the episode starts with in hand**. The cast it settles on
lives on the episode's marker, and is what puts this episode's people at the
top of the list while a cue is being typed (§16).

**What does not come over is any of the writing.** A new episode is a clear
slate: its own scene, one empty beat, and nothing in it. That is the point of
a new episode.

## 18. Importing somebody else's script

Two readers, one builder. **File → Import a script** takes a Final Draft
document or a PDF, and the point is not to hold the pages — it is to arrive
with the thing **already broken up**: a scene per slugline, a beat to write
in, the cast filed under its headings, and every location on the research
shelf. A script that imports as one long block of text has not been
imported, it has been pasted.

### Final Draft

An `.fdx` is XML and it *says* what every line is, so nothing is guessed.
Scene headings, action, cues, parentheticals, dialogue, transitions and
shots come across as themselves; Final Draft's own styling comes across as
the marks the editor uses (§7.2); a dual pair keeps its pairing, with the
mark on the second speech, because here the mark means "beside the one
above". A paragraph type with no equivalent is named in the warnings and
brought in as action — never dropped in silence.

The parser is written rather than pulled in. `DOMParser` is a browser global
the main process does not have, an XML library is a dependency in the path
of opening a file, and FDX is a small, regular document.

### PDF

A PDF does not say what a line is. It says **where the line sits** — and in
a screenplay that is very nearly the same thing, because the format *is* the
indentation: a cue is 3.7in from the left edge, a speech 2.5in, a
parenthetical 3in, action and sluglines at the margin.

So the reader works from the left edge, and it **measures rather than
assumes**: the margin is taken to be the commonest left edge in the
document, since action and sluglines are the bulk of any screenplay, and
every other indent is read relative to it. A script typed at 1.2in reads
exactly as one typed at 1.5in.

Three things it does besides classify:

- **Rejoins wrapped lines.** A speech that arrived as four lines is one
  speech. Two lines join when they are the same kind, at the same indent,
  and follow one another down the page.
- **Drops the furniture.** Page numbers, `(MORE)`, `(CONTINUED)` — printed,
  but nobody wrote them.
- **Takes the title page off the front.** It is page one, a handful of
  centred lines with no slugline among them. Left in, every one of those
  lines lands in the cue band, and the title and the author would come in as
  characters who speak once. The title and by-line are read from it instead.

Where the geometry is ambiguous the words are asked as a second opinion, and
anything decided that way is **marked**, counted, and reported — so the
writer is told what to check rather than finding it mid-draft.

### What is made

| Read | Becomes |
| --- | --- |
| Each slugline | A scene, titled with the slugline, with one beat holding the text |
| Each character cue | A character, filed by how much they speak, bound to their speeches so read-back can voice them |
| Each slugline's place | A note under Research → Locations, with how many scenes and whether it is interior or exterior |
| The title page | The project's title and author |

Who is a main character is decided by **speeches**, because that is the only
evidence a script offers: at least a dozen, or two-fifths of what the
busiest part speaks. It is a proposal, and refiling anyone is one click
(§16).

Before anything is made, the dialog **shows what was found** — scenes,
cast with their speech counts, locations, and every warning. An importer
that goes straight to a finished project asks the writer to audit a hundred
pages to find out whether it worked.

The imported project arrives **unsaved**: it is a document that has just
turned up, and where it lives is the writer's to say.

## 19. Drafting a beat, and writing in one

### A draft is the scene written again

Starting a new draft **clears the page**. The draft in hand is kept whole
under its own name, and the beat is a blank sheet — because that is what
drafting a beat is for. A pass that edits what is already there is a
revision, and `Start from a copy` is the tick that does it; the default is
the blank page, because a draft you can only edit is not a second attempt at
the scene, it is the same one with the corners knocked off.

Any draft can be made the working one again at any time. The one being left
is kept in its place, so switching back and forth loses nothing either way.

### Two drafts side by side

**Compare** opens the beat screen wider and sets a second page beside the
first: the draft being written on the left, one to read on the right, chosen
from a list of the rest. The page size comes down so both fit, and can be
put back.

The right-hand page is **read-only**, deliberately. Two live editors of the
same scene is a way to lose an afternoon's work, and what the second column
is for is judging one against the other, not editing both.

### No box around the writing

There is no rectangle around the line being typed. A box that follows the
cursor down the page is the thing you end up looking at instead of the
sentence. The caret says where you are; a hairline under the line being
written says which line that is; nothing else moves.

### The two keys

A scene always starts on **action**. From there:

| On | Tab | Return |
| --- | --- | --- |
| Action | → a character cue | a new action line |
| A cue, beside a name | **which voice is this?** — the extensions | → dialogue |
| A cue, having been asked | → a parenthetical | → dialogue |
| Dialogue | → a parenthetical | a new action line |
| A parenthetical | → dialogue | → dialogue |

Typing into a cue offers the cast as you go, this episode's people first and
main characters before minor ones (§16, §17).

Tab beside a name is the one that is new: rather than moving on, it asks
**which voice this is**, and offers the extensions the industry recognises —
each with its full term and what it means, because `(P.A.)` on a menu tells
nobody anything. Choosing one puts it on the cue and swaps whatever was
there; choosing "no extension" takes it off. Only the Tab *after* that walks
on to the parenthetical, so the question is asked once and never gets in the
way.

| | | |
| --- | --- | --- |
| **The standard three** | `(V.O.)` `(O.S.)` `(O.C.)` `(CONT'D)` | Voiceover, off-screen, off-camera, continued |
| **Through a device** | `(FILTERED)` `(P.A.)` `(TAPE)` | A radio, a loudspeaker, a recording |
| **Where they are** | `(O.F.)` `(INTO PHONE)` `(LOUDSPEAKER)` | Off-frame, into the receiver, over the tannoy |
| **Language** | `(SUBTITLED)` | Text must be laid over the picture |

Shift+Tab still walks back the way it came.

### The plot pop-up lists its scenes

The same rail the episodes have (§17), listing **scenes** instead: every
scene on this plot in story order, with how many beats and words are in it.
Choosing one puts what is in that scene in a box **under the arc** — who
speaks in it, what it sets up or pays off, what it is linked to — because
the arc is what the scene is being read against, and the two belong on the
same screen.

## 20. Editing mode

Spec §8.1 asks for grammar, spelling, punctuation and mechanics, with
actionable suggestions that preserve the writer's control and voice. What
was there was a list you scrolled. **Editing mode** is a screen you work in.

### The rules, one at a time

The rules are down the left with what each one found, errors before opinions
and the commonest first. Choosing one shows only its findings — because
working through a manuscript one rule at a time is how it is actually done:
the eye stays on one kind of mistake instead of switching between eleven of
them line by line.

Each finding shows **the line it is in with the fault marked in place** —
one you cannot see in context is one you cannot judge — and says where in
the script it is; clicking that goes there.

Three answers to each: **Fix** (only where the fix is unambiguous), **Fix
all N** for every one of that rule at once, and **Leave it**. Fixing a whole
rule applies back-to-front within each element so the earlier offsets are
still true when their turn comes.

### Saying "that is not a mistake"

Two things persist in the project, because an editor with no way to say that
is one a writer switches off entirely after the second false alarm:

- **A rule switched off** — the `×` beside it. What is off is listed, and
  goes back on from the same place.
- **A word allowed** — "It's a word", on a suspected typo. Said once, never
  asked again. The cast are never asked about at all.

### What it now checks

Beyond the mechanics and style it already had:

| | |
| --- | --- |
| **Punctuation** | A space before punctuation · doubled punctuation (an ellipsis is three dots and is not a mistake) · a straight quote where the manuscript is otherwise curly · a hyphen doing an em dash's job, outside sluglines |
| **Spelling** | The misspellings a keyboard actually makes · `could of` for `could have` · **a word used once that is one keystroke from one used often** |
| **Shape** | A speech with no cue above it · a cue with nothing under it · a slugline that does not say when · a parenthetical doing action's work · a wall of action |

The typo check is the closest thing to a spell-check that can be honest
without shipping a dictionary: it knows nothing about English, only about
what this writer actually writes. A word appearing once, four letters or
more, one edit from a word this manuscript uses three times or more, is
almost always a slip. **One edit includes a transposition** — `lantren` for
`lantern` is two substitutions by the textbook measure and one slip in life.
Inflections are not typos, and neither are the cast's names.

Everything deterministic still runs locally: it costs nothing, works on a
plane, and gives the same answer twice.

## 21. Keyboard

In addition to §5's reordering keys and §6's writing keys:

| Key | Action |
| --- | --- |
| `Ctrl/Cmd+Shift+F` | Focus mode |
| `Ctrl/Cmd+Shift+P` | Show/hide the inspector (P for properties; `Shift+I` is Chromium's developer tools on Windows and Linux) |
| `Ctrl/Cmd+Shift+L` | Show/hide the master timeline |
| `Alt+PageUp` / `Alt+PageDown` | Select the previous/next beat in story order |

Every control on the timeline is a focusable element with an accessible
name; the reorder keys work from the same elements that drag (§16).

## 22. Preferences

A gear on the title bar opens Preferences. These are kept on the machine,
not in the project file — a collaborator opening the file must not inherit
anyone's colours — alongside the layout preferences of §3.

- **Colour scheme.** Four: *Gold*, the brand as `docs/brand.md` defines it
  and the default; *Graphite*, editing-room greys with a warm accent;
  *Slate*, cool blue-grey with a sky accent; *Parchment*, a light interface.
  A scheme is a set of values for the stylesheet's tokens and nothing more:
  geometry, type and behaviour do not change between them.
- **Script on paper.** On by default: the Script is drawn as a white sheet
  with black text under any scheme, because a page is what writers look at
  and a dark page is a strain over a long day. Off, the Script follows the
  scheme.

## 23. Later

Named so that nobody mistakes their absence for an oversight:

- Causal links between beats ("must be caused", "create cause"). The
  Threads view draws and edits §7.4 links between beats; a link that
  *means* "this must happen before that", with rules the timeline enforces,
  is a later addendum.
- Character lanes on the timeline itself. The Threads view has a row per
  character; a lane per character among the plot lanes is a later addendum.
- Timing in minutes. Pages are the industry's unit and the ruler uses them.

## 24. Acceptance

- The Script shows every beat of the fixture project in print order, and
  typing in the third beat changes the third beat and nothing else.
- Selecting a beat on the timeline scrolls the Script to it and moves the
  playhead; putting the cursor in a beat in the Script highlights it on the
  timeline and fills the inspector.
- A setup in scene 1 paid off in scene 4 draws a curve from block 1 to
  block 4 on the links track; an unpaid setup draws a dashed one.
- A scene moved from the main plot to a subplot keeps its story position and
  its beats; the Preview page prints in the same order as the Script.
- A format-1 project opens with its scenes in the order it printed before.
- The `+ Scene` and `+ Beat` controls add after the selection, and the new
  item is selected and its title focused for typing.
- Every reorder is possible with the keyboard alone.
- Dragging the Script's strip onto the plot lanes puts each in the other's
  place, and the same move is available from the strip's menu without a
  mouse. A remembered arrangement that is not a permutation of the four
  sections falls back to the default rather than losing one.
- Taking the Script out of the workspace closes its column: the stage grows
  from 1193 to the full 1600 of a 1600-wide window, and Research is still in
  the title bar. The chip there puts the Script back where it was.
- A beat opened in a window of its own shows the workspace's beat; typing in
  it changes the workspace's project, and renaming the beat in the workspace
  changes what the window shows. Neither window holds a copy.
- A window and the workspace editing the same beat at the same moment keep
  both edits.
- The writing screen's page measures 8½ by 11 inches at 100%, with an inch
  and a half at the left, and its column wraps where the paginator wraps.
- A marker is drawn on the Timeline & Viewer at the point it marks, in a row
  of its own, and clicking it opens what hangs off it: a chapter page to
  design in a book, notes in a script.
- Changing the numbering from one marker changes them all, and a short story
  starts in Roman numerals without being asked.
- Switching a chapter page on adds one printed page and leaves every line of
  the manuscript on the page it was on; switching it off again keeps what was
  designed on it.
- The Script's gear carries the paper, the ink, the typeface and the display
  switches, and the page takes the writer's colours without the paper
  preference overriding them.
- The menu bar names File, Editor, Reports and Window; choosing an item runs it, a
  ticked Window item is a section that is out, and an accelerator works with
  the cursor anywhere — except where a native menu owns it, where the bar
  stands down rather than handling the keystroke twice.
- A search for a word that appears in two beats finds both, in reading order;
  stepping to the second selects its beat; Replace changes the one in hand
  and Replace all says how many it changed.
- The Script in **Pages** draws one sheet per printed page, each laid out at
  8½ by 11 whatever size it is shown at, and a beat that runs over the leaf
  appears on both sheets with every one of its elements on the page exactly
  once — and still typed into.
- The opening screen offers a series and a short-form piece beside the other
  four, and a series project's markers are episodes numbered `1, 2, 3`.
- The first keystroke into the manuscript opens a sitting; a keystroke that
  lands on the page rather than in a field does not. A minute of continued
  typing moves that sitting forward rather than starting a second one.
- The writing log shows a row for each day worked, opening to the sittings
  inside it with the hours each ran, and a day that lost words shows the
  loss.
- A series' Research → Characters shows main, recurring and minor headings;
  a screenplay's shows main and minor. Removing a heading leaves the people
  under it in the project, unfiled.
- Starting an episode adds one scene with one empty beat at the end of the
  story, numbers itself by its position, carries the cast that was ticked and
  none of the previous episode's text, and the workspace goes to it.
- The rail lists every episode with its number, name, size and cast, marks
  the one being written in, and gives up its room to the inspector when shut.
- The names offered while a character cue is typed lead with this episode's
  cast, in heading order.
- A Final Draft document imports with every line the type Final Draft gave
  it, its italics intact, and its dual pairs still paired.
- A screenplay printed to PDF by VC Writer and imported back comes in with
  the same scenes in the same order, the same cast with the same speech
  counts, and no warnings — the title page read as a title page, not as
  three characters who speak once.
- The import dialog shows the scenes, the cast, the locations and every
  warning before it makes anything, and the project it makes arrives
  unsaved.
- A printed page carries the manuscript and nothing else: no date, no time,
  no file name, no browser page numbers in any corner.
- Scene numbers appear in both margins and change not one character of the
  paginated text; the summary and the beat label print under the slugline,
  in that order, and only when asked for.
- A new draft clears the beat and keeps the last one whole under its name;
  switching back and forth loses neither. `Start from a copy` keeps the text.
- Compare sets two drafts side by side, the screen widens to hold them, and
  the one being read cannot be typed in.
- Nothing draws a box around the line being written.
- Tab beside a character's name offers the extensions with their full terms;
  choosing one marks the cue and swaps any mark already there; the Tab after
  that goes to a parenthetical, and Tab in dialogue goes to one too.
- The plot pop-up lists its scenes and opens one to its cast, its promises
  and its links, under the arc.
- Editing mode lists the rules with what each found; choosing one shows only
  its findings, each with its line and the fault marked in it, and Fix all
  fixes every one of that rule without disturbing another's.
- A rule switched off stays off for the project and can be put back; a word
  allowed is never raised again.
- `lantren` beside three `lantern`s is caught; `stairs` beside three
  `stair`s is not, and neither is a character's name.
- Renderer and domain tests cover the above; a screenshot of the fixture at
  1440×900 and at 1100×700 is reviewed before the change ships.
