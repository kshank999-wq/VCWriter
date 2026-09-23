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

## 5f. Setups and payoffs, and the pattern in the asks

From Ken: *I need a delete for setups and payoffs too*. There was one — §5a
built it a day earlier — and it was **beside *Archive* in the detail**, which
is where §5a deliberately put it and where he did not find it. It is on the
row now.

That is the fourth ask in a row where the answer was *it exists, in the wrong
place*, and the pattern is worth writing down rather than rediscovering:
**where a writer looks for a delete is the row of the thing, not the pane that
describes it**. §5a's reasoning was sound about *which* control it should
stand beside and wrong about *where the pair should be*, because Archive and
Delete are not a pair at all — putting a resolved payoff away is a decision
about the work, deleting the record is a decision about the record, and §1 is
the whole reason those are two fields. So **Archive stays in the detail** and
the × goes on the row, which is not a compromise but the two acts landing
where each belongs.

Nothing else changed: the sentence was already `describeDeleting`, the act was
already `deleteSetupPayoff`, and the record's points ride inside it and come
back with it.

## 5g. Notes and folders, and the one that is not a record

From Ken: *I need a delete for research notes and folders too*. Two different
answers, because they are two different kinds of thing.

**A note's delete was §5a's, in the detail beside *Put away***, which is the
placement §5d moved every other list away from. It is on the **card** now —
the × in the corner, waiting until the card is pointed at — because a writer
who wants rid of a note is looking at the note. *Put away* stays in the
detail, for §5f's reason.

**A folder is a shelf, not work.** It has had a delete since the room was
built, and `removeResearchCategory` has always moved everything up to where
the folder was — so deleting one **takes nothing away**, which is §5e's rule
about a plot arriving a second time. That is why a folder is **not** a
graveyard kind and will not become one: there is nothing to restore, because
nothing was lost. What was missing was **saying so before the press**: the
whole explanation lived in a `title` attribute (*Remove this folder; what is
in it moves up*), which is the answer to *what happened to my notes* given
where nobody reads it. `folderRemoval` is that sentence — what moves, how
much of it and which shelf it lands on — and it also carries the two refusals
the act already had, so a seeded shelf and the last folder are **said** rather
than thrown.

Driving the screen caught the sentence disagreeing with itself: *1 note move
to Ideas*, which is what a counted list joined to a fixed verb gives.

**This is also where the pattern stops paying.** Every Research record now
deletes the same way — × on the row or the card, one sentence, the graveyard
behind it — so the next ask of this shape should find the control already in
the right place, and if it does not, the thing to check first is whether the
screen was ever wired to the rule at all.

## 5h. Locations again, and the screen that could only make one

From Ken: *I need a delete for locations too*. §5g said the next ask of this
shape should find the control already in the right place, and it half did —
the × has been on the location's row in Research since §5d, and it works.
What it was not was **where a location is made**.

**The scene's own dialog is the one screen that can put a place in the
library** (addendum 14 §5: a writer sent to Research to name a house will type
the heading by hand instead), and it could not take one out. So a name typed
wrong while writing — *MILLER HOUES*, a place made twice under two spellings —
was a trip to another room to undo, which is the failure §5f named from the
other end: the delete existed, in a place the writer was not.

So the × is on the picker, for the place the scene names. Three things decide
its shape, and all three are the module's rules already written down:

- **It never touches the heading.** A location fills a heading in and never
  owns one (addendum 14 §1), so the record goes and *INT. MILLER HOUSE - DAY*
  stays exactly as it is — which the sentence says **first**, ahead of the
  graveyard's own, because that is what a writer at this screen is worried
  about.
- **There is nothing to un-choose.** Which place a scene uses is read from its
  heading (§2), not stored — so the picker needs no *none*, and a buried record
  simply stops matching.
- **It is absent where the scene names no prepared place**, rather than present
  and refusing: a × that could only refuse is a × that lies.

Two things came out of building it, both invisible to the tests.

**The menu was counting the buried.** The Locations row in the research side
menu read `file.locations` and filtered for `archived` itself — the last
surface in the room still doing its own counting — and a deleted record keeps
its place in its collection (§2), so a place that had left every list went on
being counted there. This is §5d's lesson one surface late: a module's own
reading is the only thing that may be asked, and a count is a reading.

**And the picker was laid out in a 110px cell.** `.scene-heading-fields` is a
three-column grid and the picker was its fourth child, so it fell into the
first column of a second row: the select overflowed, the × sat orphaned under
it, and the question came out three words to the line — the cast row's fault
(§5c) in a different grid. The picker spans the row now, which is also the
truer arrangement: the library is not one of the three fields of a heading.

## 5i. Characters again, and the half of a delete nobody sees

From Ken: *I need a delete for characters too*. §5c built it — the × on the
cast row in the side menu and the ask on the cast panel's own — and driving
the real room confirms it works: press it, answer the question, and MARA
leaves the menu.

**She does not leave the program.** She was still in Read Back's list of
voices, in the Related Elements picker a scene links through, in the
character map's *Focus on*, in the review's filters, in the manuscript
right-click's list of who to characterize, and in the Relationships tab's
list of who somebody else can be related to. Six surfaces, and every one of
them had written `!person.archived` for itself.

This is **§5d's lesson arriving a third time, and the third time is the one
worth writing down**. §5d found the fault in six *domain* readings and fixed
it by building `workingCast` — *not deleted and not put away* — as the one
reading; §5h found it in one *count*. What none of them did was look at the
renderer, where the same six words had been typed six more times. So the
rule is not *apply the predicate in the module*, which was §5d's wording and
is too narrow. It is:

> **A component may not decide who is in the cast.** If a screen writes a
> filter over `file.characters`, that screen has a second answer, and it will
> go on giving it long after the module has changed its mind.

Two counts went the same way in the same change, for §5h's reason: Setups &
payoffs was counting the buried in the research menu and in its own *Active
(N)* tab, both by filtering the collection rather than asking `setupsBoard`.
And the Related Elements picker was offering deleted notes and deleted setups
as well as deleted people — three private filters in one list, none of which
mentioned the graveyard — so it asks `onlyLiving` and `workingCast` now.
Linking to a buried record would make a link the graveyard then has to carry.

What pins it is `cast-surfaces.test.tsx`, which renders **every** component
that lists a person and asserts a deleted one is off it. §5d's own test did
this for the domain; the renderer had none, which is exactly why six
surfaces could be wrong with the suite green.

## 5j. Setups and payoffs again, and the rule generalised

From Ken: *I need a delete for setups and payoffs too*. §5f put it on the row
and driving the room confirms it: press the ×, answer the question, the record
goes and the menu count falls.

**And the promise stayed everywhere else.** A deleted setup went on drawing its
arc across the timeline, counting among what the project still owes on the home
page, riding into the next episode's *Still owed* note, and showing in the
scene that carried it. Four readings, every one writing `!record.archived` for
itself — §5i's fault in the next module along, one day later.

So `workingSetups` is `workingCast`'s twin, and the rule §5i stated for
components is now stated for everything:

> **No reading decides for itself which records exist.** A module owns one
> function that says what it has — `workingCast`, `workingSetups`,
> `locationsInOrder`, `themesInOrder` — and everything else, in the domain or
> on a screen, asks it.

One reading is deliberately **`onlyLiving` rather than `workingSetups`**:
`unresolvedSetupsPayoffs`, which answers *what does this project still owe*. An
archived record that is still unresolved has always counted there, and putting
a promise away is a different statement from deleting it — §1's distinction,
which is the thing that stops this becoming a blanket filter applied without
thinking.

`setups-surfaces.test.ts` is the domain twin of §5i's `cast-surfaces`: it walks
every reading, and each assertion checks the record **was** there before the
delete, so a test that would pass against a reading that never showed anything
cannot slip through.

## 5k. Research notes again, and the number beside the shelf

From Ken: *I need a delete for research notes too*. §5g put the × in the
card's corner and it works — driving the room, the card goes and the question
is the graveyard's.

**And the folder still said two.** Three readings wrote `!item.archived` for
themselves: `researchTree`'s counts down the side menu, `ideasIn` (the room's
brainstorming boxes) and `themeThreads` (the theme rows on the timeline). The
count is the one that matters most here, because it is *the number beside the
shelf the writer just deleted from* — the reply to the press, sitting an inch
away from it, saying nothing happened.

`workingNotes` is the third of these, after `workingCast` and `workingSetups`,
and the three of them together are what §5j's rule asks for: **a module owns
one function that says which records it has, and every reading asks it.** The
shape is now boringly the same each time, which is the point — a fourth module
with this fault should take ten minutes, and a fifth should not exist.

`notes-surfaces.test.ts` walks all four readings, each assertion checking the
note **was** there first, as §5j's does.

## 5l. Locations again, and the one reading that must see the buried

From Ken: *I need a delete for locations too*. §5h put the × on the picker in
the scene dialog and §5d on the row in Research; both work.

**And the sweep found nothing**, which is the first time in four modules —
every locations surface already asks `locationsInOrder`, so there was no stale
filter anywhere. That is `workingCast`, `workingSetups` and `workingNotes`
paying off: the module had owned its reading from the start.

What it found instead is the **opposite** fault, and a worse one.
`placesWithoutRecords` — *a place named in the script that has no record*,
offered so a writer can adopt headings they have already typed — built its
list of known names from the **living** records. So after deleting MILLER
HOUSE while a scene heading still said `INT. MILLER HOUSE - DAY`, the panel
offered to *Make a record* for it, and pressing that made a **second** MILLER
HOUSE beside the buried one. Restore the first and the project has two places
of one name, with `locationOfScene` picking whichever sorts first.

So the rule has an edge, and it is worth stating exactly:

> **A reading over the writer's records asks the module's one function. A
> reading over the *manuscript* asks the whole collection.** The names here
> come off scene headings, which a delete never touches, so *is this place
> already recorded* has to count the buried — or the delete quietly becomes a
> way to duplicate a record and break §2's promise that restoring gives back
> what was there.

What that stops offering is **said rather than silently dropped**:
`buriedPlacesInScript` is its own small reading and its own list on the panel,
*Deleted, but still in the script*, where the act is **Restore** rather than
*Make a record* — the honest one, since there is a record and it still has its
descriptions, its defaults and its notes.

## 5m. Themes and motifs again, and the duplicate by typed name

From Ken: *I need a delete for themes and motifs too*. §5d put the × on the
row and fixed six readings; the sweep this time found **nothing**, the second
clean module running — everything asks `themesInOrder`/`motifsInOrder`.

What it found is **§5l's fault in a module where the name is free text**, and
worse for it. Both screens that make one of these take a **typed name** — the
manuscript's *Tag a theme or a motif…* and the panel's own box — and neither
could see that *Grief* was already in the graveyard. Typing it again made a
**second** Grief with its own occurrence list, and where locations at least
had a scene heading tying the two together, here there is nothing that would
ever reconcile them.

`buriedThematicNamed` is the reading, and both screens ask it. The act is
**Restore**, said before the press — the panel's button reads *Put it back*
and the dialog says the tag will put it back rather than start a rival. Case
and surrounding space are ignored, because a writer retyping a theme from
memory is not promising to match its capitals; the **kind is not**, since two
kinds all the way down (addendum 12 §2) means a motif called Grief is not this
theme.

And a **sentence that had stopped being true**, found in a comment rather than
on a screen: `removeTheme`'s doc said *take a theme away, and its occurrences
with it*, which was right while a delete destroyed and became false the day
burying started keeping them so restoring could give the theme back whole.
That is §5e's thread sentence exactly, one layer down — a comment writes its
own copy of the rule as readily as a screen does, and goes on saying it just
as long.

## 5n. Plots and threads again, and the check that belongs in the act

From Ken: *I need a delete for plots and threads too*. §5e built both — the
plot's × on the track head and in Research, asking in `trackRemoval`'s words
and offering `dissolveTrack` first, and the thread's × moved onto its row.
Both still work, and the **plots half has nothing further to answer**: a track
is not a graveyard kind and will not become one (§5e), so there is no buried
track for a reading to miss and no name a writer can retype into a rival. The
sweep over the threads was the third clean module running — everything asks
`threadsInOrder`.

Except **one count**, in the place the last three asks have taught us to look
first: the research menu's Links entry wrote `(file.threads ?? []).filter((one)
=> !one.archived)` for itself, so a deleted thread went on being counted an
inch from the × that had just deleted it. That is §5h's locations count and
§5k's folder counts a third time, and it is worth saying plainly that the
fault keeps landing on a **count** rather than on a list: a list is somebody's
reading and a count looks like arithmetic, so it is the thing a component
feels entitled to do for itself.

The rest is **§5m's duplicate by typed name, with the worse consequence**.
Both ways into a thread take a name — the panel's inline form and the
manuscript's *Add to Research ▸ Links…* — and neither could see that *The key*
was in the graveyard. A theme's rival started empty beside an empty one; a
thread's starts empty beside one that holds **the whole history**, because §2
keeps a buried thread's moments so that restoring gives it back whole. So the
writer who retypes the name gets a thread that does not know where the key was
ever seen, and restoring the first leaves two of one name with the moments all
on the wrong one.

The decision worth keeping is **where the check goes**. §5m had to put it in
both components, because the two screens each called `addTheme` directly and
there was no single act to put it behind. Threads have one: `captureToThread`
means *use this thread, or make one by this name*, which is exactly the
question the graveyard has an answer to — so the check lives **in the act**,
and no caller can forget it. The panel's own form, which does not go through
that act, says the same thing in the same words, and its button reads *Put it
back*. This is the general shape: **where a single domain act means "this one
or a new one by this name", the check belongs in the act; only where the
screens each build the record themselves does it belong on the screens.**

One thing is deliberately left alone. `resolveRef` (`selectors.ts`) looks a
thread up **by id, over the whole collection**, exactly as it does a character,
a note or a setup — and it should. That is not a listing of what the writer
has; it is the display of a link that still exists, pointing at a record that
still exists, and answering *Missing element* there would be the one thing the
graveyard promises is untrue.

## 5o. Characters again, and the last half of the module

From Ken: *I need a delete for characters too* — the third ask about this one.
§5c built the delete and the ask; §5i swept the six renderer surfaces that
listed a person. This found the half neither looked at: the readings that start
at the **manuscript** and arrive at a person.

`peopleSpeakingIn`, `scriptPresence` and `castForNewEpisode` each walk the
cues, ask `charactersCalled` who is speaking, and then write `!person.archived`
for themselves — the whole answer before the graveyard and half of one after
it. So a deleted character went on speaking in her beat, standing in the
script-presence review and being carried into the next episode's cast, while
being off every list in the program.

A **fourth** turned up only by driving the real room, with 2100 tests green:
`castNeverSpoken` — *in the cast, not yet speaking* — filtered the collection
itself, so the Character review drew a deleted MARA under that heading a second
after she left the menu beside it. It is the plainest case of all and the
easiest to miss, because the word *cast* is in its name and it still went to
`file.characters`; it asks `workingCast` now.

The fix is **one reading rather than three filters**, but the shape of it is
the interesting part, because §5l's edge turns out to be about *this module*
more than about locations. The two questions look alike and are not:

- *Is this cue somebody the project knows?* — a question about the **script**.
  `charactersCalled` answers it over the **whole collection**, buried included,
  and must: `cuesWithoutCharacter` and `notedCast` read it, and if a deleted
  MARA's cue read as an unknown name, `notedCast` would file a second MARA
  beside her. That is the delete becoming a duplicate again.
- *Who is speaking here?* — a question about the **cast**. `castCalled` is that
  one, and it is `charactersCalled` narrowed to the working cast.

So the pair sit beside each other in `characters.ts` with the distinction
written between them, which is the only way it survives the next person to read
it. `cast-script-surfaces.test.ts` walks all six: the four that must lose her and
the two that must keep her, each asserting she **was** there first, so a
reading that never showed anything cannot pass by accident.

**This closes the graveyard.** Every record that can be deleted has a delete on
its own row, every reading over the writer's records asks its module's one
function, every reading over the manuscript asks the whole collection, and both
halves are pinned by a surfaces test per module. The next ask of this shape
should find nothing.

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
- The setups & payoffs × on its row, with Archive left in the detail.
- The note's × on its card, and `research-folders.ts` — `folderRemoval` — with
  the folder's × asking in its words.
- The × in the scene dialog's `LocationPicker`, where a location can be made;
  the research menu's Locations count routed through `locationsInOrder`; and
  the picker given the whole of the heading row rather than one column of it.
- `workingCast` in the six renderer surfaces that listed a person for
  themselves — Read Back's voices, the Related Elements picker, the character
  map's focus, the review's filters, the manuscript right-click's cast and the
  Relationships tab — plus `onlyLiving` on that picker's notes and setups, and
  `setupsBoard` behind the two setup counts; `cast-surfaces.test.tsx` walks
  them all.
- `workingSetups` in `setups.ts`, read by the timeline's arcs, what a scene
  carries and what a new episode is owed, with `onlyLiving` on what the project
  owes; `setups-surfaces.test.ts` walks those.
- `workingNotes` in `selectors.ts`, read by the folder counts, the room's idea
  boxes and the timeline's theme threads; `notes-surfaces.test.ts` walks those.
- `placesWithoutRecords` counting the buried, and `buriedPlacesInScript` with
  its own list and a **Restore** on the locations panel.
- `buriedThematicNamed`, read by the tagging dialog and the themes panel so a
  typed name puts the buried record back rather than starting a rival; and
  `removeTheme`'s doc comment corrected.
- `buriedThreadNamed`, checked **inside `captureToThread`** so no caller can
  forget it, and said before the press on both the manuscript's dialog and the
  panel's form; the research menu's Links count routed through
  `threadsInOrder`.
- `castCalled` beside `charactersCalled`, with the distinction between them
  written down, read by `peopleSpeakingIn`, `scriptPresence` and
  `castForNewEpisode`; `cast-script-surfaces.test.ts` walks the three that must
  lose a deleted person and the two that must keep her.
