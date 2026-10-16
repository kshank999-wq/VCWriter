# Addendum 38 — The rest of the stage play

From Ken, continuing addendum 37:

> First check whether the cast page was finished. Then, in order: musical
> preset, cast page, title page / title builder, long cue, export.

**It was not.** Addendum 37 §7 named five things and built none of them:
the musical preset, the cast page and title-page builder, the long-cue
fallback, DOCX export, and custom templates. This addendum builds the first
four in the order Ken gave. Custom templates (§1 and §7 of his spec) are
still only named, in §13.

---

## 1. The musical: four element types first

Addendum 37 would not build a musical preset that "promised lyrics over a
manuscript with no lyric element". So the first change is to what a
manuscript can hold, and the preset comes after it.

`musicalElementTypeSchema` adds **`song_title`, `lyric`, `music_cue`,
`dance`**: the number's title, the sung words, the band's cue and the
choreographer's direction. Each is a different kind of line, so each is its
own element type. A lyric is not dialogue with a flag on it: it is sung, it
keeps its own line breaks, and a musical page sets it apart from speech.

They belong to a **stage play** (`holdsMusic`), in whatever house style it is
set, because a play with songs in it is still a play. A screenplay does not
get them: a song in a film script is written as action and dialogue.

## 2. The keys

The Final Draft rule holds:

| Key | In | Gives |
| --- | --- | --- |
| Return | song title | a cue, since someone sings the number |
| Return | lyric | the next lyric line, the way a verse is written |
| Return | music cue, dance | action |
| Tab | lyric | re-types it as dialogue: sung to spoken, the change a musical page makes most often |
| Ctrl/Cmd+8 | anywhere on a play | lyric (the one free number) |

The four come **after** the script's own types in a stage play's Tab ring
(`STAGE_CYCLE`). Tab from action to a cue therefore behaves exactly as before,
and a play with no song in it never meets them unless the writer goes looking.

Read back, a lyric is voiced by its singer. The other three are directions,
so the narrator reads them.

## 3. The seventh preset, and a song in the other six

**`stage_us_musical`** is the modern play's page with a song in it, which is
what a libretto is. The cue is centred over the speech. **The lyrics are in
capitals, in a column ten in and forty-five wide** inside the speech's sixty.
The number's title is centred in capitals, and the band's cue and the dance
sit with the directions at column 15.

Any stage play may hold a song, so **every stage layout must say where one
goes**. A layout that said nothing would print a lyric flush left at full
width, where it reads as a direction. `withMusic` derives each place from the
layout's own columns:

- the title and the music cue go where the directions are;
- the lyric goes in the speech's column, inset five;
- a dance is a direction.

A layout that names its own place keeps it, so `withMusic` only fills gaps.
`SPEECH_RUNS_ON` now counts a lyric as part of the speech: no blank line
between a cue and its song, or between a song and the words after it.
A song is also split over a page the way a speech is, with (MORE) at the foot
and `SARAH (CONT'D)` at the head of the next page. On the BBC and UK
side-by-side pages a lyric sits beside its cue, as speech does.

## 4. The cast page

**What already existed.** The cues have always made the cast (`notedCast`), the
Character Creator holds each person, and the cast panel files them. What Ken's
§5 asks beyond that is four facts per role and a page that lists them.

**The record widened.** `character.casting` holds:

- `include`, on by default; the offstage voice and the man in the photograph
  are the ones taken off;
- `description`, the line a director reads, which is not the writer's own
  note in `description` on the character;
- `playingAge`, the range an actor is cast at, which is not `background.age`
  (the person's age in the story);
- `vocalRange`, for a musical;
- `doubles`, the role the same actor also plays.

It is one object stored in one column, `characters.casting` (migration 0067,
applied to the live project; the advisors raised nothing new). The page's own
words (heading, order, time, place and notes) are `settings.castPage`, beside
the title page.

**Read, never stored.** `castPageOf` builds the page from the record. The
default order is **the order each role first enters**: the first cue in the
printed script, matched by the bound character or by name and alias, the way
every other reading of a cue matches. A role that never speaks comes after
everyone who does. The other order is the cast panel's own, by heading.
Moving a scene earlier moves an entrance with it, and renaming somebody in
the Character Creator renames them on the page.

**Doubling is a link per role, read both ways.** NURSE → SARAH and DOCTOR →
SARAH make one actor playing three parts, printed as one chain in page
order. A role cannot double itself or someone who does not exist; the
mutation refuses both. A link to a role taken off the page is skipped,
because the page cannot double with a role it does not list.

**Where it is.** **File ▸ Cast page…** is the title page's screen for the
page after it. The fields are on the left and the page as it will print is on
the right. Nothing is saved until **Update page**, and a role taken off keeps
everything typed for it. The vocal-range box appears on the musical preset,
or wherever somebody already has a range. Page setup has **Print the cast
page** beside the title page's tick, on a play only. The page prints after
the title page and is counted in the export's page total. A play with nobody
in its cast prints no cast page, rather than a page headed *Characters* with
nothing under it.
