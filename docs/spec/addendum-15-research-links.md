# Addendum 15 — Research Links & the Story Relationship Timeline

Status: **built**, September 2026. From Ken's *VC Writer — Research Links
Development Specification v1.0*.

The Links section makes the invisible structure of a story visible: where an
element is introduced, repeated, developed, depended upon and resolved, drawn
against the script's own timeline. §18 calls it a story wiring diagram, and that
is the right name for it.

## 1. Three record types, and two of them already existed

§16 asks for `StoryLink`, `StoryLinkNode` and `StoryLinkEdge`. Two of the three
were already in the project, general in shape and narrow only in vocabulary —
the **fourth** time this has happened (arc links joined `story_links`, thematic
occurrences joined `usage_links`, the Character Creator's *used* was already a
reading):

| §16 asks for | What it is here |
| --- | --- |
| `StoryLinkNode` | a `usage_link` (0039) — owner kind, owner id, scene, beat, element, quote, note |
| `StoryLinkEdge`, dependency | a `story_link` with `depends_on` — two references and a verb, since spec §7.4 |
| `StoryLinkEdge`, sequence | **nothing at all** — see §2 |
| `StoryLink` | the one new table, `story_threads` |

So migration 0049 is one table, one widened check constraint, and no new index
on anything that already existed. `usage_links.owner_kind` gained `thread`;
`story_links` needed no DDL, because its `from_type` and `to_type` have always
been text.

**The lesson, restated because it keeps paying: when a spec asks for a general
mechanism, look for the one that is already general.**

## 2. A sequence is stored nowhere, and §13 is the reason

§13 requires that a node's horizontal position be derived from actual script
position and never freely draggable, and that reordering scenes repositions
every affected node. Read that from the other end: **if position is derived,
then order is derived.** The sequence of a thread *is* the sequence of the
script.

So there is no `sequence_order` column — §16 lists one — and no sequence-edge
row anywhere. `chain()` in `story-map.ts` computes the joins every time it
draws. Reordering scenes repositions everything because there was never
anything to reposition, which is the same absence the book index has for page
numbers, the Character Creator has for *used*, and Setups & Payoffs has for
readiness.

## 3. Nothing infers a cause

§5.2 says the system should not infer causality in the first release, and the
module holds to it literally:

- A **sequence** thread joins its moments in script order and asserts nothing.
- A **dependency** thread draws **only the arrows the writer drew**. With none
  drawn it shows no connectors and says so in words — *the order alone is not a
  cause, so nothing is joined until you say what relies on what* — rather than
  quietly falling back to chronology and calling the order a claim.

The one place a dependency *is* generated is the one §12 permits: a setup and
its payoff. Naming a passage as a setup of this payoff **is** the dependency,
already declared by the writer, so it is read rather than asked for twice.

An arrow travels from what came first to what needs it — the direction the story
travels — which is the reverse of how the record reads. A dependency pointing
backwards in the script is drawn where it actually falls rather than refused, the
same choice Setups & Payoffs makes about a setup after its payoff.

## 4. The lane engine (§21)

§21 is the critical instruction: *build Links as VC Writer's shared
story-relationship visualization layer, not as a standalone feature.*

`packages/domain/src/story-map.ts` is that layer. It knows about **nodes, edges
and a scene index**, and nothing else — it cannot tell a setup from a motif;
what it has of either is a position, a label, a shape and whether something is
wrong. Each module contributes rows through one small reader:

| Lane | Reader | Edges |
| --- | --- | --- |
| Links | `threadRows` | sequence, or the writer's dependencies |
| Setups & Payoffs | `setupRows` (over `setupLane`) | every setup → the payoff |
| Themes & Motifs | `thematicRows` (over `thematicLanes`) | sequence, per row |
| Character Arcs | `arcRows` (over `arcInStoryOrder`) | declared cross-arc links, else sequence |

§19's next lane — locations, objects, mysteries, questions — is another reader
and **no change to the engine or to anything that draws it**. The screen proves
it: `LinksTimeline.tsx` has one `LaneRow` component, used by all four.

Two smaller decisions inside it. Themes and motifs stay **two `sourceKind`s**
in one lane, because addendum 12 §6's rule that they are never averaged
together holds here too. And a character arc's *declared* relationships
**replace** its chain rather than joining it: two pictures of the same points
would say the order twice and the claim once, and the claim is the part worth
seeing.

## 5. What the screen does

**Research ▸ Links.** The scene timeline across the top from the script's own
units, the four lanes beneath it, and the link list and inspector below.

- **One grid** carries the ruler and every lane, so a node is under its scene by
  construction rather than by two widths agreeing. §2's *all lanes remain
  horizontally synchronised* is not a thing to remember to maintain.
- **Whole story means the whole story fits**: its column is measured from the
  window rather than fixed, because a fixed small column drew a 154-pixel board
  in a 1200-pixel pane and called it the project view. *Wider* and *Scene by
  scene* are fixed and overflow, which is what makes them wider.
- Three widths rather than §15's four. Two of the four — act view and scene
  range view — are the same act, narrowing *what is drawn*, and the **Scenes …
  to …** pair does it properly, as it does on the character map.
- At the narrowest column several moments in one scene collapse into one mark
  with a count (§15's density rule). `pilesOf` groups them; the drawing decides,
  because it is the part that knows how wide a scene is.
- **Toggle each lane, isolate one element, clear the lot** (§14). The count says
  how many rows a filter put away, so a filtered board cannot look unfiltered.
- Click a node to inspect it, double-click to go to its beat in the script
  (§10). There is **no move control anywhere** (§13).

**Add to Research ▸ Links…** is the fifth thing the manuscript right-click does.
§11's *Create New Link* and *Add to Existing Link* are one control rather than
two menu items, because the choice is *which thread* and *a new one* is an
answer to that question. `captureToThread` makes the thread, marks the moment
and keeps the note in one call, and **keeps nothing at all if the moment cannot
be marked** — the same refusal `captureFromScript` makes in the Character
Creator, for the same reason.

A thread of one moment is **said, never refused**: §11 asks for two or more, and
a writer who has marked the first has done the right thing and is halfway
through. A moment whose writing was cut is kept and struck through.

## 6. Where the code is

| | |
| --- | --- |
| The thread | `packages/domain/src/entities/threads.ts` |
| The module | `packages/domain/src/threads.ts` |
| The lane engine | `packages/domain/src/story-map.ts` |
| The screen | `apps/desktop/src/renderer/components/LinksTimeline.tsx` |
| From the writing | `apps/desktop/src/renderer/components/BeatBody.tsx` — `AddToThread` |
| The table | `packages/supabase/migrations/0049_story_threads.sql` |

## 7. What is deliberately not here

- **`sequence_order` on a node**, and **any stored sequence edge**. §2.
- **`node_type`.** §16 names the idea — introduced, repeated, developed,
  resolved — and no values, and a taxonomy invented here would be a vocabulary
  every writer has to learn before they can write down that the key turns up in
  scene four. The moment's own note says what it is, in the writer's words.
- **Inferred causality.** §3.
- **Dragging a node.** §13 forbids it, and there is nothing to drag: the
  position is the scene's.
- **Act view as a separate zoom.** §5.
