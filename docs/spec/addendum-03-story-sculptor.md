# Addendum 03 — Story Sculptor

Status: stages 1–7 built, September 2026. **Rewritten** from Ken's diagram of
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

## 8. Export as an outline — **withdrawn**

*Written when the Sculptor was the only place a story was planned. Ken's
decision of 11 September: **the Sculptor does not make outlines.***

The original idea was the canvas walked depth-first as indented text, to read
beside you and to print, and this section called it the payoff of the whole
module. It was — right up until there was an Outliner.

Addendum 06 changed what the board is for. The Outliner is where a story is
organised, and material reaches it from the board **by carrying a card across**
(addendum 06 §2, §12 stage 7) — one at a time, with its subtree, because a
board is a picture of possibilities and most of them are not in the story.
An export that flattened the whole canvas would produce exactly the outline
nobody asked for, and then sit beside the Outliner being a second, worse
answer to the same question.

So the payoff moved. It is the Outliner, and the way into it; printing an
outline is addendum 06 §12 stage 9. What the board might still want one day is
a way to print **the board** — the diagram, as a diagram — which is a different
thing and is not specified here.

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

### 14.3 What went

Done: `sculptor.ts` and `SculptorWindow.tsx` and their tests came out with the
Story Grid's first stage, and the names are free again for the model that
replaced them. What follows is why they went.


`packages/domain/src/sculptor.ts` and
`apps/desktop/src/renderer/components/SculptorWindow.tsx`, and their tests.
The spine-of-regions model they implement is not a subset of this one, so
keeping them would mean carrying a second, wrong answer beside the right one.
The Sculptor button comes off the title bar until there is something behind
it worth opening.

### 14.4 Build order

1. **Built.** The board, the two nodes, the canvas, pan and zoom.
2. **Built.** The structure column: blocks between the ends, named,
   reordered, connected.
3. **Built.** The layout rule, and the second column — scenes, widening the
   gaps.
4. **Built.** The third column — beats, growing their scenes.
5. **Built.** Columns beyond the third, defined by the writer.
6. **Built.** Binding a node to a real scene or beat.
7. **Built.** The writer's own connections, labelled.
8. ~~Export as an outline~~ — **withdrawn** (§8). The Outliner is where a
   story becomes an outline, and material reaches it by being carried across.
9. Folding, focus, filters, search, mini-map.
10. Writers Room attribution and alternate boards (addendum 07). A board now
    syncs — addendum 07 §4, stage 0 — so what is left is Writers Room itself,
    which is specified and, past that stage, unbuilt.

Stages 1–4 are the diagram. What the board is *for* is no longer stage 8,
which is withdrawn: it is the Outliner, and carrying cards into it (addendum
06 §12 stage 7).

## 15. Names

| Name | What it is |
| --- | --- |
| **Board** | One canvas. A project may have more than one |
| **Node** | Anything on it |
| **Column** | A vertical lane of the canvas, a level of detail. **Not** a plot lane |
| **Block** | A node in the structure column |
| **Bound** | A node that is the same object as a scene or beat in the script |
| **Link** | A connection the writer drew, as opposed to the parent relation |
| **Shelf** | The Research tree down the side of the canvas, to drag from (addendum 06 §3) |

## 16. What is built

Stages 1–7 — **the diagram, the columns the writer defines, the moment an idea
becomes a scene, and what the writer noticed between two of them**. The
Sculptor is a button on the title bar again, beside Research, and it opens the
canvas over the workspace.

**A new board is two nodes.** Beginning and End, real and editable, with
nothing in them: click either and type what the story begins or ends as. They
cannot be deleted and nothing gets past them, which is what makes them the
frame rather than two more cards. A project gets its board the first time the
Sculptor is opened, because the work starts at those two nodes and they have
to be there to type in.

**Three columns** — Structure, Scenes, Beats — each renameable, because they
are the writer's. `+ Block` puts a shape between the ends; a node's own `+`
hangs a child off it in the column to its right; ↑ and ↓ move it among its
siblings, and × takes it and its subtree off the board without touching the
script, because a node is an idea until it is bound and binding is stage 6.

**§4 is the whole of the layout**, and it is the domain's:

> A node is as tall as its children, and no shorter than itself.

Applied recursively that produces the diagram. A beat is one row; a scene is
as tall as its beats; the gap between two structure nodes is as tall as the
scenes stacked beside it, so the chain down the structure column **stretches
as the clay goes on**. Adding a beat grows its scene, which grows its block,
which pushes everything below it down the canvas — and **nothing ever
overlaps, because nothing is positioned: everything is measured.** A folded
node is one row tall and its children are not laid out at all, which
compresses them and keeps their order.

Sizes are in canvas units and the renderer turns a unit into pixels at the
current zoom (§14.2). The shape belongs to the story; the size belongs to the
screen.

A column is six units wide rather than four because a block carries a
sentence — *a woman who will not ask for help* — and a card that clips it is
a card a writer cannot read their own story off.

**The detail panel** (§9) sits beside the canvas: the node's title and its
note, and a line saying which it is — *an idea, it lives only on the canvas*.
Every node is an idea at this stage; the badge is already there for when
binding arrives.

Boards travel in the document, in `boards[]`, defaulting to empty — so every
project that already exists opens with no board rather than a wrong one.

### Stage 5 — the columns the writer defines

`+ Column` puts a fourth level of detail on the right and leaves it unnamed,
because the name is the writer's: *Character arc*, *Reveals*, *Questions to
answer*, whatever the story is actually asking for. There is no limit, and a
node in the new column hangs off one in the column before it exactly as a beat
hangs off a scene — §4 measures it with everything else, so the chain down the
structure column stretches to fit what has been added off to the right.

A column can be taken off the board, and **only the last one, and never one of
the three every board is made with.** A column from the middle would orphan
the one to its right, which is a diagram that cannot be drawn; the × appears on
the last column's name and nowhere else.

**§5's rule is the point of the stage.** A node stays a title and a note. What
a scene's POV is, what a character arc runs *from* and *to* — that is a
**question the column asks of everything in it**, not a field on the card. So
the detail panel, under the note, says *Character arc asks* and lists the
questions with this node's answers in them; `+ Question` adds one, typing over
its name renames it on every node at once, and × stops asking it and takes the
answers with it, because an answer to a question nobody is asking is not worth
keeping. A column that asks nothing shows no form at all — the writer who
wanted three columns and a sentence on each is never shown a field to fill in.

Answers live on the node, keyed by the question's id (`fields`, defaulting to
empty), so a node in a column that asks nothing carries nothing.

### Stage 6 — binding a node to a real scene

**A node is an idea until the writer says otherwise**, so the detail panel
says which it is in a sentence and offers exactly two ways to stop being one:
*Make it a scene*, which puts one in the script with the node's name on it, or
a list of the scenes that already exist, headed **or it already exists**. A
block offers neither: there is no object in the script for *Act II* to be the
same thing as, and the panel says so rather than showing a control that does
nothing.

A card that is real carries a small filled mark and a solid border; an idea is
dashed and carries nothing, so **a glance says how much of the canvas is
real** — which is the badge §6 asks for.

**One node per scene.** "The two are one thing" only means anything if it is
one thing, so a scene another node has already claimed is not offered again,
on this board or any other. The claim is what makes the rest of it safe:
renaming the node renames the scene and renaming the scene renames the node,
in one place each, with nothing to reconcile.

Where a scene it binds to already has a name and the node does not, the node
takes the script's — binding to a scene reads as recognising it, never as
wiping it.

A **beat** node binds the same way, with one rule from the script: a beat
lives inside a scene and never floats in a lane (spec §19), so a beat can only
be made once the scene above it is real. Until then the panel says so, in
those words, rather than failing when the button is pressed. Once the parent
is bound, only **that scene's** beats are offered — the diagram already says
which scene this beat is in, and offering another's would let the board say
something it does not mean.

**What binding costs, and what it never costs.** Unbinding leaves the scene in
the script and the node on the canvas, no longer joined; it is not a deletion
and never asks. The × on a bound card does ask, and what it offers is §11's
rule in three buttons — *Unbind it*, *Remove the card*, *Keep it* — over a
line saying the scene stays in the script either way. A scene removed from the
script turns its node back into an idea rather than leaving it pointing at
nothing.

**The script is never reordered behind the writer's back** (§11). Moving a
bound node moves the node, full stop. Where that puts it out of step with the
script the panel says so in a sentence — *on the canvas it comes before The
interview; in the script it comes after* — with one button, **Move the scene
to match**, and that is the only route by which the board ever changes the
story order. Making a new scene reads the canvas the same way: it lands after
the scene of the nearest bound node above it, or before the nearest below it,
and at the end when it has neither — so nothing that was already in the script
moves.

### Stage 7 — the writer's own connections

**Connect**, in the bar, with a node chosen: the button arms, every other card
says it is somewhere the line could land, and clicking one draws it. Escape
gets out. It is armed rather than dragged because the canvas's own drag is the
pan, and a writer reaching for a connection should not have to think about
which drag they are starting.

A connection is **any node to any node**, in any direction, across any number
of columns — and it carries a label, which is the whole point of it: *this is
why they cannot find her*, *she goes back*. The label is typed in the detail
panel, under **Connected to**, which lists every line touching the selected
node with an arrow saying which way it runs, a way to go to the other end, ⇄
to turn it round keeping the words, and × to take it off.

**A pair is connected or it is not.** Drawing the same two cards again does
nothing, whichever way round it is asked — the same observation twice is not
two observations — and the direction, which *is* the observation, is changed
by turning the arrow rather than by drawing the reverse. A node cannot be
connected to itself: a line from a card back to the same card says nothing a
writer could read.

The lines are drawn **over** the cards rather than under them. A structural
wire says where a thing belongs and may hide behind a card; an observation is
the reason the writer drew it, and has to be clickable — clicking one selects
the card it starts at, so the picture and the panel are talking about the same
line. Two shapes, and which one is drawn says something: a connection running
into a later column leaves the right edge and arrives at the left, like every
other line on the canvas, while one running **backwards, or within a column**,
leaves the right edge and comes back to the right edge, bowing out into the
air. Squeezing that one through the gap between two columns — which is merely
where its ends happen to be — would draw a kink in the one place the canvas is
busiest.

Labels sit on the curve rather than between its ends, and a label landing on
one already drawn is pushed clear of it, because two sentences on top of each
other are worse than one of them. A long one is shortened on the line and read
in full in the panel.

**A connector is never what holds two things together; the parent relation
is** (§7). So the layout is identical before and after a line is drawn — this
is the one thing on the board that moves nothing — and removing one loses the
observation and not one thing more. A line whose card is deleted goes with it,
and so does one drawn into a column that is removed. A line into a **fold** is
drawn to the folded card standing in for what is hidden, rather than
disappearing, because folding should not look like losing something.
