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
