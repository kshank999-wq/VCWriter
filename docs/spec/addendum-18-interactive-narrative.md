# Addendum 18 — Interactive Narrative

*From Ken's* VC Writer Interactive Narrative Development Specification v1.0,
*15 September 2026. His brief beside it: **"We need to create something unique.
There's a few narrative softwares out there. But I feel like they're very
limited."** That sentence is the spec this addendum actually answers; §9 below
says what the limitation is and what we do instead.*

**Status: stages 0 and 1 built.** §10 is the build order; §13 says what each
built stage does.

---

## 0. The audit

The habit that has paid five times running: before building what a spec asks
for, find the mechanism that is already general and merely narrow in
vocabulary. This spec is the largest yet and the audit is the most productive
yet — **more than half of §3's element list and most of §9, §14, §17 and §18
already exist**.

| The spec asks for | What is already built |
| --- | --- |
| §2.3 **Central spine** | **The story order.** `unitsInStoryOrder`, lanes, markers. See §3 below — this is the most consequential finding in the audit. |
| §3 **Story Node** | A **beat** is a playable story unit and a **unit** a scene or encounter; manuscript elements hold the words. Both already carry status, colour, summary, links and attribution. |
| §3 **Relationship** (NPC trust, faction standing) | **Character relationships**, addendum 08 §7 — and already *two directions rather than one*, because the directions may disagree. A faction is a character the cast list has no opinion about. |
| §4 **Relationship edges** | **`story_links`**. `from_type`/`to_type` are text, so a new element kind needs no DDL; the verb list already holds `enables`, `prevents`, `depends_on`, `causes`, `reveals` — five of §4.1's twelve — plus `custom` with a label. |
| §9 **Node map** chrome | **The Story Sculptor**: canvas, zoom, pan, mini-map, focus, filters, search, labelled links, card dialogs, research shelf. Its *layout* does not fit — §1. |
| §9 overlays, §14 lanes | **`story-map.ts`**. The lane engine knows nodes, edges and a scene index *and nothing else*, and every lane is drawn by one `LaneRow`. A narrative lane is another small reader and no change to the engine. |
| §12 **Validation** | The *pattern* is built and proved — `setupReadiness`, the Character Creator's continuity notes, the book index's orphans. The checks themselves are new. §8. |
| §14 **Integration** | Characters, locations, themes, motifs, setups & payoffs, arcs and research are all linkable today, through `story_links` and `usage_links`. |
| §15.2 **Element Inspector** | The Inspector, with **Related Elements** already in it. |
| §17 / §18 **Export and reports** | `print-html`, `print-grid`, `print-outline`, `print-sheet`, `print-one-sheet`, `exportPdf`, and a Reports menu to hang them from. |

What is genuinely new: **choices, conditions, effects, state, resources,
endings, the simulator, and the graph canvas.** That is a real module — but it
is a third of the spec, not all of it.

---

## 1. The one thing that does not fit: the Sculptor is a tree

The spec's §9 reads like a description of the Story Sculptor, and it is not.

`sculptorNodeSchema` carries a `columnId` and a `parentId`: a node belongs to a
column and hangs off a node in the column before it. `boardLayout` measures the
whole diagram from that one rule, and the module's own note says it plainly —
*a link is never what holds two things together; the parent relation is*.

**A branching narrative is not a tree.** §10 asks for branch-and-converge, and
convergence means a node with two parents; it asks for loops, and a tree has
none. Putting narrative on the Sculptor's board would mean either breaking the
layout rule that makes the Sculptor work, or drawing convergence as a *link*
and quietly having the picture stop meaning what it says.

So: **a second canvas, sharing the Sculptor's chrome and not its layout.** Zoom,
pan, mini-map, focus, filters, search and the card dialog are reusable and will
be reused. The layout is its own.

And it is **derived rather than dragged** — no `x`/`y` on a narrative node, the
rank computed from distance along the spine. This is not a shortcut: it is the
character map's rule (addendum 08 §8), and the reason is the same. The Sculptor
stores position because *arranging the board is the work*; a narrative graph is
a reading of the logic, so a node added by drawing an edge should appear
without anybody dragging it, and a graph that has drifted from its own logic is
a lie in the shape of a diagram.

---

## 2. The decision the module rests on: **a choice is not an edge**

Every tool in the field models a choice as a connector. Twine's link, articy's
connection, Arcweave's arrow. Ken's §4 inherits that framing — *"a relationship
is not merely a visual connector; it contains logic"* — and then §5 quietly
makes it impossible.

§5 asks for consequences that are **delayed**, **cumulative**, **hidden** and
**revealed later**. A consequence fifty nodes away has *no edge to live on*.
There is no connector between sparing the engineer in hour one and the reactor
in hour nine; the whole point is that they are not adjacent. Hang the logic on
the connector and the tool can only express consequences that are next door —
which is exactly the limitation Ken is describing in the tools he has tried.

So three things, kept apart:

| | Answers | Lives on |
| --- | --- | --- |
| **Edge** | *Where does the player go?* | the pair of elements |
| **Effect** | *What changed?* | the **choice**, not the edge |
| **Condition** | *What may happen here?* | the **gated element**, not the edge |

A choice may have effects and no edge at all — that is §5's delayed
consequence. An element may be gated by a condition naming a choice it has no
connector to — that is the reactor checking `engineer_alive`. Convergence
becomes ordinary: two edges into one node, and the state each path carries is
whatever its effects set, which is §10's *preserve state when paths converge*
with nothing special written for it.

This single separation is what makes §22's worked example expressible, and it
is the thing the field gets wrong.

---

## 3. The spine is the manuscript

§2.3 wants a central through-line that branches leave and rejoin. The audit's
best finding is that **VC Writer already has one and the designer already
writes in it**: the story order — units in lanes, in order, with markers.

Every other tool makes you keep a flowchart beside a script and reconcile them
by hand. The flowchart is the truth for logic, the script is the truth for
words, and they drift the moment anybody is busy. That drift is most of what
"limited" means in practice.

So the spine is **not a new artifact**. A narrative element *binds* to a beat
the way an outline row already promotes to one (addendum 06 §12) and a
Sculptor node already binds to a scene (addendum 03 §6). The words stay in the
manuscript editor, the logic lives in the linked record, and §14's *a single
element can appear in multiple views without creating duplicate source records*
is kept by construction rather than by discipline.

A node that is bound to no beat is legal and normal — a cinematic, an
encounter, a state change with nothing written yet. Binding is an offer, never
a requirement.

---

## 4. Reachability is a reading

Every tool in the field has a **Validate** button that prints a list. You press
it, you get a report, and between presses the report is wrong.

This project does not do that anywhere else and will not do it here. Whether a
node can be reached is derived from the graph every time it is asked —
`reachable(file)` walks from the entry points through the edges whose
conditions *can* be satisfied — so:

- an unreachable node is **drawn** unreachable, on the map, in the inspector
  and in the reports, at the same moment;
- deleting the only choice that led somewhere turns that somewhere red **with
  nothing run**, exactly as cutting a scene turns a characterization item red
  and dragging a scene past a payoff turns its light red;
- there is **no stored `reachable` column**, no *rebuild* command and nowhere to
  press one, for the same reason there is no stored page number in the book
  index.

This is the fifth time the project has made a fact about the work a reading
rather than a column, and it is the single most visible difference from the
field.

---

## 5. One evaluation, three readers

The simulator, the map's colouring and the export must never disagree about
whether a choice is available. The precedent is Writers Room stage 9: `applyTray`
is pure, the preview runs it to draw what the merge would look like and the
commit route runs the *same function*, so the picture and the result cannot
differ.

Here: one `evaluate(graph, state, at)` in the domain. The simulator calls it to
say what is offered and **why something is not**; the map calls it to colour;
the validator calls it to find the impossible. Three readers, one answer. A
second implementation anywhere is the bug.

§16.2's ordering is kept there and only there: availability conditions first,
then the selected choice's effects applied atomically, then the destination.
Every mutation logged, because §13 requires the simulator to explain itself.

---

## 6. State is named once

§16 asks for state referenced *by stable ID rather than display name*, and it is
worth saying why that is not a detail. In Twine a variable is a string inside a
macro; rename it and you hand-edit every passage that mentions it and miss one.

A `StateDefinition` has an id, a name, a kind and a default. Conditions and
effects reference the **id**. Renaming `trust_mara` to `trust_marabel` renames
it everywhere it is read and everywhere it is written, in one act — the same
thing renaming a book-index heading does, and the same thing a location rename
does into scene headings.

That also makes §12's last check possible: **a variable set but never read, or
read but never set**, is answerable only because the references are structural
rather than textual.

---

## 7. The entities

Against §16.1, and with the audit applied:

| Spec entity | Built as |
| --- | --- |
| GameProject | `format: 'game'` on the existing project, plus a `gameSetup` record for §2's type, structure and spine notes. Not a second kind of project. |
| NarrativeElement | **New.** A node: kind, name, optional bound beat, notes. |
| Choice | **New.** Belongs to a node; player-facing text, availability condition, effects, optional destination. |
| RelationshipEdge | **`story_links`**, widened — `from_type`/`to_type` are text already. The twelve verbs of §4.1 join the seventeen there. |
| ConditionGroup / Condition | **New.** ALL/ANY/NOT over comparisons against state ids. |
| Effect | **New.** Set, add, grant, consume, unlock, block, reveal, delay. |
| StateDefinition / StateValue | **New.** §6. A definition is authored; a value exists only inside a simulation run. |
| ResourceDefinition, Equipment, Ability | **New**, and one table with a kind rather than three — §7's eight bullets differ in *fields*, not in nature, and the economy questions (source, sink, scarcity) are the same questions for all of them. |
| Quest / Objective | **New.** The closest existing thing is a setup-and-payoff's states, and it is not close enough: a quest is a small state machine and a payoff is a moment. |
| EndingDefinition | **New.** §11, with hard requirements and weighted contributors kept apart. |
| SimulationRun / SimulationStep | **New**, and **stored**, unlike everything else here — a saved playthrough is a record of what somebody did, not a reading of the work. |

---

## 8. Validation is checkable, never an opinion

Every one of §12's twelve checks is a fact about the graph, which is why the
list is worth building whole. Compare the Character Creator's rule: *this
character is thin* is not a thing software gets to say, but *this cause is
written after its effect* is. The same line holds here —

- unreachable nodes, dead ends, choices with no consequence **and** no
  destination, missing prerequisites, circular dependencies, contradictory
  conditions, endings with impossible conditions, orphaned state: all
  structural, all checkable.
- *a weapon introduced without compatible ammunition* and *a resource that can
  be exhausted before a mandatory use*: structural too, once §7's definitions
  carry their acquisition points — which is the reason to build §7 before §12
  rather than after.

And one refusal: **a dead end is not an error until the designer says so.**
§12's own wording — *dead-end branches that are not intentional endings or fail
states* — is the tell. An element carries *this is meant to end here*, and the
check reads it; a validator that cannot be told it is wrong becomes noise, and
noise gets switched off.

---

## 9. What "unique" means here

Ken's brief. Against the field as it stands:

| | Twine | Ink / Yarn | articy:draft | **This** |
| --- | --- | --- | --- | --- |
| Logic without code | macros — code | a language — code | conditions in a UI | **§4.2 builder, no code** |
| Story text and graph in one document | passages are the text | the script is both | separate, linked | **the spine is the manuscript** (§3) |
| Consequence at distance | variables, by hand | variables, by hand | yes | **effects are not on edges** (§2) |
| Validation | broken links | compile errors | a report you run | **a reading, always current** (§4) |
| Rename a variable everywhere | no | no | yes | **yes, by id** (§6) |
| Same answer in simulator and map | — | — | two systems | **one `evaluate`** (§5) |
| Resources in the same graph as story | no | no | partly | **§8, one graph** |

Three of those columns are *because of what VC Writer already is*: a tool where
the manuscript, the cast, the locations, the themes and the research already
live in one document. Nobody else building a narrative graph gets to start
there, which is the honest answer to *what makes this unique*.

---

## 10. Build order

Each stage is usable on its own; none needs the next.

0. **The format and the setup.** ✅ `game` joins `ProjectFormat`; `nounsFor`
   gets its nouns; §2's type, structure and spine.
1. **The graph, in the domain.** ✅ Elements, choices, conditions, effects,
   state and resource definitions. Pure, tested, no screen.
2. **Evaluation.** One `evaluate`, and reachability as a reading off it. §4, §5.
3. **Validation.** §12, whole, off the same reading. §8.
4. **The canvas.** The second map: derived layout, the spine as the primary
   path, convergence, condition badges. §1, §9.
5. **The rule builder and the inspector.** WHEN / DO / GO TO. §15.2, §15.3.
6. **Progression.** §7's definitions and §8's resource-to-story edges — mostly
   definitions, because the edges are edges.
7. **The simulator.** §13, on stage 2's function.
8. **Endings and the matrix.** §11.
9. **Export and reports.** §17, §18.

§19's MVP is stages 0–4 plus 6, 7 and the JSON half of 9. §20 is out of scope
and stays there.

---

## 11. What is deliberately not here

- **Position on a narrative node.** §1.
- **A stored `reachable`, `blocked` or `valid` flag.** §4.
- **A second evaluator.** §5.
- **A separate flowchart document beside the script.** §3.
- **Logic on an edge.** §2. An edge says where the player goes.
- **A game-engine adapter.** §17 says engine-agnostic and means it; adapters are
  §20 and belong outside the core schema.
- **A second kind of project.** A game is a format, not a fork.

---

## 12. Open questions

Two the spec does not settle, and neither blocks stage 1:

1. **Dialogue.** §3 lists conversation as a story node and §14 mentions a
   dialogue editor. A branching conversation is the same graph one level down,
   and may be that rather than a screen of its own — but a game with a thousand
   lines of barks wants something flatter. Worth deciding before stage 4.
2. **Where the words live for an unbound node.** §3's spine binding covers a
   node that is a scene. A node that is a state change with no prose has
   nowhere to put a line of dialogue, and probably should not.

---

## 13. What the built stages do

### Stage 0 — the format

`game` joins `projectFormatSchema` and **`isInteractive`** joins `formats.ts`.
The predicate is named for the property rather than the format, because what
every caller wants to know is *does this project have a narrative graph* — an
interactive drama would answer yes and argue about being a video game.

**A game is not a third branch of `isProseFormat`.** Its manuscript is a script:
sluglines, cues, dialogue. So the noun table's entry is `...SCRIPT_NOUNS` with
`work: 'Game'` — one line that differs — and that is the table working rather
than failing, because game writers say *scene* and *beat*. Every other format
predicate is an allow-list, so `hasChapterPages`, `hasBookIndex` and the rest
said no to a game without being told.

The setup record (`entities/game.ts`) is short on purpose, and §2 of this
addendum is why: §2.3's premise is the project's **logline**, its milestones are
**story markers** already in order on the timeline, and its mandatory nodes are
a **flag on the node**. Writing the milestones down twice is the failure this
project keeps finding in other people's specs. What is left — game type,
structure, player role, objective, conflict, stakes — is what nothing else
holds. Game type and narrative structure are **free text with suggestions,
never enums**: §2.1 says the choice never limits the designer, and the
thirteenth genre is always the one somebody is writing. **Nothing reads the
structure** — a hub is a node with many edges back, and the engine cannot tell
it from a converge and should not try.

### Stage 1 — the graph

`entities/narrative.ts` and `narrative.ts`. Four collections on the project
file and **no edge table**, which is §2 made structural: the only edge in the
module is a choice's `toElementId`.

Three things the tests hold down:

- **A choice may have effects and nowhere to go.** Examining, taking, refusing.
  Null is legal, and it is what makes §5's delayed consequence expressible.
- **Convergence needed no word.** Two choices pointing at one node is two edges
  in, and nothing in the module was told what convergence is.
- **Renaming a state renames every rule**, because conditions hold the id and
  not the key. Deleting one takes its rules with it — the one place a delete
  reaches into another record, because a condition about nothing cannot be
  evaluated and cannot be repaired by guessing.

`Comparison` was taken: the room AI has meant *two drafts side by side* since
addendum 07 §12, so a rule's operator is a **`Test`**. One name for two
unrelated things is how a domain stops being readable.

Effects are eight kinds and four of them — `unlock`, `block`, `reveal`, `hide`
— are **the designer's vocabulary over one mechanism**: they name an element
and the evaluator keeps the state, so §4.1's words survive into the interface
without anybody inventing a flag called `tunnel_unlocked` and remembering to
read it. `timing` is a **label** that nothing evaluates, and the comment says
so, because a field that looks as though it schedules something and does not is
the worst kind of field.

Resources are **one record with a kind rather than eight tables** (§7's bullets
differ in what a designer says about them, not in what they are), and
`feeds` points from ammunition at the weapons it serves — inverted from how §12
asks, because a reading can invert a list where it cannot invent one.

The first node made is an **entry point** unless the designer says otherwise: a
graph whose every node is unreachable because nobody ticked a box is a bad
first five minutes. And deleting a node **keeps the choices that led to it**,
with their destination cleared — the designer wrote that choice, and deleting
it because its destination went is the tool throwing work away.
