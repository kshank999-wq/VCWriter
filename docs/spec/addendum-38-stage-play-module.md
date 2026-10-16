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

## 5. The title page and its builder

A play's front page says three things a screenplay's does not. The title page
record gains a field for each:

- **`descriptor`**, what the work is, set under the title: *A Play in Two
  Acts*, *A Musical in One Act*.
- **`byline`**, the words over the author's name. Left empty it is the
  format's own: **by** on a play and **Written by** on a screen script.
  `splitByline` puts the last *by* on a line of its own, as the page has
  always set *Written* / *by*.
- **`credits`**, the writers after the author. A musical's page names three:
  *Book by*, *Music by*, *Lyrics by*. A credit with no name is not printed.

**The builder is suggestions, not a form.** `titleDescriptors` offers the
play's own description first, built from what it already is: its act markers
counted and its preset read, so a play with two acts set as a musical is
offered *A Musical in Two Acts*. A play with no act marked is offered *in One
Act*, which is a play without an interval. The usual alternatives follow. On
a musical, **Add book, music and lyrics** adds whichever of the three rows
are missing. The field stays free text, so *A Comedy in Two Acts* is
available to anyone who types it.

All of this appears **on a play only**. A screenplay's title-page dialog and
its printed page are exactly as they were, and a test pins it.

## 6. The long cue

The spec's §9 acceptance test: on a layout that sets the cue in the margin
beside its speech (`cueBeside`, used by UK BBC stage, UK contemporary and BBC
taped), a long name must not overlap the speech.

Before this change it did not overlap, but it did something else wrong. The
cue was padded out to the speech's indent, and a name longer than the margin
pushed the first line of the speech right, out of its column.

**The fallback.** A cue needs at least one space after it to be read as a
name rather than as the first word of the speech. Where the margin leaves no
room for that space, the cue drops onto **a line of its own** above the
speech (`attachCue`). The speech then runs on straight under it with no blank
line, because the speech-is-one-block rule already treats a dialogue after a
character line that way. The dropped cue keeps with its speech at the foot of
a page, as any cue does. A name exactly as wide as the margin drops; one
character shorter stays beside the speech.

It is `cueBeside`'s, so it applies to BBC taped as well, which addendum 37
said it would.

## 7. Export: a Word document, a paragraph style per element

Ken's spec §8. Theatres, competitions and publishers ask for a `.docx` as
often as a PDF. What makes one usable rather than merely openable is that
every line carries the style of what it is: a cue is *Character*, a speech
is *Dialogue*, a lyric is *Lyric*. A literary manager can then restyle the
whole script at once, and a production office can pull out every line of one
style.

**File ▸ Export Word document…** appears on every script format. A book
already has its own exports in the Layout room. `buildDocx` writes the
package using the zip writer the eBook already uses. The desktop saves it
where the writer chooses (`saveFile`, a new bridge method); the browser
preview downloads it.

- **Geometry comes from the print's layout** (`layoutForFile`). Each style's
  indent and right edge are the layout's columns at ten to the inch. Capitals
  use Word's own *all caps* setting, so the writer's words go into the file
  exactly as typed, and a centred cue is centred. The page is the layout's
  paper, with the left margin worked back from the column: 1.5″ on Letter
  and 1″ on the stage A4.
- **Word paginates for itself.** The file carries what the paginator's rules
  need: *keep with next* on a heading, a cue and a wryly, and the blank line
  between blocks written as space before the paragraph. There is no space
  before a line inside a speech, and no empty paragraphs anywhere.
- **A cue beside its speech** is the speech paragraph's first word, set with
  a hanging indent and a tab, never padded with spaces. A long cue becomes a
  paragraph of its own, following §6's rule.
- **The front pages** are the title page and the cast page, as Page setup
  says, in a section of their own with no header. The script's section
  numbers from 1 and leaves its first page bare, as the printed one does.

## 8. Driven

In the browser preview, built from this branch, with *The Lamp* opened from
a `.vcw` (musical preset, three roles, one doubling, a song):

- **Writing screen:** the lyric lines are in capitals in their own column.
  The number's title, the dance and the music cue sit with the directions.
- **File ▸ Page setup:** *US musical* is the seventh tile and is lit, with
  its sample page.
- **File ▸ Cast page…:** SARAH, TOM and THE SECOND GRAVEDIGGER in order of
  entrance, with the doubling *TOM / THE SECOND GRAVEDIGGER* on the sheet
  beside them.
- **File ▸ Title page…:** *What it is* offers *A Musical in One Act* first,
  the credit words are *by*, and Music by and Lyrics by are listed below.
- **Printed document:** title page, then cast page, then the script, with
  the lyrics set ten in.
- **File ▸ Export Word document…:** *The Lamp.docx*, which python-docx opens
  with Song Title, Character, Lyric, Dialogue, Dance and Music Cue paragraphs.
  LibreOffice renders it with the BBC layout's long cue on its own line and
  the front pages unnumbered.

## 9. Still named rather than built

- **Save as Custom Template and Restore Defaults** (spec §1), and the
  per-element override inspector (§7). The presets are immutable bundled
  records, which is what §9's last test asks for. What is missing is a place
  to keep a writer's own edit of one.
- **The writing screen does not centre a cue.** The page, the print and the
  Word file do, but the editor sets every line at its indent. That predates
  this addendum and belongs with the editor's own layout.
