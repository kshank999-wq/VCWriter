# Addendum 25 — Game Writing, and the line to VC Game Studio

*From Ken's* VC Writer Interactive Game-Writing & Narrative Authoring
Development Specification v1.0 *and* VC Game Studio Development
Specification v1.0, *both 22 September 2026, and his decisions of
25 September:*

> *"It is actually one tool. You just have a limited form unless you
> upgrade."*
>
> *"The VC Writer version will need to be complete to where you can create
> anything you can do in VC Game Studio as far as the planning, but as far as
> the coding and taking it to the next level where you can import assets and
> that type of thing, that will only be in the Game Studio."*

The two specs are kept beside this addendum as
[`game-writing-spec-v1.md`](game-writing-spec-v1.md) and
[`game-studio-spec-v1.md`](game-studio-spec-v1.md). The Game Studio spec
calls the narrative module *VC Rider*; it is this one.

**Status: stages 0–4 built.** §9 is the build order; §12 says what each built stage does.

---

## 0. The audit

Addendum 18 answered Ken's first interactive spec (15 September) and all ten
of its stages are built. The 22 September spec asks for the same product
again at a larger scale, so the audit is more productive than any before it:
**most of the spec is addendum 18**, and the rest is a short list.

| The spec asks for | What is already built |
| --- | --- |
| §2 Game Project | `format: 'game'` plus `gameSetup` (18 §13 stage 0). |
| §2 Narrative Spine | **The story order.** 18 §3: the spine is the manuscript. |
| §2 Level / Chapter | **Story markers**, and the noun table names them. |
| §2 Scene, Beat | Units and beats, unchanged. |
| §2 Branch, Resolution / Merge | Choices and convergence (18 §2); `spineBypassed` checks that a branch comes back. |
| §4 Characters, relationships, factions | The Character Creator (addendum 08); a faction is a character (18 §0). |
| §4 Inventory, weapons, resources, power-ups, abilities, progression | `ResourceDefinition` with a kind, tier, upgrade and scarcity (18 stage 6). |
| §4 Locations | Addendum 14. |
| §4 Themes, motifs, lore, setups/payoffs | Addenda 11, 12, and research. |
| §4 *Used / Unused* | Research's `usage`, and the readings behind every "not yet used" list. |
| §5 Choices that stay, disappear or become unavailable | `reveal` / `hide` / `block` / `unlock`, and conditions (18 stage 1). |
| §5 Prerequisites and consequences shown visually | Condition badges on the map and `findingsAt` (18 stages 3–4). |
| §5 Unresolved branches, orphans, unreachable states | `narrativeFindings`, all twelve checks (18 stage 3). |
| §8 Choice, state and consequence system | 18 stages 1, 2 and 5, whole. |
| §8 Dependency visualization and validation | The map, the rule sentences and the checks. |
| §9 Inventory operations | `grant`, `consume` and resource conditions. |
| §11 Simulator, state inspector, path comparison | `NarrativePlayPanel`, `replayRun`, `compareRuns` (18 stage 7). |
| §12 Stable ids, versioned JSON, migrations | `project-file.ts` (ADR 0002). |
| §13 Structured export, not flattened prose | `narrativeExport` (18 stage 9). |

What is genuinely new:

1. **The Player Lane**, and the **objectives** it is made of (§5).
2. **The scene's four layers**, as one screen (§6).
3. **The scene element board** (§7).
4. **Interactive objects** (smart objects), **triggers** and **environment
   mechanics** (§9).
5. **Puzzles** (§9).
6. **Cinematic shots** (§10).
7. **Branching dialogue**, which is 18 §12's first open question.
8. **Choice behaviour**: once, repeatable, timed, mutually exclusive (§8).
9. **The setup wizard's missing fields**, and a screen for it (§3). None
   exists: `gameSetup` has no renderer.
10. **Exhaustive path exploration** (§11).
11. **The line to VC Game Studio**: what VC Writer keeps untouched, and what
    it shows but cannot do (§13, Game Studio §3).

Plus the screens Ken described on 25 September, which are §4–§6 below.

---

## 1. One tool, two levels

VC Writer plans. VC Game Studio implements. There is **no third tier** and no
planning feature held back from VC Writer: anything a designer can plan in
Game Studio, they can plan here.

| | VC Writer | VC Game Studio (beta first) |
| --- | --- | --- |
| Bible, spine, scenes, beats, dialogue | ✓ | ✓, the same screens |
| Choices, state, resources, objectives, puzzles, objects, cinematics | ✓ | ✓ |
| Simulator, checks, path exploration, reports, export | ✓ | ✓ |
| Implementation status on a node (Game Studio §3) | read only | ✓ |
| Binding a node to an engine object, code generation, asset import, engine adapters | — | ✓ |

**Absent or greyed follows the house rule.** A thing that does not apply to
the project is absent; a thing that applies but cannot be done *here* is
greyed with the reason in its title. Implementation is the second kind: on a
game project, the Implementation view in the side column shows each node's
status and says *Binding happens in VC Game Studio*. On a screenplay it is
absent.

---

## 2. The file keeps what Game Studio writes

Game Studio opens the same `.vcw`. Two facts about `projectFileSchema` make
that dangerous today, and stage 0 fixes both before anything else:

- **Unknown keys are stripped.** No schema uses `.passthrough()`, so a field
  Game Studio adds is dropped the next time VC Writer saves. The designer
  would lose a week of binding work to a Save.
- **An unknown enum value fails the whole file.** A new `narrativeKind`
  written by a newer Game Studio makes the project refuse to open in
  VC Writer.

The answer is the same as for every other collection: **Game Studio's data is
a collection VC Writer knows about.** `implementationBindings` joins the file
with `.default([])`, so VC Writer carries it exactly. Everything engine-shaped
inside a binding (engine, target path, asset reference) is **free text**, so no
enum widens when a new engine or a new bindable kind arrives. A test round-trips a file with bindings
through VC Writer's load and save and asserts they come back byte for byte.

```ts
implementationBinding {
  id, projectId,
  sourceType: string,     // 'element', 'choice', 'resource', 'state', … — free text
  sourceId,               // the authored record this implements
  engine: string,         // 'godot', 'unity', 'unreal' — free text
  target: string,         // node path, prefab GUID, Blueprint path — free text
  sourceHash: string,     // the authored record's content when it was bound
  complete: boolean,
  note, createdAt, updatedAt
}
```

**Status is a reading, never a column**, as reachability is (18 §4). *Unbound*
means no binding. *Needs update* means the record's content hash no longer
matches `sourceHash`, so a narrative edit after implementation shows up on the
node the moment it is made. *Conflict* means the source record is gone.
*Partial* and *Implemented* come from `complete`. That covers Game Studio §3's
five words, and nothing needs to be run for any of them.

---

## 3. The Player Lane is a reading, plus one record

§5 asks for a lane beneath the spine that says *what the player must do,
learn, acquire, overcome or decide to advance*.

Most of that is already written down elsewhere, so the lane **reads** it and
does not keep a copy:

- **Decide**: the choices at the nodes bound to the scene.
- **Acquire** and **spend**: the `grant` and `consume` effects on them.
- **Learn**: `reveal` effects, and state set by visiting.
- **Overcome**: encounters, and (after stage 5) puzzles.

One thing is not written down anywhere, and it is the thing a Player Lane is
mostly made of: **an objective**. *Find the vault key.* It is not a choice, a
resource or a state, and 18 §7 already said a setup-and-payoff is not close
enough. So `objective` is the stage's one new record:

```ts
objective {
  id, projectId,
  name,                    // "Find the vault key"
  unitId | null,           // the scene it belongs to on the lane
  questId | null,          // the quest it is a step of, if any
  mandatory: boolean,      // the scene is not complete without it
  complete: ConditionGroup // what makes it done, read by the one evaluate
}
quest { id, projectId, name, note, orderKey }
```

**An objective's completion is a condition**, so `evaluate`, `meets`, the rule
builder and `sayCondition` already handle it. Nothing new evaluates anything.
A scene's completion (§9's *scene completion may require…*) is **its mandatory
objectives**, read, not a second rule. A quest is an ordered set of
objectives, which is what 18 §7 meant by *a small state machine*: its state is
which objectives are done, and that is a reading too.

This closes 18 §18's *quest dependency report*, which was absent for want of
quests.

---

## 4. The screens: three places, and the second monitor

Ken, 25 September: the Bible *like the research section*, the writing in the
centre, a vertical menu on the right for everything else, and the story map on
the centre monitor, laid out differently from the writing screen, with a
central lane that scenes and beats are dropped into.

This is the workspace addendum 02 already built, given a game's contents. No
new window machinery is needed: §8 of addendum 02 already sends any room to a
second monitor, keeps one document across windows through `link.ts`, and
marks a page that has left with ⧉.

### 4.1 The Game Bible

A **room**, like Research, and built from `ResearchBody`'s three parts: side
menu, cards, detail. Its side menu is the game's canon:

| Section | Holds |
| --- | --- |
| Characters, Relationships | the Character Creator's records |
| Locations | addendum 14, plus §7's environment mechanics |
| Items & resources | `ResourceDefinition`, by kind |
| State | `StateDefinition` |
| Objects | §5's interactive objects |
| Puzzles | §6 |
| Quests & objectives | §3 |
| Themes & motifs, Setups & payoffs, Lore | the existing collections |
| Research | the existing research tree, unchanged |

Each card carries the house **Used / Not yet used** reading, from the rules and
the manuscript. It is never a stored flag. The Bible is the one place to define
something; the rule builder's pickers read from it.

### 4.2 The writing screen

The existing workspace, unchanged in shape. The manuscript is a script, and a
game's beats are written in it as now (18 §3). What changes is the **far
column**: on a game it holds a **vertical menu** of the game panels, each
opening in place. It is not a new chrome: it is the far-column slot with a
selector.

- **Scene**: the four layers (§5).
- **Rules**: WHEN / DO / GO TO for the bound node (18 stage 5).
- **World**: states and resources (18 stage 5).
- **Play**: the simulator (18 stage 7).
- **Checks**: `findingsAt`, with the count on the button.
- **Endings**: the matrix (18 stage 8).
- **Implementation**: §1's read-only status.

A panel in the menu can be popped out like any section. A room on the other
monitor must not be able to do less than the panel it came out of.

### 4.3 The Story Map, on the centre monitor

The narrative map room (18 stage 4), with three changes Ken asked for:

1. **The spine runs through the middle.** Today it is the top row. It moves to
   a central lane, and branches are drawn **above and below it**, rejoining it
   where they converge. A branch that never comes back is already a finding
   (`spineBypassed`), and on this layout it is also plain to see: a line that
   leaves the lane and does not return.
2. **The Player Lane runs directly beneath the spine** (§3), scene by scene,
   aligned with the spine's scenes above it.
3. **Scenes and beats are dropped into the lane.** A tray holds *New scene*
   and *New beat*. Dropping one into the lane between two scenes creates it
   **in the story order at that place**, and binds a narrative node to it.
   Dropping onto a connection between two nodes puts the new one in between:
   the choice that led from A to B now leads to the new node, and the new node
   carries on to B.

The third change needs a word, because 18 §13 stage 4 says *nothing here is
dragged*. That rule stands. It is about **position**: a narrative node has no
x or y, and the layout is derived from the graph. A drop is not a position.
It is an **edit to the story**: it creates a scene in the story order, or
splices a node into a connection. After the drop, the layout is derived from
the new graph exactly as before, and where the card lands is where the logic
puts it. Tapping a card and then a place does the same thing, for a touch
screen and for anyone who does not like dragging.

Selecting a scene on the map opens it in the writing screen on the other
monitor, and the reverse, through the one document.

---

## 5. The scene's four layers

§6. One panel, four sections, each showing only what it holds:

| Layer | Holds | Where it lives |
| --- | --- | --- |
| **1. Narrative** | purpose, time, participants, prerequisites, expected outcome, the spine place | the unit's summary, notes and grid; characters read from the cues; location from the slugline; the bound node's conditions |
| **2. Behavioral** | what each NPC or companion does, and when | **new**: behaviour notes on the unit, each naming a character, a behaviour and an optional condition |
| **3. Systemic** | gates, mutations, inventory checks, objectives, triggers, success and failure | a **reading** of the bound nodes' rules, the scene's objectives (§3) and triggers (§7) |
| **4. Presentation** | music, ambience, sound, camera, cinematic notes, atmosphere | **new**: presentation fields on the unit, beside the beat's existing `visual` |

Layers 2 and 4 are text and a character reference. Nothing evaluates them: they
are written for the people who build the scene, and are exported for Game
Studio. Layer 3 stores nothing new of its own.

The **scene element board** (§7) is the same scene seen as cards: the player,
the characters in it, the resources its rules grant or consume, its objects,
puzzles and triggers, its exits (the choices that leave it). Selecting a
character opens its dialogue and behaviour notes; selecting an item shows where
it is granted and spent (`resourceEconomy`); selecting an object shows its
verbs. **Every card is a reading.** The board stores nothing, and adding a
card means defining the thing in the Bible or writing the rule that uses it.

---

## 6. Dialogue

18 §12 left it open: *a branching conversation is the same graph one level
down, and may be that rather than a screen of its own.*

**Decided: it is the same graph.** A `conversation` node already exists. Its
choices are the player's lines; their destinations are the next exchange.
What was missing is somewhere for the **other side's lines** to live when the
conversation is not bound to a beat, which is 18 §12's second question. So a
narrative element gets `lines: [{ characterId, text, direction }]`. It is
empty on every kind but a conversation or a cinematic. A conversation bound to
a beat keeps its words in the manuscript, exactly as a scene does; `lines` is
for the unbound case.

A flat **barks** list (many short lines, no branching) is a different job and
is not in this addendum.

---

## 7. Objects, triggers, and the environment

§9. All three are **authored intent**. VC Writer says what should happen;
Game Studio makes it happen physically.

- **Interactive object**: `{ id, name, note, states: string[], initial,
  verbs: [{ name, conditions, effects }] }`. It is defined in the Bible and
  placed in scenes. A verb is a choice that stays where it is: `conditions`
  and `effects` are the existing types, so the rule builder edits them and
  `evaluate` runs them. An object's state is a state definition the object
  owns, so *is the lever up* is an ordinary condition, with no second
  mechanism.
- **Trigger**: `{ id, unitId, name, kind, conditions, effects, once }`. Its
  kind is **free text with suggestions** (proximity, overlap, line of sight,
  interact, timer, state change, dialogue result, inventory, combat), the
  `GAME_TYPES` rule: a list that limits the designer is worse than none.
  Triggers are effects that fire when conditions become true, and the
  simulator fires them after every step.
- **Environment mechanics** on a location: `[{ kind, variant, note,
  params }]`, all text. Darkness, traversal (crawl, climb, swim), hazards,
  visibility, water, audio cues, resource drain. Nothing evaluates them.
  Where one has a rule attached (*the lantern drains in the dark*), the rule
  is written as a trigger, which does evaluate.

---

## 8. Puzzles, cinematics, choice behaviour, the wizard

- **Puzzle** (§9): `{ id, name, objective, components, solution:
  ConditionGroup, hints, onSolve: Effect[], onFail: Effect[], resetOnFail }`.
  The solution is a condition over state, so *the lever is up and the player
  holds the key* is an ordinary rule. `solved` is a state the puzzle owns. A
  puzzle is not a node: it is placed in a scene and read by the nodes whose
  rules mention it.
- **Cinematic shots** (§10): a `cinematic` node gets `shots: [{ camera,
  action, lines, audio, seconds }]` and `skippable`. `seconds` follows the
  beat's own timing fields. Shots are presentation, and nothing evaluates
  them; the node's effects are what the cinematic changes.
- **Choice behaviour** (§8): `repeat: 'once' | 'repeatable'` on a choice,
  read by `evaluate` (a once-only choice already taken is not offered), and
  `timedSeconds` as a label for Game Studio. **Mutually exclusive** needs no
  field: it is each choice setting a flag the others' conditions read, and the
  rule builder offers it as one action that writes those rules.
- **The setup wizard** (§3): `gameSetup` gains `playerFantasy`, `tone`,
  `endingStructure`, `coreLoop` and `progression` (free text with
  suggestions). The wizard is the first screen of a new game project: type and
  structure, then premise (the project's logline), player role and fantasy,
  the loop, the spine (story markers), and starting resources. Every step can
  be skipped, and every answer can be changed later.

---

## 9. Build order

Each stage is usable on its own. Stage 0 comes first because every later stage
writes data Game Studio will read.

0. **The file keeps what Game Studio writes.** `implementationBindings`, the
   status reading, and the round-trip test. §2.
1. **The Story Map's central lane.** The spine through the middle, branches
   above and below, and the drop tray. §4.3.
2. **Objectives, quests and the Player Lane.** §3, and the lane under the
   spine on the map.
3. **The Game Bible room** and the far column's game menu. §4.1, §4.2.
4. **The scene's four layers and the element board.** §5.
5. **Interactive objects, triggers and environment mechanics.** §7.
6. **Puzzles and cinematic shots.** §8.
7. **Dialogue lines and choice behaviour.** §6, §8.
8. **The setup wizard.** §8.
9. **Exhaustive path exploration.** Every distinct playthrough, walked on the
   one `evaluate`, deduplicated by state, reporting where a player can be
   stuck with nothing offered. This is the question reachability cannot
   answer, because 18 §4's walk is structural on purpose.
10. **The Game Studio entitlement.** A product on the licence, a second Stripe
    price, and `entitledTo(product)` generalised from `resolveCaller`. This
    lands when Game Studio's beta needs it, not before.

Stages 1–3 are what Ken described on 25 September, and they come first after
the file.

---

## 10. What is deliberately not here

- **Engine adapters, code generation and asset import.** Game Studio. They
  read the file this addendum keeps safe; they are not in it.
- **A position on any node.** §4.3: a drop is an edit, not a position.
- **A stored status, completion or used flag.** §2, §3, §4.1: readings.
- **A second evaluator.** Objects, triggers, puzzles and objectives are all
  conditions and effects the one `evaluate` already runs.
- **An edition inside VC Writer.** §1: VC Writer plans everything.
- **A clock.** `timedSeconds` and shot `seconds` are labels, as 18's
  `timing` is.

---

## 11. Open questions

1. **What a game's markers are called.** The noun table gives a game a
   script's *Act*. Games say *level*, *chapter* or *mission*. Is that a noun
   per project (from the wizard's progression answer) or one word for every
   game?
2. ~~**Where the Game Bible sits beside Research.**~~ Settled by stage 3:
   on a game, **Research is the Game Bible** (§12, stage 3).

---

## 12. What the built stages do

### Stage 0 — the file keeps what Game Studio writes

`entities/implementation.ts` and `implementation.ts`, as §2 describes.
`implementationBindings` is a collection the file names, so a Save carries it;
`sourceType`, `engine` and `target` are free text, so a newer Game Studio
cannot make a file fail to open here. Status is read every time from the
binding and the record it points at. `fingerprintOf` is synchronous and pure
so that reading can happen anywhere, and leaves out `createdAt` and
`updatedAt` so a touch is not a change.

### Stage 1 — the central lane

`narrative-map.ts`, `narrative-lane.ts`, and the map room.

**The layout rule is unchanged, only where rows go.** Columns are still
`depths`. What moved is the spine: from the top row to a lane through the
middle, with `offset` 0 for the lane and branches counted outwards, negative
above and positive below. `row` is still what the screen draws from, now
measured from the highest branch, and `laneRow` says which row the lane is.
A branch **keeps to the side its parent is on**, so a line that leaves the
lane upwards carries on upwards until it comes back; a branch straight off
the spine takes the next side in turn, above first, because the Player Lane
will sit directly under the spine.

**A drop writes the words' home first and the node second.**
`dropIntoLane` makes the scene (and its one beat) in the story order at the
slot, or for a beat card, a beat at the end of the scene to the left, then a
node bound to it. `dropOnConnection` does the same after the scene the
connection leaves from. Neither stores a position; both are edits to the
story, and the map places the result.

**Splicing keeps the designer's work.** Dropped onto a connection, the
**same choice** now leads to the new node, with its text, conditions and
effects untouched, and the new node carries on to where it went. Dropped
into the lane between two connected scenes, every choice between them does
the same. Where two scenes were **not** connected, nothing is guessed. Two
edges of the story get one more rule each, because dropping scene after
scene onto the end of the lane is the most ordinary thing a writer will do:
at the end, a scene with no way on and not meant to stop gets one, to the new
scene; at the start, the new scene takes over *starts here* and leads to what
had it.

On the screen, the tray is two raised buttons in the bar, *New scene* and
*New beat*. A card is dragged, or tapped and then placed, which is the same
drop for a touch screen and for anybody who would rather not drag. While a
card is carried the gold marks appear: a slot before the first scene and
after each one in the lane, and one on every connection off the spine. **Not
on the spine's own line**, where the lane's slot is the same drop in the same
place, and not on a line back, which dips under the board and has no middle
worth aiming at. That one came from driving the real renderer: with both, two
marks sat on top of each other on every spine connection, and one floated in
empty space over a loop. Escape puts the card back. An empty board now draws
the lane, with a single *Start the story* mark, rather than a sentence and
nothing to aim at.

### Stage 2 — objectives, quests and the Player Lane

`entities/narrative.ts` (`objectiveSchema`, `questSchema`),
`narrative-objectives.ts`, `NarrativeQuestsPanel.tsx`, and the lane on the
map.

**An objective is the one stored record, and its completion is a
condition.** `objectiveDone` is `meetsGroup` on the player's state, so the
simulator, the rule builder and the checks all read it without being told
what an objective is. There is no *done* flag anywhere. A **scene is complete**
when every mandatory objective under it is done (`sceneCompletion`), which is
the spec's *scene completion may require…* with no second rule behind it. A
**quest** stores its name; its steps are the objectives that name it, and
`questProgress` reads how far a player has got and what is next.

**The lane is read, not kept.** `playerLane` walks the story order and, for
each scene, lists its objectives and then what the nodes bound to its beats
say: *decide* for a node with more than one choice, *needs* for a resource a
rule asks for, *gets* and *uses* for `grant` and `consume`, *learns* for
`reveal`, *overcomes* for an encounter or a mission. Each resource is said
once per scene however many rules mention it. A branch off the spine is not on
the lane: the lane is the way through, and a branch is drawn where it is.

Four decisions the tests hold down:

- **Deleting a state or a resource takes it out of objectives too**, as it
  does out of every other rule: a condition about nothing cannot be evaluated.
- **An objective reading a state counts as a read**, so the orphan check no
  longer calls a state *set but never read* when an objective asks about it.
  The other checks that walk `allConditions` are about where on the graph a
  rule sits, and an objective sits on a scene, so they are unchanged.
- **Cutting a scene loses no objective.** One under a scene that no longer
  exists is read as *not under a scene* and waits in the Quests panel to be
  put somewhere, rather than being deleted with the scene.
- **Removing a quest keeps its objectives**, in no quest.

The map keeps **one row directly under the spine** for the lane
(`playerRow`); no node is placed in it, and branches below the spine start a
row further down. Each scene's lines sit under its first card on the spine,
objectives first, five at most and then *+ n more*. Pressing a scene's lines
opens its node beside the map, where the **Player lane** section writes its
objectives: the name, whether the scene needs it, its quest, and *done when* in
the same rule builder every other condition uses. The side panel also lists
what the lane read from the rules, so a designer can see why a line is there.

Driving the real renderer caught one layout fault: a quest step long enough to
wrap put its number on the second line, because a button cannot flow as text.
The steps are now numbered beside themselves, in a two-column grid. And the
panel's new objective opens itself once it has **arrived in the file**, not
from inside the mutation, because the document is shared over the link and the
mutation may run after the click has returned — a test caught that one.

### Stage 3 — the Game Bible and the far column

`game-bible.ts`, `GameBiblePanel.tsx`, `GameInspector.tsx`, and a group in
Research's side menu.

**The audit a ninth time, and it answered §11's second question.** §4.1 drew
the Bible as a room *built from* Research's three parts. Opening Research on
a game showed it already **is** most of one: the cast (one click into the
Character Creator), the locations, the plots, setups and payoffs, themes and
motifs, the character map, the review and the graveyard are all in its side
menu. A second room would be a second place to look for the same people and
places. So on a game, **Research is the Game Bible** — its head, its title-bar
button, its window-menu item and its window's title say so, all through
`paneTitle` — and what a game adds is one group at the top of the same menu,
**The game**: *Items & resources*, *State* and *Quests & objectives*. Objects
and puzzles join the group when stages 5 and 6 build them; until then they are
absent, not greyed.

Each of the three is cards and a detail, Research's shape. **Used / Not yet
used is a reading** (`bibleEntries`): a resource or a state is used when some
condition, effect or objective mentions it, a quest when it has a step. The
detail edits through the same domain functions as the world panel beside the
map, so the two screens are two windows onto one record and cannot disagree;
the world panel's word lists and its economy block are exported and shared
rather than copied.

**The far column on a game** is the Inspector with a vertical menu down its
edge (§4.2): *Beat* (the Inspector as it always was), *Rules* (the rule on
the node bound to the selected beat, with *Put this beat on the Story Map*
where there is none yet), *World*, *Play*, *Checks* (with the count on the
button, and the selected beat's findings first), *Endings*, and *Built* — Game
Studio's status, greyed in the sense §1 means: shown, and said to be done in
Game Studio. On every other format the Inspector is exactly what it was. Being
the Inspector, it goes to a second monitor with the Inspector's own ⧉, and a
room there can do everything the panel here can.

Driving the real renderer caught three layout faults, none of which the tests
could see: the Bible's detail column was **hidden**, because Research hides
its own detail on a full-width section and the Bible's reused the class; the
rail's longest words (*Checks*, *Endings*) were **cut off** at 56px; and the
rule builder's bar **ran off the edge** of the narrower column. All three are
fixed in the stylesheet: the Bible's detail is shown inside its section, the
rail is 64px with tighter tracking, and the builder wraps in the far column.

### Stage 4 — the scene's four layers, and its board

`entities/narrative.ts` (`sceneLayersSchema`, `behaviourSchema`,
`presentationSchema`), `narrative-scene.ts`, `ScenePanel.tsx`, and a *Scene*
entry on the far column's rail.

**Two layers stored, two read**, as §5 drew it. Layer 1 is read off the scene
itself: its summary, its place from the scene heading (`locationOfScene`),
who speaks from the cues (`castInScene`), and what its nodes require. Layer 3
is read off its nodes' rules and its objectives, in the rule builder's own
sentences. Layers 2 and 4 are the only new data, and they live in **a
collection of their own, keyed by the scene** (`sceneLayers`), rather than as
fields on the unit: a unit is shared by every format, and a screenplay's
scene has no NPC behaviour to carry. A scene nobody has described stores
nothing — the record is made the first time something is written.

A **behaviour** is a character, a kind (free text with suggestions — follow,
patrol, lead, flee…), the words, and a real condition for *when*. Because the
condition is a real one, it is treated like every other rule: deleting a state
or resource takes it out, and a behaviour that asks about a state counts as a
read, both for the orphan check and for the Bible's *used*. **Presentation**
is six fields of text (music, ambience, sound, camera, cinematic,
atmosphere) beside what each beat's own `visual` already says, which is read
rather than copied.

**The board stores nothing** (`sceneBoard`): the player (the setup's player
role), everyone who speaks or has a behaviour here, the place, every item a
rule here gives, uses or needs, the objectives, and the ways out — a choice
whose destination is not in the scene. Adding a card means defining the thing
or writing the rule that uses it.

The panel sits on the far column's rail, after *Beat*, and follows the beat
selected in the script: select a beat and its scene's layers are beside it.
Read layers say where they are written, so nobody looks for a box to type in.

Driving the real renderer caught one fault: the layer headings wore the
Inspector's `twisty` class, which is sized for a lone arrow, so *1 ·
Narrative* stacked into three lines. They are ordinary buttons now.
