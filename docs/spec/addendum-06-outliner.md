# Addendum 06 — The Outliner

Status: stages 1–2 built, September 2026. From Ken's *VC Writer Outliner
Development Specification* of 11 September, and the framing he gave with it:
**the Outliner and the Story Sculptor are siblings, and material moves between
them by hand.** Extends §5 (story structure), §7 (research and links) and §19
(the hierarchy) of the master specification; sits beside addendum 02's
workspace and addendum 03's Sculptor.

The Outliner is a **structured planning environment, not a second script
editor**. Research captures possibilities; the Outliner arranges them into
story order, scene logic, beats and supporting detail; the timeline arranges
the production structure; the Script is the finished writing.

## 1. The decision that shapes everything

**An outline item is a plan until the writer says otherwise.**

This is addendum 03 §6's sentence with one word changed, and it is deliberate.
A scene in the Outliner is a scene you intend to write. It is not in the
script, not in the page count, and deleting it costs nothing. When you decide
it is real you **promote** it, and from then on the two are one thing — rename
it in either place and it is renamed in both.

Promotion *is* binding. It is the same mechanism the Sculptor already uses
(`boundUnitId`, `boundBeatId`), the same one-claim-per-scene rule, the same
two-way rename, the same refusal to reorder the script behind the writer's
back. The source specification's §6 asks for "a backlink so the writer can
navigate between planning and writing" and a warning "when an item is already
linked to a script scene or beat"; both fall out of binding rather than being
built again.

**So the Outliner is not a third idea about story structure.** It is a second
shape — a tree rather than a columned graph — over the same one idea.

## 2. The Outliner and the Sculptor

They are companions with different manners, and the difference is the point.

| | **Story Sculptor** (addendum 03) | **The Outliner** |
| --- | --- | --- |
| Shape | A graph in columns. Story time down, detail right | A tree. One order, top to bottom |
| Manner | Free-flowing. Drop a shape anywhere and see what it wants | Rigid. Everything is under something, in an order |
| What it is for | Finding the story | Organising the story you found |
| A node is | A title and a note; anything more belongs to its column | A title, a body, and a **type** |
| Depth | The column it is in | The item it hangs under |

**Material moves between them by dragging, never by converting.** Ken's
reason, in his words: *it'll be a messy process to try to create a mind map
into an outline*. A board is a picture of possibilities, most of which are not
in the story; flattening the whole thing would produce an outline nobody
asked for and then ask the writer to delete most of it. So there is no
*Convert board to outline* button and there never will be. What there is:
**drag a node and its subtree into the outline, or an outline item and its
subtree onto the board, to start your organisation.**

This also settles addendum 03 §8. *Export as an outline* stays exactly what it
says: the canvas walked depth-first as **indented text**, to read beside you
and to print. It is a document, not this workspace, and building the Outliner
does not remove it.

## 3. Where it lives

A first-class workspace, opened from the title bar beside **Research** and
**Sculptor**, filling the window over the workspace the way the Sculptor does.

The source specification asks for Research and the Outliner **side by side**,
with material dragged from one to the other. Two full-window overlays cannot
be side by side, and a drag cannot cross two windows that are not both on
screen — so **the Research shelf lives inside the Outliner**, down its left
side: the same tree of categories and items, narrow, searchable, and
draggable. The same shelf appears in the Sculptor, for the same reason.

That is not a compromise but the honest form of the requirement: the thing
being asked for is *drag research into the plan*, and this is where it can
actually happen.

## 4. The outline model

Everything in the outline is one kind of row, and this is the load-bearing
sentence of the source specification (§3):

> **Item type and indentation are separate concepts.**

A row's **type** says what it is. Its **parent** says how deep it is. Neither
constrains the other, so a Character can sit under a beat, a Note under that
Character, and an Idea under the Note, without any of it being a special case.

| Type | Typical use |
| --- | --- |
| **Scene** | The primary story unit: a scene title, slug, or working label |
| **Beat** | An action, event, turn, revelation, decision, dramatic movement |
| **Note** | A writer's thought, a reminder, a question, a line of dialogue |
| **Idea** | An alternative, a possibility, something not yet decided |
| **Character** | An intention, a reaction, an arc note, an emotional state |
| **Setting** | Environment, atmosphere, geography, staging, time and place |
| **Prop** | A story object, a clue, a costume item, a recurring visual |

**The type list is open** (§12). Conflict, Goal, Revelation, Theme, Setup,
Payoff, Arc Point, Question, Motif and the writer's own are new *types*, never
new *levels* — so adding one is a word in a list rather than a change to the
hierarchy. The schema therefore stores `kind` as a string with known values,
exactly as the Sculptor's node kind is.

```
Outline      { id, projectId, name, items[] }
OutlineItem  { id, outlineId, parentId, orderKey,
               kind, title, body, status, collapsed,
               boundUnitId, boundBeatId,      // promotion, §1
               source }                        // the research it came from, §5
```

`parentId` and `orderKey` carry the whole shape: no `depth` field, because a
depth stored beside a parent is a second answer to a question that already has
one, and the two drift apart on the first drag. Ids are stable, so reordering
never breaks a link.

## 5. Research, dragged in

Dragging a Research item into the outline creates a **linked reference, not a
copy** (§5 of the source specification).

- The row's title is the research item's, and **follows it**: renaming the
  source renames every row that references it, the way a bound scene and its
  node share a name.
- The row's **body is its own**. *What this character wants in this scene* is
  not a fact about the character; it belongs to the row and stays there.
- A linked row is **visibly distinct** from a free-form one, so a glance says
  which of the outline is grounded in research.
- Selecting one **reveals the source** in the shelf.
- The drop **records the use**: the research item's existing usage tracking
  (`usage`, `usedInBeatIds`, `usedConfirmed`) learns that the material has
  been placed, and learns again — with a beat id — when the row is promoted.
  Nothing is marked used without the writer being able to see and undo it.
- Removing the row does not touch the research. It was a reference.

The reference uses the project's existing `StoryEntityRef` rather than a new
table, because the relationship system already exists and a second one would
be a second set of rules to keep in step (§10 of the source specification says
as much).

Categories drag too: dropping a **folder** offers its items rather than
inserting a row for the folder itself, because a folder is where things are
kept and not a thing that happens in the story.

## 6. Promotion to the script

A **Scene** row becomes a `StructuralUnit` in the story order; its child
**Beat** rows become the beats inside it, in their order. Supporting rows —
Notes, Ideas, Characters, Settings, Props — are the writer's planning and do
not become anything in the script; they stay in the outline, where they can
still be read while the scene is written.

- **Send to Script** promotes a scene and its beats in one move, preserving
  both orders.
- A single beat can be sent into a scene that is already real.
- Links to Characters, Objects, Arcs, Setups and Payoffs and Locations survive
  the transfer, because they were references and the ids do not change.
- A promoted row keeps its binding, so the writer can go from the plan to the
  writing and back.
- Promoting something already promoted is **refused by default and offered
  deliberately**: the source specification's duplicate warning, which is the
  Sculptor's one-claim rule seen from the other side.
- **The script is never reordered behind the writer's back.** A new scene
  lands beside the scenes its outline neighbours are bound to, and where the
  outline and the script fall out of step the Outliner says so in a sentence
  and offers one button, exactly as addendum 03 §11 requires of the board.

## 7. The scene card

A Scene row carries a compact summary so the writer can understand it without
opening the script: title, optional number, a short synopsis or statement of
purpose, POV or principal character, location, plot lane, and status.

**Lightweight and collapsible**, and empty until filled in — an unanswered
field is not a gap to be nagged about. Where the scene is promoted these are
the scene's own fields, shown here rather than copied here.

## 8. Working in it

- **Add** Scene, Beat, Note, Idea, Character, Setting, Prop — and whatever
  types the writer has added.
- **Indent and outdent** by toolbar, by Tab and Shift+Tab where no text field
  is claiming them, and by dragging.
- **Drag to reorder** within a scene, between scenes, or anywhere in the
  outline, with a drop indicator saying whether the row will land as a sibling
  or a child, and auto-scroll on a long outline.
- **Expand and collapse** any row, with Collapse All and Expand All.
- **Multi-select** for moving, deleting, duplicating, tagging, promoting.
- **Rename inline.** Outlining is typing, not form-filling.
- **Status** — Planned, In Progress, Written, Revised, or the writer's own.
- **Undo and redo** across every structural change, and autosave, like
  everything else in the document.
- **Search and filter** by scene, character, location, object, idea, status,
  or linked research.
- **Keyboard first**, for writers who would rather not reach for the mouse.

## 9. How it looks

A traditional outline: clear indentation guides, disclosure arrows, and a
weight that falls away with depth — **scene rows strongest, beats lighter,
supporting rows lighter still** — so the hierarchy reads at a glance without
being read. A compact type mark on each supporting row says which of them it
is.

The panel resizes, and fills the window.

```
▸ SCENE 12 — Warehouse Confrontation
  ▸ Beat — Mara enters believing the warehouse is empty.
      • Idea      — Keep the audience aware of movement upstairs before Mara notices.
      • Setting   — Rain hitting the metal roof masks footsteps.
      • Character — Mara is trying to appear calm but is already suspicious.
  ▸ Beat — She finds the missing case open on the workbench.
      • Prop      — The ring is missing from the case.
      • Note      — This pays off the ring setup from Scene 4.
      • Character — Mara realises Daniel lied to her.
```

## 10. What it must never do

- **Never require the outline to be finished before anything can be written.**
  A scene with a title and nothing under it is a valid row.
- **Never turn a mind map into an outline on its own** (§2).
- **Never copy research into the outline** where a reference will do (§5).
- **Never reorder the script behind the writer's back** (§6).
- **Never lose the writing.** Deleting a promoted row offers to unbind rather
  than to delete the scene, as the board's × does.

## 11. Acceptance

- A Scene can be made, given Beats, and given Notes, Ideas, Characters,
  Settings and Props beneath those beats.
- Rows can be indented and outdented to any depth.
- Research can be dragged in from the shelf and the row stays linked to its
  source.
- Scenes and beats reorder by dragging without losing their children.
- A scene collapses and reopens with its hierarchy intact.
- A complete scene promotes to the timeline with its beat order preserved.
- A promoted scene keeps its research links.
- Promoting something twice is refused unless the writer insists.
- A node dragged from the Sculptor arrives as a row, with its subtree.
- A row dragged to the Sculptor arrives as a node, with its subtree.
- The outline survives a save, a restart, and reopening the project.

## 12. Build order

1. **Built.** The document: the outline, the typed row, the tree, and the
   shape rules. Nothing on screen.
2. **Built.** The panel: the outline drawn, rows added, renamed inline,
   folded, reordered, indented and outdented.
3. Dragging: rows moved by hand, with the sibling-or-child drop indicator.
4. The Research shelf, inside the Outliner, and dropping an item in as a
   linked reference.
5. Promotion: a scene and its beats into the script, and everything §6 says
   about it.
6. The scene card.
7. Passing material between the Sculptor and the Outliner, both ways.
8. Search, filters, multi-select, status, Collapse All, the keyboard.
9. Printing and exporting the outline.

Stage 5 is the point of it, the way addendum 03's stage 8 is the point of the
Sculptor: everything before it is arranging, and that is where the arrangement
becomes the script.

## 13. Names

| Name | What it is |
| --- | --- |
| **Outline** | One tree. A project may have more than one |
| **Row** | Anything in it |
| **Type** | What a row is — Scene, Beat, Note, Character… — and **not** how deep it is |
| **Linked** | A row that references a research item and takes its name from it |
| **Promoted** | A row that is the same object as a scene or beat in the script |
| **Shelf** | The Research tree down the side of the Outliner and the Sculptor |

## 14. What is built

Stages 1–2 — **the document, and the outline on screen.** The Outliner is a
button on the title bar beside Research and Sculptor, and it opens over the
workspace the way the board does: an outline is worked on whole.

**A new outline is genuinely empty.** A board arrives with Beginning and End
because a story has both and the writer needs somewhere to type; an outline
has no row every story must have, so offering one would be the template §1
refuses. What it offers instead is a sentence saying a scene or a note will do
and that everything here is a plan until it is sent to the script.

**Type and depth stay apart** (§4). `+ Scene` always lands at the top level,
because a scene inside another scene is not something the outline can mean;
everything else lands *under* whatever is selected, which is what "add a note"
means with a beat chosen. So a Character sits under a beat, a Note under that
Character, and an Idea under the Note, and the type dropdown in the panel will
keep a type nobody has heard of — the list is a list of words (§12).

The row is **a line, not a form**: the title is an input, so renaming is
typing, and a row added is focused and ready to be typed into. Depth is
padding rather than nesting, which means every row is a sibling in the markup
— and that is what lets the arrow keys walk the outline. One guide is drawn
per level so the eye can run back up to the parent.

**§9's weights**: scene rows in the display face, gold and small-capped; beats
in full reading weight; supporting rows muted and a size down. A compact mark
carries the type rather than a word, because *CHARACTER —* in front of every
one of them is a column of noise down the left of the outline. Rows stop at a
readable measure rather than running the width of the screen, which also keeps
a row's controls beside its words.

**Keyboard first** (§8): Tab and Shift+Tab move a row in and out, Alt with the
up and down arrows moves it among its siblings, the bare arrows walk the list,
and Return adds another of what is selected — another beat under a scene,
another note beside a note. Collapse All and Expand All are in the bar, and
folding never touches a row with nothing under it, because a disclosure arrow
with nothing behind it is a lie.

The panel beside it holds the row's title, its type, and the notes too long to
sit on a line, and says which the row is: *a plan, it lives only in the
outline*. The badge is already there for stage 5, when promotion arrives.
