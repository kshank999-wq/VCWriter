# Addendum 12 — Themes & Motifs

Status: **built**, September 2026. From Ken's *VC Writer — Themes & Motifs
Research Module, Development Specification v2.0*.

Nothing of it existed. There was a *Themes* research folder holding ordinary
notes, and a `theme` track kind, and that was all — no motif anywhere, no
occurrence index, no tagging.

## 1. What already existed, and it was more than it looked

The spec's §12 asks for "a polymorphic occurrence service so future research
types can reuse the tagging/indexing infrastructure". **One already existed.**

`usage_links` (migration 0039, built for the Character Creator) carries an owner
kind, an owner id, a scene for navigation, a beat, an element and a quote —
which is every field §5 lists, including the stable anchors §12 asks for over
character offsets. Widening its `ownerKind` from two values to four was the
whole of the data work for occurrences: no second table, no second reverse
index, no second orphan rule, and the sync round trip worked untouched.

That is the third time this has happened (arc links joined `story_links` the
same way, addendum 08 §13), and it is worth naming the pattern: **when a spec
asks for a general mechanism, look for the one that is already general and
merely narrow in vocabulary.**

## 2. Two kinds, all the way down

§2 says themes and motifs must be separate entity types, and says it twice.
It is right, and the reason it is right rather than merely asked for is that
**the fields genuinely differ**:

| | Its own field | Because |
| --- | --- | --- |
| **Theme** | `arcNotes` — where it is meant to go | A theme **develops** |
| **Motif** | `motifType` — visual, object, phrase, sound, colour, gesture, location, symbolic, custom | A motif **recurs** |

Neither field means anything on the other. One table with a `kind` would carry
both half-empty, and the first tidy-up would collapse them.

So: two tables, two collections, two tabs, two lists, two tracks, two choices on
the right-click. There is no function in `themes.ts` that takes *a thematic
thing* and works out which — the one place that blurred them would be the place
the interface started to.

A motif can be **linked** to a theme (`theme_motif_links`). It relates them and
never merges them: the bell is a motif of *what a town owes its dead*, and
saying so must not put the bell's nine recurrences into the theme's occurrence
list, because the theme is not therefore nine times explored.

## 3. Whether a tagged passage still exists is a reading

§5 asks that a deleted passage produce "a recoverable unresolved state rather
than a silent broken reference". Storing that state would mean something has to
*notice* the beat was cut.

`occurrencesOf` works it out from the manuscript every time. Cut the scene and
the occurrence reads as gone, struck through on the screen, with what it used to
say still beside it — with nothing having run. It is the same absence the book
index's page numbers and the Character Creator's colour rest on.

An occurrence anchored to a **paragraph** wants that paragraph; one anchored to
the **beat** survives as long as the beat does. Both are legitimate — the
right-click anchors to the paragraph, and tagging a whole beat is offered where
there is no selection.

Orphans sort **last** in the occurrence list: they have no place in the story to
sort into, and inventing one would be a lie about where they were.

## 4. Tagging from the writing

Right-click a passage → **Tag a theme or a motif…**, the fourth thing that menu
does (beside characterization, the index, and setups & payoffs).

The kind is chosen **first**, in the largest type, and the list underneath is
that kind's list and nothing else. A motif being named is asked what kind of
thing it is; a theme is not asked anything of the sort.

Either can be named there — §10's requirement that a writer is not made to
predefine everything before writing. Nothing is classified for them: §10 forbids
auto-classifying a highlighted passage, and there is no guess in the dialog to
forbid.

The **quote** is the page's words, for recognising the moment later. The
**note** is the writer's: *what this moment does*, which §6 asks for and which
belongs on the occurrence rather than on the theme.

## 5. The screen

**Research ▸ Themes & motifs**, one entry with two tabs behind it.

Each tab shows its kind's list with a count beside each row — a fact, with no
opinion attached about whether nine is enough (§12 forbids prescriptive
scoring). Then that kind's own fields, its links to the other kind, and the
occurrence list: every tagged moment in story order, with its scene and beat,
what the passage says now, and the writer's note. **Go to it** opens the beat;
**Untag** removes the association and leaves the writing exactly as it was.

Removing a theme or a motif asks first and says what goes with it: the taggings,
never the manuscript.

## 6. The two tracks

§8 is explicit that they must not be combined, and the reason is worth keeping:
**a reader meets a motif and understands a theme.** Nine marks on a motif's row
is recurrence working; nine on a theme's row is a different claim entirely. One
combined track would average the two into nothing.

So: a **Themes** group and a **Motifs** group on the master timeline, each
foldable whole, each with a row per item. A theme's marks are squares and a
motif's are rings — §8's requirement that the two stay distinguishable before
anybody colours them. Several marks in one scene fan out rather than stacking
invisibly. An orphaned occurrence is not drawn, having no position to be drawn
at, and something *set aside* leaves the track entirely.

## 7. Where the code is

| | |
| --- | --- |
| The two entities | `packages/domain/src/entities/themes.ts` |
| The module | `packages/domain/src/themes.ts` — tagging, the occurrence reading, the tracks |
| The occurrence | `packages/domain/src/character-creator.ts` — `usageLinkSchema`, widened |
| Tagging | `apps/desktop/src/renderer/components/BeatBody.tsx` — `TagThematic` |
| The screen | `apps/desktop/src/renderer/components/ThemesPanel.tsx` |
| The tracks | `apps/desktop/src/renderer/components/MasterTimeline.tsx` — `ThematicRow` |
| The tables | `packages/supabase/migrations/0047_themes_and_motifs.sql` |

## 8. What is deliberately not here

- **An occurrence table of its own.** §1. One already existed.
- **AI detection of themes or motifs.** §13, and the module's own line: the
  writer says what a passage is, and nothing guesses.
- **A judgement about whether a theme is working.** §13. The counts are facts.
- **A required spacing or number of occurrences.** §6 says so explicitly, and
  the screen has no target to fall short of.
- **A combined thematic track.** §8, and §6 of this addendum for why.
