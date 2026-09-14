# Addendum 13 — Scene Polarity & Scene Purpose

Status: **built**, September 2026. From Ken's *VC Writer — Scene Polarity &
Scene Purpose Development Specification v1.0*.

An overlapping feature existed and was close enough to feel done, which is
worth naming: the **Story Grid** (addendum 04) has had a polarity column and a
purpose line since it was built. Neither was what this spec asks for, and §1
says why the difference matters rather than being a detail.

| | Story Grid, before | This spec |
| --- | --- | --- |
| Polarity | **One word** the writer picks: up, down, mixed, flat | **Two values**: where it begins and where it ends, on a five-point scale |
| Flat | A word you may choose | **Derived**: `start === end` |
| Purpose | A free line of prose | **Six tags**, several true at once |
| The graph | An accumulating value line | **Neutral-centred**, showing each scene's *turn* |

## 1. Flat is worked out, and nobody says it

This is the decision the module rests on.

The Story Grid's single word could be set to *up* on a scene that begins and
ends in exactly the same place. Nothing caught it, because nothing could: a
writer's claim about their scene was the only record of what the scene did. The
pair cannot lie that way. `turnOf` reads `start === end` and there is nowhere in
the interface to disagree with the answer — deliberately no third control saying
*changed / flat*, because that is not a question a writer gets to answer.

Two consequences worth keeping:

- **A scene nobody has read is not a neutral scene.** Both values start empty,
  and a turn is only read once both are given. Defaulting either to *Neutral*
  would have made every unwritten scene silently flat.
- **The label is the truth and the number is for drawing.** *Double positive* is
  the value; `+2` is how the graph puts it on a line. Storing the number would
  let the word and the figure drift, and would invite arithmetic nobody asked
  for — a story does not have an average polarity.

## 2. The Story Grid's word is now a reading

A scene cannot say two things about its own movement. `movementOf` prefers the
pair wherever it has been given, and falls back to the stored word where it has
not — so the Story Grid's polarity column, its filters and its value graph all
improved without being touched, and a project that answered the old way keeps
the work somebody did.

## 3. The graph

**Editor ▸ Scene polarity**, and the fourth tab of the Editors page. Every
format, ungated: every format has scenes that turn.

Scenes left to right in script order, on an axis with **neutral through the
middle**. Each scene draws its start and its end joined by a stroke, so the
thing you see is the **turn** — which a single point per scene could not show.
The ends are then joined scene to scene by a dashed line, which is §4's
requirement: where one scene closes and the next opens is visible as well as
what happens inside one.

**A scene nobody has read is drawn as a gap**, not skipped. A graph that dropped
the unanswered scenes would draw a continuous story and quietly lie about how
much of it has been looked at. The whole column is clickable, because a scene
with nothing drawn on it is the one a writer most wants to click and a dot is
not something anybody can hit.

**A flat scene is marked, never condemned**: a red ring on its end point, and a
prompt beside it — *review whether it needs a turn, an escalation, a reversal,
or another essential function.* It names what a flat scene might need and stops.
Whether this one needs any of it is the writer's call, and a module that said
*cut this* would be wrong half the time and trusted never.

Every flat scene is also listed in one place at the foot, so a pass can be made
over them.

## 4. Scene purpose

Six tags, **several true at once** (§6). A scene that reveals character while
creating tension is doing both, and a control that made you pick would be
teaching the writer something false about their own scene. *Something else
essential* keeps the writer's own words.

A scene nobody has tagged reads **Purpose not defined. Nothing follows from that
on its own** — §6's neutral indicator, said in a way that cannot be mistaken for
a fault.

## 5. Where the control lives

Two places, because the spec asks for both:

- **The scene's own dialog**, above its status — §2's *visible while the writer
  is working inside the scene*, and the place a scene's other properties already
  live. Two selects and a line saying whether it turns.
- **The graph's panel**, for working across the script in one pass.

Both write through `setPolarity`, and the flat reading follows from the pair in
both.

## 6. Where the code is

| | |
| --- | --- |
| The scale, the tags, the readings | `packages/domain/src/polarity.ts` |
| The fields | `packages/domain/src/entities/structure.ts` — on `sceneGrid` |
| The graph and the pair control | `apps/desktop/src/renderer/components/PolarityGraph.tsx` |
| In the scene | `apps/desktop/src/renderer/components/SceneDialog.tsx` |

No migration: `polarityStart`, `polarityEnd`, `purposes` and `otherPurpose` are
four more fields on the scene grid, which lives in the project document.

## 7. What is deliberately not here

- **A control that declares a scene flat.** §1.
- **AI-decided polarity or purpose.** §11 of the spec is explicit for version 1,
  and the module records the writer's decisions.
- **Any suggestion that a flat scene should go.** §7 and §11.
- **Beat-level polarity inside a scene**, **filtering the graph by act or
  character**, and **comparing polarity against arcs or setups** — all §12,
  named as future expansion rather than MVP.
