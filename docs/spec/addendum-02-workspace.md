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
| **Viewport** | Above the timeline, where the viewer would be: the **Page** view and the **Threads** view |
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

The horizontal axis is **story order measured in pages**: each scene block
is as wide as the pages it takes, with a floor so an empty scene is still a
block you can read and drop on. A long scene is a wide block, and a glance
at a lane says where the story's weight is. That is §5.1's "lane dimensions
adapt to contained material" made literal.

Tracks, top to bottom, each with a header on the left the way an editor
names its tracks:

1. **Pages.** The ruler: the page each scene starts on, at the block's left
   edge. A zoom slider on the toolbar sets pixels per page; ruler and
   blocks share the scale.
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
stacked in order.
Clicking a beat row selects it; clicking the header selects the scene's
first beat. Blocks collapse to a header. The **playhead** is a gold rule
through every track at the left edge of the selected beat's scene, the way
an editor's playhead marks the frame; it moves when the selection does.

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

## 5. Viewport

Where an editor shows the picture, this shows the story. A header names
the selected scene in the centre and counts pages at the right the way a
viewer shows a clip name and a timecode; a transport row underneath steps
to the first, previous, next and last beat in story order. Two views, as
tabs at the left of the header:

**Page.** The selected scene as it prints: the same paginated pages the
Preview page and the PDF produce, white on black. Selecting a beat anywhere
turns the viewport to its scene.

**Threads.** The whole story as a connected diagram: one column per scene
in story order, and across the columns the threads that run through them.

- *Scenes*: each scene as a node coloured by its lane, with a line per lane
  joining that lane's scenes, so a subplot reads as its own thread weaving
  through the main plot.
- *Promises*: every setup drawn as a curve to the scene where it pays off,
  an unpaid one as a dashed curve into the air, and every scene-level story
  link as a thin curve — the links track of the timeline, in the same
  colours, at a size that can be read.
- *Characters*: a row per character, coloured, with a dot in each scene the
  character speaks in and a line joining them. A character "speaks in" a
  beat when a character cue names them, so the row is derived from the
  script and never falls out of date with it.
- *Beats*: each scene's beats as chips, each carrying a dot per character in
  it in that character's colour, and the links the writer has drawn between
  beats as dashed curves.

Dragging from one beat chip to another draws a link between them (a §7.4
`relates_to` link); clicking a link removes it. Each thread is a layer with
a toggle, so the diagram can be reduced to the one question being asked:
where does this character go quiet, which promise is still open, where do
the two plots touch.

Character colours are assigned in order of first line and used everywhere a
cast is drawn: the chips here, the dots on the timeline's beat rows. They
are chosen to read on the dark and the light schemes and to stay apart from
the lane palette; a character is not a lane.

## 6. Master panel: Script

The manuscript, all of it, in the order it will print (§5, §13): every scene
in story order, every beat in its scene, every element in its beat. It reads
like the script because it is the script.

Structure is shown as bars in the flow of text, not as a separate list:

- An **act bar** where an act marker starts.
- A **scene bar** at the start of each scene: the lane's colour as a 3px
  left edge, the sequence label and title (both editable in place), the
  lane's name, the page it starts on, and a collapse control. Collapsed,
  the scene shows only its bar and a count of beats.
- A **beat bar** at the start of each beat: lighter than the scene bar, the
  beat's internal title editable in place, its status, and a collapse
  control. The title is the writer's reference and never enters the
  manuscript (§5.3, §19); it is visibly a bar, not a line of script.
- The **manuscript** of the beat under its bar, at the format's real page
  geometry as before: element type in the gutter, Return for the
  conventional next element, Tab to retype, the character list for cues.

Putting the cursor in a beat's text, or clicking its bar, selects that beat.
Selecting a beat anywhere else scrolls the Script to it. The selected beat
carries a gold rule down its left edge so the eye can find it when the
selection was made on the timeline.

Large projects: a collapsed beat renders only its bar. Beyond that the view
renders every beat, and the performance test in the domain package is the
gate; when it fails, the loader lazy-reads beats, not the view (ADR 0002).

## 7. Master panel: Research

The second tab of the master panel, with its own row of tabs beneath it, one
per kind of material:

| Tab | What it is |
| --- | --- |
| **Characters**, **Ideas**, **Plot Points**, **Locations**, **Props**, **Themes**, and any category the writer adds | The research categories of §7.1, one per tab, each with its Unused / Used / All filter and its detail column. Archived categories are not shown as tabs |
| **Plots** | The plot lanes as a list: name, kind, colour, description. The same records the timeline draws, edited here as text |
| **Setups & payoffs** | The §7.3 tracker, unchanged |

The Research and Setups & payoffs pages leave the page bar; this is where
they live now. Because the selected beat is shared, "mark used in the
current beat" and "link to the current beat" act on the beat selected in
the Script or on the timeline, which is the workflow §7.2 describes: read
the material, write the scene, mark it used.

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
