# Addendum 03 — Story Sculptor

Status: specified, September 2026. **Rewritten** from Ken's diagram of
10 September; §14 says what changed and what happens to the code built
against the first draft. Extends §5 (story structure) and §19 (the hierarchy)
of the master specification, and adds an area alongside the workspace of
addendum 02.

Story Sculptor is a **node-based mind map for a story**: a canvas of nodes in
vertical columns, where the largest shapes go in first and detail is added by
building out to the right. It is part of the standard program and does not
depend on Writers Room.

**It has no method in it.** No three acts, no beat sheet, no obligatory
scenes. The method lives in the Story Grid (addendum 04), which is a tab of
the editor and is opened on purpose. This is the room where the story is
still being found, and a tool that asks questions here would be asking them
too early.

## 1. Objective

A flat outline asks a writer to know the shape of the story before they have
found it. The Sculptor is the other way round: **an easy way to log the major
ideas, and keep refining them.**

It is called sculpting because that is the order of the work. You fix a
frame — this is where it starts, this is where it ends — and then you add
the big blocks of clay to it. Then smaller ones. Then the detail. Nothing
insists you know the next level down before you have finished this one, and
nothing you put in is a commitment.

## 2. The canvas

A grid canvas that pans and zooms. **Story time runs down; detail runs
right.**

A new board has exactly two nodes: **Beginning** and **End**, connected. Both
are real, editable nodes — click either and type what the story begins or
ends as, in general terms. They are the only two nodes a board cannot be
without, so neither can be deleted; everything else is put in by the writer.

Between them, in the first column, go the **big blocks**: the inciting
incident, a plot point, a midpoint, whatever the writer calls the shapes of
their story. The connector between two consecutive blocks **stretches** as
material is added beside them, which is what makes the frame spread as the
clay goes on.

## 3. The columns

Columns are added to the right, without limit. The first three are made with
every board because nearly every story wants them; **the writer can rename
them, add more, and decide what each one is for.**

| | Column | Holds |
| --- | --- | --- |
| 1 | **Structure** | Beginning, End, and the big blocks between them. A chain: each node connects to the next |
| 2 | **Scenes** | Scenes the writer thinks would work, hung off a structure node |
| 3 | **Beats** | The beats inside a scene |
| 4+ | **The writer's own** | Character arcs, plot arcs, reveals, setups, research, questions to answer — whatever the next level of detail is |

A node in column *n* hangs off a node in column *n−1*: its **parent**. The
connector is drawn from the parent to the group of its children, as in the
diagram — one arrow into the stack, not one arrow per child.

**This is not a plot lane.** Addendum 02 §2 fixes *lane* as a track of the
master timeline, one row per subplot. These are columns: levels of detail,
not threads of story. The two words stay apart.

## 4. The layout rule

One rule, applied recursively, produces the whole diagram:

> **A node is as tall as its children, and no shorter than itself.**

A beat is one row. A scene is as tall as its beats — two beats, a short card;
four beats, a tall one. The **gap between two structure nodes** is as tall as
the scenes stacked beside it. So:

- Adding a beat grows its scene and pushes the scenes below it down.
- Adding a scene grows the gap between the two big blocks it sits between,
  and pushes everything below down the canvas.
- Nothing ever overlaps, because nothing is positioned — everything is
  measured.
- Collapsing a node compresses its children and keeps their order.

Sizes are computed in **canvas units**, and the renderer turns a unit into
pixels at the current zoom. The shape belongs to the story; the size belongs
to the screen.

## 5. Nodes

A node is small on purpose: **a title and a note**. That is what "an easy way
of logging the major ideas" requires — anything more, asked for up front, is
a form to fill in.

| | |
| --- | --- |
| **Title** | What it is. Typed straight on the node |
| **Note** | Anything else, in the detail panel |
| **Kind** | Its column's kind by default, changeable |
| **Colour** | Optional, the writer's own |
| **Links** | Free connections to any other node (§7) |
| **Bound to** | A real scene or beat in the script, where the writer has said so (§6) |

Everything beyond that — a scene's POV, its conflict, a character arc's
before-and-after state — is a **field of its column**, defined when the
column is made, so a writer who wants those columns has them and one who
does not is not shown them.

## 6. Ideas, and the script

**A node is an idea until the writer says otherwise.** This is the decision
that shapes everything else, and it is the opposite of what the first draft
assumed.

A scene node is a scene you *think might work*. It is not in the script, it
is not in the page count, and deleting it costs nothing. When you decide it
is real, you **bind** it: the node points at a `StructuralUnit` in the story
order, and from then on the two are one thing — rename it in either place and
it is renamed in both.

| The node is | What it means |
| --- | --- |
| **Unbound** | An idea. It lives only on the canvas |
| **Bound** | The same object as a scene or beat in the script |

Binding either takes an existing scene or makes one. Unbinding leaves the
scene in the script and the node on the canvas, no longer joined.

The board carries a **badge on every node** saying which it is, so a glance
says how much of the canvas is real.

This is what §9 of the source specification asked for as "prefer linked
references to duplicate content", and what it meant by "Sculptor-only,
Sequencer-linked, or already in the written script" — three states that fall
out of one flag and the script's own `inScript` switch.

## 7. Connections

Two kinds, and they are different things:

- **Structural** — parent to children, and each structure node to the next.
  Drawn automatically, and they say where a thing belongs.
- **The writer's own** — any node to any node, with an optional label. *This
  setup pays off here. This scene is why she does that.* Drawn as a curve
  across the columns, and they say what a writer noticed.

Connectors reroute as nodes move and columns resize. A connector is never
what holds two things together; the parent relation is. So a connector can be
deleted without losing anything but the observation.

## 8. Export as an outline

The canvas, walked depth-first, as indented text: each structure node, then
its scenes, then their beats, then whatever is in the columns beyond.

- **Beside you**, in a window of its own, so the outline can be read while
  the canvas is worked on.
- **Printed**, or exported, like everything else that prints.
- Columns can be left out: an outline of just structure and scenes is what
  most people mean by "the outline".

This is the payoff of the whole module. A writer who has spent an afternoon
dropping shapes on a canvas wants to read the result as prose, and to hand it
to somebody.

## 9. The detail panel

Clicking a node opens its detail beside the canvas, without losing the map:
its title, its note, its kind and colour, what it is bound to, what it is
linked to, and whatever fields its column defines. A bound beat offers a way
straight into the Beat Editor.

## 10. Views

| | |
| --- | --- |
| **Columns shown** | Any subset. Structure alone is the macro shape |
| **Fold** | Any node, and everything to the right of it, folded to its head |
| **Focus** | One node's subtree lit, the rest dimmed |
| **Unbound only** | What is still an idea |
| **Mini-map** | For a board bigger than the window |
| **Search** | Node title, note and kind, with jump-to |

## 11. What it must never do

- **Never require a paradigm.** A board with a beginning, an end and one
  block between them is a valid board.
- **Never lose the writing.** Deleting a bound node offers to unbind rather
  than to delete the scene.
- **Never reorder the script behind the writer's back.** Moving an unbound
  node moves nothing but the node. Moving a bound one asks whether the script
  should follow.
- **Never overlap.** §4 is the whole of the layout.

## 12. Performance

Hundreds to thousands of nodes, scrolling and dragging smoothly, virtualising
what is off screen without the connectors losing their ends. Autosave, and
undo/redo across moves, creation, deletion, binding and linking. Keyboard
shortcuts for adding a sibling, a child, and a node above. Multi-select.
Zoom, scroll, folds and filters remembered per machine.

## 13. Acceptance

- A writer can open a new board, type into Beginning and End, and have said
  something useful about their story.
- Blocks can be put between them in any number, named anything, with no
  template offered.
- A scene added in column 2 widens the gap between the blocks it sits
  between; a beat added in column 3 grows its scene and pushes what is below
  it down. Nothing overlaps at any point.
- Columns can be added beyond the third and are the writer's to define.
- A node can be bound to a real scene, and it is then one object with it.
- Nodes can be connected to each other and the connection labelled.
- The board exports as an indented outline, readable beside the canvas and
  printable.
- The board can be folded to the structure column alone and still read as the
  story.

## 14. What changed, and what happens to the code

### 14.1 The diagram

The first draft of this addendum read the source specification as *a second
view of the manuscript*: a scene node **was** a scene in the script, a region
**was** a span of the story order, and the canvas was a rearrangement of what
the project already held. Stages 1 and 2 of that were built.

The diagram of 10 September says otherwise, in three ways that between them
change the model rather than the presentation:

1. **Beginning and End are nodes you write in**, not the ends of a story that
   happen to exist. That is where the work starts.
2. **The columns stand beside each other**, each a lane of its own, with
   connectors between them — not scenes nested inside structure bands.
3. **The columns keep going** — character arcs, then more detail, then more.
   A fixed ladder of three cannot hold that, and nothing beyond scenes and
   beats has an existing entity to be a view of.

Together those make it a **graph of its own nodes**, some of which point at
real scenes. Not a view. The first draft's §13.1 was wrong, and §13.3's
"a region is a span" goes with it: there are no spans here, only nodes and
parents.

### 14.2 What survives

- The **domain/renderer split for sizing** — canvas units in the model,
  pixels in the view. §4 keeps it.
- The **`note` marker fix**: a marker with no noun no longer takes a number,
  so a milestone says what the writer typed. Useful on its own merits, and it
  stays whatever happens here.
- **Folding**, and remembering what is folded.
- The judgement in §11 that nothing may be lost by deleting.

### 14.3 What goes

`packages/domain/src/sculptor.ts` and
`apps/desktop/src/renderer/components/SculptorWindow.tsx`, and their tests.
The spine-of-regions model they implement is not a subset of this one, so
keeping them would mean carrying a second, wrong answer beside the right one.
The Sculptor button comes off the title bar until there is something behind
it worth opening.

### 14.4 Build order

1. The board, the two nodes, the canvas, pan and zoom.
2. The structure column: blocks between the ends, named, reordered, connected.
3. The layout rule, and the second column — scenes, widening the gaps.
4. The third column — beats, growing their scenes.
5. Columns beyond the third, defined by the writer.
6. Binding a node to a real scene or beat.
7. The writer's own connections, labelled.
8. Export as an outline: beside you, and printed.
9. Folding, focus, filters, search, mini-map.
10. Writers Room attribution and alternate boards, when Writers Room exists.

Stages 1–4 are the diagram. Stage 8 is the reason to have used it.

## 15. Names

| Name | What it is |
| --- | --- |
| **Board** | One canvas. A project may have more than one |
| **Node** | Anything on it |
| **Column** | A vertical lane of the canvas, a level of detail. **Not** a plot lane |
| **Block** | A node in the structure column |
| **Bound** | A node that is the same object as a scene or beat in the script |
| **Link** | A connection the writer drew, as opposed to the parent relation |
