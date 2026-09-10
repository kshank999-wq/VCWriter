# Addendum 05 — Short form: the AV sheet, and the board

Status: stages 1–3 built, September 2026; the rest specified. Fills in what addendum 02
§14 left open: *"the module that makes something of it, with the timings and
the shapes that kind of work needs, is a later piece of work."* This is that
piece.

Short form is a commercial, a web video, a spot, a piece made for social.
It is not a screenplay set to a stopwatch — it is a **different document**,
and it is written in the two-column form the business has always used: what
is heard on the left, what is seen on the right, in rows, with a frame beside
each row and a running time against it.

## 1. What replaces what

In a short-form project the **Script becomes the AV sheet**. Not a tab beside
it — instead of it. Everything else about the workspace stays where it is:
the same lanes, the same timeline, the same research, the same editors.

| | Screenplay | Short form |
| --- | --- | --- |
| The finished document | Script — pages | **The sheet** — rows |
| The unit of work | A beat, written as manuscript | **A row**: audio, visual, a frame, a duration |
| What it is measured in | Pages | **Seconds** |
| The timeline | Lanes of plot, acts, threads, links | **One track**, segments and their dialogue |
| Above it | Screen time from the page count | **The storyboard**, frame by frame |

**Nothing new is invented underneath.** A segment is a scene; a row is a
beat; the story order is the story order. What the sheet adds is a second
column of text, a frame, and a duration — and a view that reads down them
rather than across a page.

## 2. The sheet

```
 v1   COMMERCIAL 1
      Total RT 00:00 • Total Words: 48

                    KNOW YOUR ENEMY...
           More important to know who is not your enemy

  Row     Audio              Visual              Image      Duration

  1.1     Sun Tzu said       nerdy kid walking   [frame]    00:00      💬 0
  6 words "know your enemy"  down the street…
  00:00 RT

  …

  END OF SEGMENT 1        SEGMENT RT  SEGMENT WORDS   TOTAL RT  TOTAL WORDS
  KNOW YOUR ENEMY...        00:00          48          00:00       48
```

### The masthead

**Nothing in the masthead is typed on the sheet.** The title and the version
are the **title page's** (spec §6.1) — a short-form piece has one like
anything else, and a title typed in two places is a title that disagrees with
itself. The two figures beside it are measured: the running time of every row
added up, and the word count of the audio.

### The rows

| Column | What it is |
| --- | --- |
| **Row** | `segment.row` — 1.1, 1.2, 2.1 — read from the story order, never typed. Under it, that row's word count and its running time. |
| **Audio** | What is heard: voiceover, dialogue, a line of song. This is the beat's manuscript, and it is what the word count counts. |
| **Visual** | What is seen. The beat's own second text, and new (§6). |
| **Image** | One storyboard frame, or an empty plate to drop one on. |
| **Duration** | The row's running time, in seconds. The writer's, not a guess from the words (§4). |
| | The count of comments on the row, as the rest of the workspace shows them. |

### The segments

A segment is a scene. Its **name** is the scene's title, set above its rows
in capitals, with the scene's summary under it in italic — the line that says
what the segment is for.

Each segment closes with its own foot: `END OF SEGMENT 1`, its name again,
and four figures — the segment's running time and words, and the running
totals to that point. A commercial is sold in segments and cut in segments,
and the person reading it wants to know where each one lands.

## 3. The workspace, stripped

Short form is not a screenplay with a stopwatch on it, and the workspace
should not pretend otherwise. **The things a script needs and a commercial
does not are taken out** rather than left there greyed:

| Gone in short form | Why |
| --- | --- |
| `+ Scene`, `+ Beat`, `+ Lane` | The work happens on the sheet. A segment and a row are made there. |
| Plot lanes | A commercial has no subplot. There is nothing to lane. |
| Acts | There are no act breaks in a thirty. |
| Threads, and Links | Nobody tracks a character's arc across a spot. |
| The word **Scene** | It is a **Segment**, everywhere it is written. |

What is left is the sheet, and one timeline under a strip of frames.

## 3a. One timeline, with the board above it

**A single timeline**, the way an edit suite has one — a visual track over a
time track, and a playhead through both.

- **Above**: the storyboard. Each frame at the width of the time it holds,
  in order, so running your eye along it is looking at the cut.
- **Below**: the segments, named `SEGMENT 1 — Know your enemy`, each as wide
  as it runs. There are **no beats drawn in a segment**: what is drawn is the
  dialogue, stretched out along the time it takes, which is the thing being
  timed.
- **A playhead** through both, and playback (§5).

**One thing, seen twice.** Writing a row into the sheet puts it on the
timeline; there is no *add to timeline* anywhere, because there is nothing to
add — it is already there. Reordering rows on the sheet reorders the
timeline. They are the same story order the whole workspace already shares
(addendum 02 §8), which is why this costs nothing to be true.

## 3b. Writing a row

Type into **Audio** and you are writing what is heard — narration, plain.

- **Return** starts the next line.
- **Tab** makes the line a piece of **dialogue**, which the sheet sets in
  quotation marks: `"You're always late."` Narration and dialogue are
  different things in a commercial, and the quotation marks are how a board
  says which is which at a glance.
- Then across to **Visual**, and write what is seen.

## 3c. Frames, and what they do to the row

**The Visual column takes pictures.** Drop one on a row and it is that row's
frame. Drop another below it and **that is another row** — still in the same
segment, because a segment is not one shot.

That is the whole reason the columns are what they are: a row is as deep as
its tallest column, so the audio beside a frame **spaces out to line up with
it**. Add a frame for the opening, another for the action that follows, and
the dialogue distributes itself down the page against them. The alignment is
not a feature bolted on — it is what the layout is.

**Frames are kept in the file.** A project is one document that opens on
another machine, so the frames travel in it: an `assets` collection holding
each image once, referenced by id, so a frame used in two rows is stored once
and a row holds a reference rather than a picture.

## 4. Time

Short form is timed to the second and always has been. A thirty is thirty.

- **A row's duration is the writer's.** Typed in, in seconds. Nothing derives
  it, because the thing being timed is a shot, not a paragraph — a four-word
  line can hold the screen for six seconds.
- **A row with no duration reads as 00:00**, and the totals say so. An
  unfinished board should look unfinished.
- **The word count is a check on the time, not a source for it.** Roughly
  two-and-a-half words a second is the read; where a row's words cannot fit
  its duration the sheet says so quietly, in the row, and never changes
  anything (§7).
- Segment and total times are sums, and are always visible: at the head, at
  the foot of each segment, and against every row.

## 5. Playback

**Play the board.** From the sheet or the timeline: the frames advance at
their durations, and the audio is read aloud by the voices already assigned
(spec §10, read-back). It is an animatic, made of what is already in the
document.

- A voice is assigned per character exactly as it is now, and a row with no
  character reads in the narrator's voice — a commercial is mostly narration.
- The playhead is the timeline's own, so playing on one moves the other.
- Nothing is rendered to a file by this. It is a way of hearing whether a
  thirty is a thirty, which is the question the format exists to ask.

## 6. What a row is made of

Everything below already exists on a beat except where it says otherwise.

| | |
| --- | --- |
| Audio | The beat's `manuscript`, written the way beats are written |
| **Visual** | **New.** The beat's second text: plain lines, what is seen |
| **Image** | **New.** A reference to a frame in the project's own store |
| **Duration** | **New.** Seconds, an integer, zero until it is said |
| Its number | The story order, counted |
| Its words | The audio, counted |
| Comments | The workspace's own |

## 7. What it does not do

- **It does not time the script for you.** It counts words and says whether
  they fit, and stops there.
- **It does not draw.** Frames come from somewhere else — a drawing, a
  photograph, a still. The sheet holds them and lines them up.
- **It does not render video.** Playback is for hearing the shape.
- **It does not replace the beat window.** A row's audio opens in the same
  writing screen everything else does, with the same two keys.
- **It is not a second story order.** Anything that reordered rows without
  reordering the story would be a bug, not a feature.

## 8. Where the work is

1. **Built.** The sheet, read-only against the story that is there.
   Segments, rows, numbering, the word counts and the four figures at each
   foot, and the masthead read from the title page.
2. **Built.** Writing in it: audio and visual edited in place, rows added,
   removed and reordered, durations typed — the sheet as the place the work
   happens, in place of the Script.
3. **Built.** The workspace stripped (§3): no scene, beat or lane; no acts,
   threads or links; Scene becomes Segment wherever it is written; one
   track, with each segment's dialogue laid along its time; and Tab marks a
   line as spoken (§3b).
4. **Frames** (§3c): the asset store, dropping an image on a row, more than
   one down a segment, and the audio spacing out against them.
5. **One timeline** (§3a): the frames above, the segments and their dialogue
   below, and a playhead through both.
6. **Playback**, with the voices already assigned.
7. **Print and export**: the sheet as it is on screen, and a board.

Stage 1 alone is worth having: a writer who can see their commercial as an AV
sheet, with the times and the counts adding up, has the document the business
actually asks for.

## 9. What is built

### Stage 1 — the sheet

Open a short-form project and the section on the left is **Sheet** rather
than Script — the same place, a different document, in the workspace and in
its own window alike.

- The **masthead**: the title page's title and revision, with the running
  time and the word count of the whole board beside them. Nothing typed.
- A **segment** for each scene, its name in capitals and its summary in
  italic under it, and a **row** for each beat, numbered `segment.row` from
  the story order.
- Each row: its word count and running time under its number, the audio read
  from the manuscript, the visual from the beat, a plate where its frame will
  go, and its duration.
- Each segment closes with `END OF SEGMENT n` and the four figures — its own
  time and words, and the totals to that point.
- A row whose words will not fit its time says so, quietly, in the row, and
  changes nothing (§4). A row nobody has timed says nothing at all.
- Clicking a row's number opens its beat in the writing screen everything
  else opens in.

A beat gained two fields to make this possible — `visual` and `seconds` —
both empty by default, so every project that already exists opens with a
sheet that says nothing rather than a sheet that is wrong. Writing in it is
stage 2.

### Stage 2 — writing in it

Every column is typed in place, and each box is as tall as what is in it: a
row is as deep as its longest column, so a box with a scrollbar in it would
hide the very thing the two columns are for.

- **Audio and visual**, in the row. The audio column is plain lines, one line
  to an element, and a line already there keeps its id and its type — a
  speech written in the beat window and then tidied on the sheet is not
  turned into something else by the tidying. New lines arrive as dialogue,
  because in a commercial the audio column is what somebody says.
- **The time**, typed the way a writer types one: `4`, `04`, `0:04`, `00:04`
  and `1:02` all mean what they look like, and the box shows it back the way
  the sheet prints it. Anything that is not a time leaves the row with the
  one it had.
- **The segment's name and its line**, at the head where they are read.
- **Rows**: `+ Row` at the foot of a segment, and under the cursor each row
  carries ↑, ↓ and ×. A row moved off the end of its segment goes into the
  one above or below, which is what dragging a row past a segment head means.
- **`+ Segment`**, which arrives with a row in it to write on — an empty
  segment is not a thing anybody wants.

**A row added or moved here is added or moved on the timeline**, because
there is only one of it. Nothing is kept in step; there is nothing to keep.

### Stage 3 — the workspace stripped

Open a short-form project and the things a script needs and a commercial does
not are **gone**, not greyed:

- `+ Scene`, `+ Beat`, `+ Lane` and `+ Marker` leave the timeline's toolbar.
  A segment and a row are made on the sheet.
- The **Acts** and **Links** tracks go, in the timeline and in the Timeline &
  Viewer, and so do **Markers** and **Threads** above. Nobody tracks an arc
  across a thirty.
- **One track**, not a lane per plot. Its head says **Segments**, and it holds
  every segment there is — there is no subplot to lane.
- **Segment**, everywhere the word Scene was.
- A segment on the timeline is drawn as `SEGMENT 1 — Know your enemy`, and
  under it, **no beats**: the dialogue, each row at the width of its own
  duration, so the strip under a segment *is* the read. A row nobody has
  timed takes an even share until somebody says.
- On the sheet the heading is the same: the number, then the name beside it,
  typed where it is read.

**Tab marks a line as spoken.** In the audio column it puts the line you are
on in quotation marks — `"You're always late."` — and Tab again takes them
off, because the same key that made it dialogue is the key that changes its
mind. It does not move focus, for the same reason Tab does not in the beat
window. The visual column has no such key: nothing there is spoken.
