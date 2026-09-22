# Addendum 24 — The Graveyard

*Deleting something in Research does not destroy it. It waits, and it can be
put back.*

Status: built, 22 September 2026.

## 0. Where it came from

Ken:

> What I want to do in the research section is add an area called graveyard.
> That will be at the very bottom of the list. And anything that gets removed
> or deleted, instead of deleting it permanently, it goes to the graveyard,
> just in case you accidentally delete something, you can restore it.

Scope, agreed before building: **Research's own records** — the things a
writer meets as a row in a list with a delete on it, and the ones with no
other safety net. The manuscript is deliberately not in it (§5).

## 1. The graveyard is not the archive

The audit found that **six of the seven records already carry `archived`**,
and `archiveStateSchema` has been in `entities/common.ts` since the beginning.
Reusing it would have been the shortest change in the file.

It would also have been wrong, and this is the decision the module rests on.
**Archived is a writer saying they are done with something. The graveyard is a
writer saying they did not mean that.** Two intentions, so two fields. If they
were one, deliberately archiving a resolved setup would drop it in the
graveyard beside the note somebody deleted by accident, and **Restore** would
mean two different things on two rows of the same list.

It is the companion app's trap read from the other end (addendum 09 §2): a
category is not a destination, and **a state is not a mistake**.

## 2. Nothing leaves its collection

Deleting stamps `deletedAt` and **the record stays exactly where it is**.

That is what makes restoring a promise the module can keep. Every usage link,
story link, occurrence and tag still points at an id that still exists, so
putting something back is **clearing a field** rather than reassembling a
record and everything that referred to it. A graveyard that *moved* rows into a
table of its own would have to rebuild all of that, and would leave every
reference dangling in the meantime.

It follows that a delete must **stop cutting what hangs off the record**.
`removeThread` used to take its nodes and arrows; `removeCharacter` took the
links that touched them. They no longer do — a thread restored without the
moments it was made of would be an empty name. The destructive versions still
exist as `destroyThread`, `destroyCharacter` and the rest, and **the graveyard
is the only thing that calls them**.

The cost is the obvious one: every list must not show the buried, and a reader
that forgets is a deleted note still on the shelf. So the filtering is not left
to the screens — **`living` is the one predicate**, and each module's own
reading applies it: `castByCategory`, `locationsInOrder`, `themesInOrder`,
`motifsInOrder`, `threadsInOrder`, `setupsBoard` and the four research-item
readings in `selectors.ts`. A missed filter is then a failing test in that
module rather than a surprise for a writer.

## 3. The graveyard itself is a reading

There is no graveyard collection and nothing is stored about it. `graveyard`
walks the seven collections for stamps and sorts by when, **newest first** —
the order somebody who has just made a mistake wants, since what they are
looking for is the thing they deleted a moment ago. Restoring takes a row off
the list with nothing run, and a record that was never deleted cannot appear
on it by any other route.

The sixth time this project has made a fact about the work a reading rather
than a column.

## 4. The screen

**Graveyard**, last in the research side menu, under the folders — where Ken
asked for it, and the right place for the same reason: it is not somewhere
work is kept, it is where work waits after a mistake, so it sits under
everything rather than among it. The menu carries a count when anything is in
it.

Deliberately the plainest screen in the room: a list, newest first, the kind
and the name and how long ago, and **Restore**. Nothing to arrange, nothing to
read.

**The two acts that destroy are the two that ask** — forgetting one row, and
emptying the whole thing. Everything else here is reversible, which is the
point of the screen. Nothing ages out on a timer: a writer who comes back to a
project after a month should find what they deleted still there.

## 5. What is deliberately not in it

- **The manuscript.** A scene and a beat have snapshots, and burying one would
  have to bury its writing and its place in the story order with it.
- **A story or a chapter break** (addendum 22 §7). Removing one deletes
  nothing — the words stay — so there would be nothing to put in the
  graveyard, and a row for it would be a promise about an act that did not
  take anything.
- **A story or a chapter break** — see above.

Research notes and setups & payoffs had no delete when the graveyard shipped,
only archive, and one was not invented for them unasked. Ken then asked
(*add a delete to research notes and setups too*), so §5a is that.

## 5a. A delete for notes and setups

`deleteResearchItem` and `deleteSetupPayoff`, both straight to the graveyard.
They are the first delete either record has ever had, and that is the right
order: a shelf with nothing but *archive* on it was the safer screen while
there was nowhere for a mistake to land.

On both screens **Delete stands beside Archive rather than replacing it**,
which is §1 arriving in the interface — put away is a decision about the work,
deleted is a decision about the record, and a writer who meant one should not
be offered the other. Each asks once inline, and what it says is **where the
record is going** rather than a warning: the graveyard is the reason the
control can exist, so the sentence is the reassurance.

A setup record's points ride inside it, so they go and come back with it; the
beats they point at are the manuscript's and are never touched.

## 5b. Destroying takes what pointed at the record

A fault in the graveyard as first shipped, found while building §5a.
`emptyGraveyard` and `forgetOne` filtered the collections and nothing else, so
emptying left a story link pointing at a character who no longer existed.

Burying keeps all of that on purpose — it is what makes restoring able to give
back what was there — but **destroying has to take it**.
`withoutWhatPointedAt` is that, written **once and generically** rather than
as a destroyer per kind: what hangs off a record is a story link that refers
to it, a usage link it owns and a theme–motif link that names it, and none of
that varies by kind. It is also why it lives in `graveyard.ts` and imports
nothing — a per-module destroyer would have to be reached from here, and those
modules already import this one.

## 6. What was built

- `packages/domain/src/graveyard.ts` — the kinds, the predicate, the reading,
  and the four acts (`sendToGraveyard`, `restoreFromGraveyard`, `forgetOne`,
  `emptyGraveyard`).
- `deletedAt` on the seven entity schemas, nullable and defaulting to null, so
  every existing project reads as having deleted nothing.
- The seven readings filtered, and five deletes routed to the graveyard with
  their destructive versions kept for it to call.
- `GraveyardPanel.tsx` and the menu entry.
