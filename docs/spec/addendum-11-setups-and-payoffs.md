# Addendum 11 — Setups & Payoffs

Status: **built**, September 2026. From Ken's *VC Writer — Setups & Payoffs
Development Specification*.

Half of what the spec asks for already existed: a Setups & Payoffs category in
Research, a payoff record with a title, a description, a list of setup points
and a payoff, statuses and reversible archiving (master spec §7.3). What did not
exist was **the rule the spec is actually about**, and the two ways a writer was
meant to meet it.

| What §§2–7 ask for | Before | Now |
| --- | --- | --- |
| A payoff record with notes, setups, a payoff | Built | Unchanged |
| **The three-setup minimum** | — | §1 |
| **Red / green with an X / 3 count on the list** | — | §2 |
| **A setup after the payoff does not count** | — | §1 |
| **Tagging from the writing** | — | §3 |
| **A timeline track** | — | §4 |
| Jump from an occurrence to its passage | — | §2 |

## 1. The rule, and why it is a reading

**A payoff should have at least three setup points before it.** Nothing enforces
it — red is a warning and never a block, and the writer stays free to write,
export and ignore it. What it may not be is invisible.

Two decisions carry the whole module.

**Before is the only thing that counts.** A setup that falls *after* its payoff
is not a setup, it is an explanation. It stays in the record, listed, with its
place and a sentence saying why it does not count — because a point that
silently stopped counting is worse than one that says why.

**Nothing is stored.** `setupReadiness` in `packages/domain/src/setups.ts`
counts the qualifying setups every time it is asked. Drag a scene from before
the payoff to after it and the light is red the next time anybody looks, with
nothing having run; drag it back and it is green. A cached status would survive
the reorder and be wrong — which is the same reason the book index stores no
page numbers and the Character Creator stores no *used* flag.

**Position is read to the beat, not to the scene.** A setup and its payoff in
one scene is a real thing a writer does, and *which came first* is answerable —
so the comparison goes as fine as the anchor does and falls back to the scene
only when that is all the anchor names.

`MINIMUM_VALID_SETUPS = 3` is the one place the number lives. A record may want
more (`minimumSetups`), and `0` means *use the default*, so a record written
before the field existed reads as three rather than as none required.

## 2. The list, and the light

The light and the count are **on the list**, not inside the record — §10's
requirement and the right one: a status you have to open twenty records to find
is a status nobody reads. The under-prepared sort first, for the same reason.

Inside a record: the count, a sentence, and the number this payoff wants.

The sentence distinguishes three states the light cannot, and that distinction
is what stops it becoming noise:

- *2 setups are placed. The payoff has not been named in the writing yet.*
- *1 more setup before the payoff. 1 falls after it and does not count.*
- *Prepared — 4 setups land before the payoff.*

Every point shows **Scene 12 · Beat 3**, the passage it was tagged on, and a
**Go to it** that opens that beat. (Going to it is offered in the workspace,
where there is a script beside the panel to go to; the popped-out research
window has none, so it is absent there rather than broken.)

A point whose beat has been cut keeps its row and says *the writing it was on
has gone*.

## 3. Tagging from the writing

Right-click a passage → **Make this a setup or a payoff…** — the third thing
that right-click can do, beside the Character Creator's (addendum 08 §7) and the
index's (addendum 10 §6), and deliberately the same shape: *this passage is
that*.

**Which of the two it is, is the only question that matters there**, so it is the
control with the largest type. Everything else — where it landed, whether it
counts, how many the payoff still wants — is worked out afterwards from the
story order, because none of it is something a writer in the middle of a scene
should have to answer.

A payoff can be named in the same act, so nobody is sent off to make a record
first. The point keeps two different things: the **excerpt** is the page's words,
for recognising it later; the **description** is the writer's, for saying what it
does.

## 4. The track

A row per payoff on the master timeline, under Links.

**A row per record, not one row of everything.** The question the track answers is
*how far apart are this payoff's setups, and where does it land* — and points
from three different promises on one line answer nothing.

Setups are rings, the payoff is a filled diamond, and a rule runs between them
so the gap is the thing you see. A setup that falls after the payoff is drawn
where it is, dashed and red: hiding it would make the row agree with the count
and lie about the script. The track head carries the light and the count.

Only records with something placed get a row. A payoff written down but never
tagged has no position, and a row of nothing teaches a writer to ignore the track.

## 5. Where the code is

| | |
| --- | --- |
| The rule | `packages/domain/src/setups.ts` — `setupReadiness`, `setupsBoard`, `setupTrack`, `storyPositionOf` |
| The record | `packages/domain/src/entities/setups.ts` |
| The panel | `apps/desktop/src/renderer/components/SetupsPanel.tsx` |
| Tagging | `apps/desktop/src/renderer/components/BeatBody.tsx` — `PlantSetupOrPayoff` |
| The track | `apps/desktop/src/renderer/components/MasterTimeline.tsx` — `SetupRow` |

No migration: a setup point and a payoff each gained an `excerpt`, and a record
gained `minimumSetups`, all inside the project document.

## 6. What is deliberately not here

- **A block.** §7 is explicit and right: red is a warning, and the writer
  decides.
- **A cached status.** §1. It would survive a reorder and be wrong.
- **A warning that setups are clustered too closely** (§7 offers it as optional).
  *These three are too close together* is a judgement about pacing, and the track
  shows the spacing so a writer can make it themselves.
- **More than one payoff occurrence per record.** §12 asks the question; one
  payoff is what a payoff is, and a second passage that also pays it off is a
  second record or a setup.
