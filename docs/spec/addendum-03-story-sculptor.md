# Addendum 03 — Story Sculptor

Status: approved for build, September 2026. Stage 1 of §13.6 is built.
Extends §5 (story structure) and §19 (the hierarchy) of the master
specification, and adds an area alongside the workspace of addendum 02.

Story Sculptor is a **node-based vertical story-development module**: the
place a story is shaped before it is assembled. It is part of the standard
program and does not depend on Writers Room.

This addendum is the development spec as written, reconciled against what VC
Writer already has. §§1–12 are the module. §13 is the reconciliation: what
already exists and is reused, what is genuinely new, and how the four open
decisions were settled.

## 1. Objective

A flat outline asks a writer to know the shape of the story before they have
found it. Story Sculptor replaces it with **sculpting**: establish the
largest forms first, hang them on a framework, then progressively add
scenes, beats, character movement, plot movement, and fine detail.

The module must stay fluid enough for discovery. A writer who has only *it
begins here and ends there* must be able to start, and must never be made to
fill in a three-act template to proceed.

## 2. The canvas

A vertical workspace that scrolls downward through story time.

- Every project begins with a **Beginning** node and an **End** node, and
  nothing between them.
- Structural nodes are inserted between them in any model the writer likes:
  three act, five act, the sequence method, television acts, a structure of
  their own, or no named paradigm at all.
- **Chronology runs down; detail runs across.** Adding detail moves right,
  not down.
- A parent region grows vertically to hold its children. Nothing overlaps.
- Nodes are draggable, reorderable, collapsible, linkable and editable.

## 3. The columns

Detail increases left to right. Each column is a level of the story, not a
thread of it — this is **not** the plot lane of addendum 02 §2, and is
deliberately named apart from it (§13.2).

| Column | What it holds | Nodes | Behaviour |
| --- | --- | --- | --- |
| **1 · Structure** | The largest forms, and the framework | Beginning, the Act I turn, the midpoint, the climax, the ending, milestones of the writer's own | A region stretches vertically to contain everything under it |
| **2 · Scenes** | The concrete dramatic scenes that serve a structural region | Scene cards: title, synopsis, POV, location, status | A scene sits beside the region it serves and connects to it |
| **3 · Beats** | The dramatic actions inside a scene | Beat nodes | A scene grows vertically as beats are added, reordered or removed |
| **Further columns** | Optional finer detail, or a dimension of the writer's own | Moments, dialogue goals, reveals, setups and payoffs, node types of their own | Configurable; the parent/child relations hold |

## 4. Layout, and what it must never do

- **No node ever overlaps another.** This is the rule the whole layout serves.
- Adding scenes between two structural points enlarges the region between them.
- Adding beats to a scene enlarges the scene and pushes what follows down.
- Collapsing a parent compresses its descendants and keeps their order and
  relationships intact.
- Connectors reroute cleanly as nodes move and regions resize.
- Zoom reaches macro structure, scene planning and beat detail.

## 5. Node types

| Node | What it is |
| --- | --- |
| **Structure point** | A milestone or a boundary |
| **Story region** | An act, sequence, movement, episode section, chapter range, or a container of the writer's own |
| **Scene** | The parent of one or more beats |
| **Beat** | The smallest standard unit, and the same beat the writing workflow already uses |
| **Character arc point** | A character's state, decision, reversal, growth or regression, or completion |
| **Plot arc point** | A development in the main plot or a subplot |
| **Setup / payoff point** | Links straight into the existing Setups & Payoffs tracker |
| **Research node** | Links to a character, location, object, idea, image or other research |
| **Custom node** | A label and type of the writer's own |

## 6. Character arcs

**An arc must not become a second outline competing with the story.** It is
a linked layer shown alongside the structural spine, and its points are
anchored to structure points, scenes or beats — never a copy of them.

- Each arc has a defined starting state, and optionally a target end state.
- An arc point can carry belief, want, need, relationship, emotional state,
  moral position, knowledge, power, or a dimension of the writer's own.
- The arc line connects its points down the story.
- A point attaches to the scene or beat where the change is **dramatised**,
  so a writer can see where it actually happens on the page.
- Filters show one character, several, or all.
- A long stretch with no meaningful movement for a major character may be
  flagged — as a warning, never as a rule.

## 7. Plot and subplot arcs

- The main plot and each subplot is a selectable arc path running vertically.
- Each has a beginning state or question, development points, reversals and
  complications, a climax or resolution, and optionally an ending left
  unresolved on purpose.
- Points link to structure points, scenes or beats.
- One scene may advance several plot and character arcs; the scene card shows
  which.
- Filtering isolates an arc without losing the master story order.
- Completeness indicators show unresolved or abandoned threads **without
  forcing a formula**.

## 8. How the pieces relate

- Structure organises scenes; scenes contain beats.
- **Arcs cross-reference story units; they do not own them.** One scene or
  beat serves several arcs.
- Moving a scene carries its beats and updates the arc connection points.
- Moving a beat between scenes changes its parent and keeps its research,
  authorship, setups, payoffs and arc metadata.
- Deleting offers archive and unlink before it offers permanent deletion.
- Every relation is by stable object id, so the Sculptor and the assembled
  story order never disagree.

## 9. Into the assembled story

The Sculptor is the **shaping** environment; the master timeline and its plot
lanes (addendum 02 §§8–9) are the **assembly** environment — what the spec
calls the Sequencer (§13.1).

- A structure region, scene or beat can be dragged from the Sculptor into it.
- Dragging a scene takes its beats with it.
- Dragging a beat places it in an existing scene, or makes a destination for
  it where that is allowed.
- **A linked reference is preferred to a copy**, so edits stay in step,
  unless the writer explicitly asks to duplicate.
- Reordering in the assembly may sync back, or be staged for confirmation.
- An indicator says whether an item is Sculptor-only, linked, or already in
  the written script.

## 10. The detail panel

Clicking a node opens its detail without losing the vertical map.

| Node | What the panel holds |
| --- | --- |
| **Structure** | Title, purpose, story question, notes, status |
| **Scene** | Internal title, synopsis, objective, conflict, turn, POV, location, characters, linked arcs, setups and payoffs |
| **Beat** | Internal title, text or summary, linked elements, status, and a way straight into the existing Beat Editor |
| **Arc** | Before state, the change, after state, its cause, the scene or beat it is dramatised in, notes |

Every node type takes tags, search, notes and an optional colour or category.

## 11. Views

| View | What it shows |
| --- | --- |
| **Macro** | Structure, and the major arc paths |
| **Scene** | Structure and scenes, with arc indicators |
| **Beat** | Everything, scenes expanded to their beats |
| **Arc focus** | One character or plot arc lit, the rest dimmed |
| **Unresolved** | Unused research, incomplete setups and payoffs, orphaned scenes and beats, unresolved arcs |

With a mini-map for long work, and search and jump-to across node title,
scene, character, arc, setup, payoff and research item.

## 12. What it must do, and how well

**Integration.** It uses the existing scene → beat hierarchy; it links to
Characters, Locations, Ideas, Objects, Arcs, Setups & Payoffs and the
used/unused research system; a beat opened here launches the same writing
experience as everywhere else; changes reach the Script, the manuscript view
and the assembly through the shared project model. Screenplay, novel, short
story, episodic television and short-form video all have one.

**Writers Room.** Where a project is collaborative, nodes keep contributor
origin; writer colours and initials can show on scenes and beats; a
showrunner can compare alternate structural proposals without overwriting
the master; curated material can be staged here before being committed.

**Performance.** Smooth scrolling and dragging at hundreds or thousands of
nodes, virtualising off-screen nodes where necessary without the connectors
losing accuracy. Autosave, and undo/redo across moves, creation, deletion
and relinking. Keyboard shortcuts for adding structure points, scenes and
beats. Multi-select. Text labels and non-colour indicators for type and
status. Zoom, scroll position, open panels, collapsed regions and filters
all remembered.

### Acceptance

- A writer can start with only Beginning and End, then progressively insert
  structure, scenes and beats.
- Adding a child expands the right parent and never causes an overlap.
- Scenes stay tied to their region, and beats to their scene, through moves.
- Arc points link to the same scene or beat without duplicating story content.
- A scene or beat can be dragged into the assembly keeping its identity and
  metadata.
- The writer can collapse from beat detail back to a readable macro shape.
- Custom structures work, and no three-act template is ever required.

## 13. Reconciliation with what is built

The module above is written as though from nothing. It is not: most of what
it links to already exists, and the value of building it well is in reusing
that rather than growing a second copy of the story beside the first.

### 13.1 One story, two views

**The Sculptor is a second view of the same objects, not a second store.**
§8's "stable object ids" and §9's "prefer linked references to duplicate
content" both say so, and it is the only version that can work: a scene
shaped here and written in the Script must be one scene, or the two drift
apart within a week.

Concretely, the existing model carries most of it already:

| The spec's object | What it already is |
| --- | --- |
| **Scene** | `StructuralUnit` — kind `scene`, `chapter` or `section`, with a global `orderKey` and an `inScript` switch |
| **Beat** | `Beat` — belongs to a unit, holds the manuscript, carries status, colour, revisions and links |
| **Structure point** | `StoryMarker` — kind `act`, `episode`, `sequence`, `chapter`, `part` or `note`, at a position in the story order |
| **Setup / payoff point** | `SetupPayoff`, with its setup and payoff points and its open/established/resolved/abandoned status |
| **Research node** | A research item, and the used/unused system already behind the research window |
| **The Sequencer** | The master timeline and its plot lanes (addendum 02 §§8–9). There is no screen called the Sequencer; **this is it**, seen the other way round |

So the Sculptor's Beginning and End nodes, its regions, its arcs and its
layout state are the new data. Its scenes and beats are the ones already
there.

### 13.2 "Lane" already means something else

Addendum 02 §2 fixes **plot lane** as a track of the master timeline — a
story thread, one row per subplot. The new spec's Lane 1 / Lane 2 / Lane 3
are levels of detail, which is a different idea wearing the same word.

They must be named apart or every conversation about either will need a
disambiguating clause. This addendum calls them **columns** (§3) and keeps
*lane* for the plot thread. The interface should do the same.

### 13.3 A region is a span, not a container

§3 wants a story region that *contains* its scenes. The master spec §19 is
explicit that the hierarchy is lanes → scenes → beats and that a marker is
**not** a container — a container that owned scenes would cut across the
plot lanes, which is the reason the rule exists.

There is already a proven answer to exactly this, and it should be used
again: **an episode is a run of the story order anchored by a marker**
(addendum 02 §17), computed rather than stored. A story region is the same
thing — the span from its structure point to the next one at its level.

That keeps one source of truth, makes "moving a scene changes which region
it is in" free rather than a synchronisation problem, and means a region
cannot disagree with the story order because it *is* the story order.

Vertical extent — "a region stretches to contain all subordinate material" —
is then a layout result, not a stored fact, which is also what §4 describes.

### 13.4 Authored arcs are new, and are not the existing threads

There are already two things called arcs, and neither is what §§6–7 asks for:

- `threadLayout` derives **character and theme threads** from the manuscript
  — who actually speaks, what is actually linked. It is a report on what is
  written.
- `timelineArcs` draws the **setup-and-payoff curves** across the links
  track.

§§6–7 want something different: an **authored** arc, with a starting state,
points carrying before/change/after, and an intended end. That is a
statement of intent, not a reading of the text, and the useful thing about
having both is precisely that they can be compared — where a writer says the
arc turns, against where the manuscript shows it turning.

So `Arc`, `ArcPoint` and `ArcLink` are new entities. The existing threads
stay as they are, and neither replaces the other.

### 13.5 The four decisions, settled

1. **Where the Sculptor lives.** **Its own area over the whole workspace**,
   opened from **Sculptor** in the title bar beside Research and closed with
   `Escape` — the shape addendum 02 §7 already gives the research window.
   Not a page on the page bar and not a pane in the arrangement: it is where
   the story is thought about, and it wants the room.
2. **"Sequencer" as a name.** Keep **master timeline**. Renaming a built
   screen churns the code and two addenda for no gain in what a writer can
   do; the spec's Sequencer is read as referring to it.
3. **Sculptor-only material.** Reuse the existing `inScript` switch, which
   already means *this scene is in the structure and out of the manuscript*.
   No parallel flag.
4. **Writers Room (§12).** Deferred with it. The contributor metadata and
   alternate proposals are built when Writers Room is; §12 already says the
   Sculptor does not depend on it.

### 13.6 Build order

The spec's own order (§16 of the source document), which reads correctly
against the reconciliation above:

1. The vertical canvas: Beginning and End, custom structure points,
   scrolling, zoom, drag and reorder.
2. Structure regions, with automatic vertical expansion.
3. The scene column, and its linkage to the regions.
4. The beat column, with automatic scene expansion.
5. The detail panel, and the existing Beat Editor opening from it.
6. Linked transfer into the assembled story.
7. Character and plot arc paths, anchored to scenes and beats.
8. Setups, payoffs and research links.
9. Macro / Scene / Beat / Arc-focus views, search, filters, mini-map.
10. Writers Room attribution and alternate proposals.

Stages 1–4 are the module standing on its own. Stage 5 is where it joins the
rest of the program, and is the first point at which it earns its keep.

### 13.7 Stage 1, as built

The canvas, from **Sculptor** in the title bar. Down it: **Beginning**, the
regions, **End**.

- **Beginning and End are drawn, not stored.** A story has both whatever is
  in it, and a writer who could delete the Beginning would be left with a
  story that starts nowhere.
- **A region is as tall as the manuscript under it.** Nothing here is a
  stored size, so a thin second act looks thin — which is the whole reason to
  shape on a canvas rather than in an outline.
- **The opening** — whatever precedes the first structure point — is drawn as
  a region without one. It is the state every project is in before anything
  is marked, and is not a fault.
- **A structure point brings its scene with it.** A marker marks *this scene
  starts this act*, so a point needs a scene to mark, and a writer with only
  a beginning and an end has none. The scene it makes is where the filling-in
  will happen. (`addEpisode` has always worked this way.)
- **The kinds on offer are the format's**: act, sequence and a milestone of
  the writer's own in a script; part, chapter and a milestone in a book;
  episode, act, sequence and a milestone in a series. A milestone is a `note`
  marker — no noun, so no number, so what it says is what the writer typed.
  That is §2's *no named paradigm at all*.
- **Dragging a point takes its region with it.** "Move the midpoint earlier"
  moves the midpoint *and what is under it*; a boundary that slid off its
  material would leave the story saying something nobody asked for.
- Removing a point removes the shape, never the writing: its scenes stay
  where they are and fall into the region around them.
- Zoom and scroll position are remembered, per machine.

One thing changed outside the module to make it work: a `note` marker used to
be numbered like a division ("I") despite having no noun. It now carries the
writer's words, which is what *just a note* meant all along.
