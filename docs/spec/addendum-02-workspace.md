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

Below the bar is the page, and nothing else: the beat's manuscript at the
format's real geometry, with the writing rules of §7.1. The status line
under it names the scene and lane the beat is in, its word count, and the
two keys.

Colour, status, summary, links and what the beat sets up or pays off are
the **inspector's** business (§8) rather than the page's, so that the
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
will print (§5, §13) — every scene in story order, every beat in its scene,
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
choice is per machine, not project data (§13).

The page opens with the title and the author, the way a script does. Putting
the cursor in a beat's text selects that beat, and selecting a beat anywhere
else scrolls the Script to it; the selected beat is marked by a gold rule in
the page's left margin, and a beat given a colour by a rule in its own. A
beat or scene switched off (§4, §7) is not on the page at all.

The Script stays editable — the same mutations the writing screen makes —
but it does not compete with it: hovering a beat offers a **✎** in the left
margin that opens that beat's screen, which is the way in that does not take
double-click away from selecting a word.

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

Not yet: **popping the window out** onto a second monitor. It needs the
project state to be shared between two windows rather than owned by one, so
it is its own piece of work rather than a flag on this one.

## 8. Inspector

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

## 9. Page bar

The row of pages along the bottom of the window, centred, in the display
face at 11px uppercase, the current page in gold with a gold rule above it:
Write, Preview, Editors, Read back, Captures, Recovery. It replaces the view
buttons that were in the title bar, which now holds only the project's
identity on the left and its state and actions on the right. Counts stay on
the page names (conflicts on Recovery); the research and setup counts move
to the master panel's Research tab.

## 10. Story order is global

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

## 11. Act markers

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

## 12. Keyboard

In addition to §5's reordering keys and §6's writing keys:

| Key | Action |
| --- | --- |
| `Ctrl/Cmd+Shift+F` | Focus mode |
| `Ctrl/Cmd+Shift+P` | Show/hide the inspector (P for properties; `Shift+I` is Chromium's developer tools on Windows and Linux) |
| `Ctrl/Cmd+Shift+L` | Show/hide the master timeline |
| `Alt+PageUp` / `Alt+PageDown` | Select the previous/next beat in story order |

Every control on the timeline is a focusable element with an accessible
name; the reorder keys work from the same elements that drag (§15).

## 13. Preferences

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

## 14. Later

Named so that nobody mistakes their absence for an oversight:

- **Pop-out windows.** Any editor window — the Script, a Research tab, the
  inspector — opened in its own operating-system window for a second
  monitor. Electron supports it; it is a later addendum because it needs a
  second render root sharing one document, which is a change to the
  project state plumbing, not to the panes.
- Causal links between beats ("must be caused", "create cause"). The
  Threads view draws and edits §7.4 links between beats; a link that
  *means* "this must happen before that", with rules the timeline enforces,
  is a later addendum.
- Character lanes on the timeline itself. The Threads view has a row per
  character; a lane per character among the plot lanes is a later addendum.
- Timing in minutes. Pages are the industry's unit and the ruler uses them.

## 15. Acceptance

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
- Renderer and domain tests cover the above; a screenshot of the fixture at
  1440×900 and at 1100×700 is reviewed before the change ships.
