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

## 5c. A delete for characters and locations, and one sentence for all of them

From Ken: *I need a delete for characters and locations too*. Half of it was
already standing and saying so is the point of the audit habit — **a location
has had a delete since the module was built**, with its own inline ask, and it
has gone to the graveyard since §2. What was missing was characters, and the
gap was not where it looked.

**The delete existed and asked nothing.** `CastPanel`'s row has always carried
a ×, and it removed somebody on one click with no question — which was
survivable while the answer was *gone* and is worse now, because a control
that silently does something reversible teaches a writer to distrust the one
that does not. It asks now.

**And it was in the wrong place.** The cast panel lives inside the Characters
folder; the side menu's *Character Creator* section is where a writer actually
meets the cast, and is where somebody added by accident was added. So the ×
is on the menu row too, in the folders' own shape — the name opens them, the ×
waits until the row is pointed at, the question sits under the row because the
menu is too narrow to put a sentence beside one.

**The sentence is the graveyard's.** Five screens had written *it goes to the
graveyard* for themselves by this point, which is five answers waiting to
disagree the next time one is edited, so `describeDeleting` is the one copy.
Both facts in it belong to this module rather than to any screen: nothing here
is destroyed, and **nothing here is manuscript** — deleting a character leaves
every cue and deleting a location leaves every heading, which is the thing a
writer most needs to hear and the thing no screen should get to promise on its
own. `hangingOn` is the same reading `withoutWhatPointedAt` applies, so what
the sentence says is carried can only be what restoring gives back. A screen
may still put **its own** fact in front of it — the locations panel says how
many scenes name the place, which is §2's *usedIn* and nothing the graveyard
knows about.

Driving the real room caught two things the tests did not. The cast panel's
row is a four-column grid, so the question was laid out in a 120px cell five
words to the line; it spans the row now. And **deleting somebody while their
Creator was open left the room pointed at them** — the menu lit nothing, the
middle column drew a nameless folder — so the selection falls back to where
the writer came from, and the Creator's own lookup asks `living` rather than
merely finding the record.

## 5d. Themes and motifs, and where a delete lives

From Ken: *I need a delete for themes and motifs too*. There was one —
*Delete this theme* in the detail, beside **How it is going** — so the ask is
really about **where a delete lives**, and the answer the room has been
converging on through his last four asks is: **on the row of the thing it
deletes**, hidden until the row is pointed at, asking inline. A story, an
episode and the cast all got that; themes, motifs and locations had theirs at
the foot of a detail pane, which is a scroll away from what a writer is
pointing at.

So the × is on the list row, and the old control in the detail is **gone
rather than kept beside it**: two controls for one act on one screen is two
answers to *how do I get rid of this*. The locations panel moved the same way
in the same change — it was the only list left with its delete in the detail,
and leaving it there would have made the room half-consistent for no reason
anybody could state. `.item-row` and `.item-x` are the shape, so the next list
that needs one adds no rules; `.row-ask` is the question under a narrow row,
one rule for the side menu and the lists alike.

### The fault it uncovered

Driving the screen caught something worth more than the feature: **deleting a
theme left it on the list**. `ThemesPanel` read `file.themes` rather than
`themesInOrder`, and a buried record *keeps its place in the collection* (§2)
— so it was still drawn. Five more readings had the same hole:
`motifsOfTheme`, `themesOfMotif`, `thematicWorkIn`, `describeThematics` and
`thematicTracks`, plus the tagging menu in `BeatBody` and the count in the
research menu. A deleted theme was on the list, on the timeline, under its
motif, in the count and in the menu a writer tags from.

This is exactly the cost §2 names — *every list must not show the buried* —
and the lesson is that **applying the predicate in the module's main reading
is not the same as applying it in the module**. The characters had it too, and
worse, because their delete only shipped an hour earlier: six places wrote
`!person.archived` for themselves, which was the whole answer while a delete
really deleted and is half of one now. `workingCast` in `characters.ts` is
that half made whole — *not deleted and not put away* — and the map, the arc
track, the voices, the cross-arc offers, a Sculptor card's cast and the
colour order read it. A location the script still names can be adopted again
after its record is deleted, which is the same fix pointed at `locationsInOrder`.

What pins it is a test that walks **every** reading rather than the list the
delete came off.

## 5e. Plots and threads

From Ken: *I need a delete for plots and threads too*. Both had one, and both
were wrong in a different way.

**A thread's delete was a fold away and its sentence had stopped being true.**
It sat at the foot of a thread's opened body as *Remove this link*, saying
*N moments go with it. The writing stays* — which was right when it was
written and became a lie the day burying started **keeping** the moments so
that restoring could give the thread back whole. It is on the row now, in
§5d's shape, saying `describeDeleting`. That is the argument for one sentence
in one place made concrete: a screen that writes its own copy goes on saying
it long after the module has changed its mind.

**A plot's delete asked nothing and cut the writing.** The × on the timeline's
track head removed the track *and every scene and beat on it* on a single
click, with the whole warning in a `title` attribute — the most destructive
control in the product behaving like the least — and Research ▸ Plots, where
a writer who made a plot by accident actually looks, had no delete at all.

**A track is not a graveyard record and will not become one** (§5's line, read
for structure): burying a plot would have to bury its scenes and its beats,
and the manuscript is deliberately not in here. So the promise the rest of the
room keeps is kept another way, in `packages/domain/src/tracks.ts`: **the plot
goes and the writing stays**. `dissolveTrack` moves its scenes to another
track at exactly the story positions they already hold — a scene's position is
the project's, not the track's — and that is the offer a writer is given
first. Cutting a subplot whole is still possible, because dropping a subplot
is a real act, but it is the *second* button and it says how many scenes it
takes. An empty track (the accident) is one press and one short sentence.

`trackRemoval` is the one reading both screens ask, so the timeline and the
Research list cannot promise different things, and the last track is **refused
with a sentence** rather than by a control that fails — the × is absent there,
since a button that can only refuse is a button that lies.

## 6. What was built

- `packages/domain/src/graveyard.ts` — the kinds, the predicate, the reading,
  and the four acts (`sendToGraveyard`, `restoreFromGraveyard`, `forgetOne`,
  `emptyGraveyard`).
- `deletedAt` on the seven entity schemas, nullable and defaulting to null, so
  every existing project reads as having deleted nothing.
- The seven readings filtered, and five deletes routed to the graveyard with
  their destructive versions kept for it to call.
- `GraveyardPanel.tsx` and the menu entry.
- `describeDeleting` and `hangingOn`, read by all six screens that ask before
  a delete; the × on the cast rows in the side menu and the ask on the cast
  panel's own.
- The × on a list row (`.item-row`, `.item-x`, `.row-ask`) for themes, motifs
  and locations, with the detail's own delete taken out; `workingCast`, and
  every themes reading routed through `themesInOrder`/`motifsInOrder`.
- `tracks.ts` — `trackRemoval` and `dissolveTrack` — with the × on the plot's
  row in Research and the timeline's own × asking in the same words; the
  thread's delete moved to its row and its sentence replaced by the module's.
