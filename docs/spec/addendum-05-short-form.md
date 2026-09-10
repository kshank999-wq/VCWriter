# Addendum 05 — Short form: the AV sheet, and the board

Status: complete — all eight stages built, September 2026. Fills in what addendum 02
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
| **Shot** | `segment.shot` — 1.1, 1.2, 2.1 — read from the story order, never typed. Nothing under it: the time is on the other side of the image. |
| **Audio** | What is heard: voiceover, dialogue, a line of song. This is the beat's manuscript, and it is what the word count counts. |
| **Visual** | What is seen. The beat's own second text, and new (§6). |
| **Image** | One storyboard frame — a picture or a clip — or an empty plate to drop one on (§3c, §4b). |
| **Duration** | Four lines — **header**, **dialogue**, **tail** (§4), and **video** where the plate holds a clip (§4b). |
| **Words +/−** | Beside the dialogue line, what the line's words come to. |
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
| The **Timeline & Viewer** | Screen time from a page count, and threads. A commercial has neither (§3e). |
| The side column | There are two sections here, not four: the sheet, and the strip under it (§3e). |
| **Pages**, everywhere | A commercial is measured in seconds. The ruler says Time and the window says the running time. |
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

## 3d. Moving a shot, and closing one

**A shot is moved by dragging it.** Pick it up by its number and put it where
you want it; it takes the place of the shot you drop it on, and dropping it on
one in another segment moves it into that segment. A pair of ↑↓ arrows told
you nothing about where a shot would land, moved it one place at a time, and
sat where the eye reads a shot's times — so they are gone.

**Closing a shot is one control, in a box, above the line**, at the top of the
row where it cannot be mistaken for part of the timings. It is the one control
here that loses work, and a board is written next to it all day, so **it asks
first**: *Close shot 1.3?* — Close it, or Keep it.

## 3e. The workspace a board is written in

Short form is written **on the sheet**, so the sheet gets the room:

- **The sheet is the stage**, full size, in the middle of the window.
- **The timeline is docked under it** — the board strip and the segments —
  and it can be dragged smaller, or taken out to a window of its own and put
  on another monitor, like any other section (addendum 02 §8).
- **There is nothing above the sheet and nothing beside it but the
  inspector.** The Timeline & Viewer is a screenplay's screen — screen time
  from a page count, threads, markers — and a commercial has none of that.
  The side column goes with it.
- The strip under the sheet is called **Timeline**, not Plot lanes. There is
  no subplot to lane.
- The window's own count says **the running time and the shots**, not pages
  and beats. A commercial has no pages anywhere in it.

## 4. Time

Short form is timed to the second and always has been. A thirty is thirty.

**A shot is rarely only its line.** Something happens, then somebody speaks,
then something happens — so a shot's duration is three figures, one under
another, and the shot is the three of them added up:

| | |
| --- | --- |
| **Header** | The action before the line begins. The writer's. |
| **Dialogue** | How long the line takes. |
| **Tail** | The action after the line ends. The writer's. |

**The dialogue's time is the one figure in the sheet that is estimated.** How
long a read takes really is what the words determine — roughly two and a half
words a second — and asking a writer to time every line by hand when the
answer is arithmetic is asking for nothing. It is drawn as the estimate it is,
and typing over it makes it theirs; clearing the box hands it back to the
words. Beside it, in **Words +/−**, is what the line's words actually come to.

The header and the tail are never estimated. Nothing can know how long a man
takes to cross a room.

- **A shot with no times reads as its words and nothing else**, which is an
  honest thing for an unfinished board to say.
- Where a writer's own dialogue time is shorter than the words need, the sheet
  says so quietly, in the shot, and changes nothing (§7).
- Segment and total times are sums, and are always visible: at the head, and
  at the foot of each segment.

## 4a. The slot

**A thirty is thirty.** A commercial is not sold by the page, it is bought
against a length — and a board that runs to thirty-four is not long, it is
unsellable. So the sheet carries the number it has to hit, in the masthead
directly under the title where the total is read:

    COMMERCIAL 1
    Time constraint  [ 00:30 ]     Total RT 00:29 • Total Words: 48

- **It is typed once, the way any time on the sheet is typed** — `30`, `0:30`,
  `00:30` — and it belongs to the project, not to the view.
- Empty, or zero, means nobody has set one, which is the honest state of a
  piece nobody has sold yet. The sheet then says nothing about length.
- **Over it, the total turns red**, and beside the constraint the sheet says
  by how much: `Over by 00:04`. That is the whole of the warning.

**Nothing is refused.** The constraint is a hard number, not a hard stop: a
writer is allowed to be four seconds over at four in the afternoon, and the
sheet's job is to make sure they know it — the same as a shot whose words
will not fit its time (§7). A tool that would not let you write the long
version is a tool you would write the long version outside of.

## 4b. The clip, and what it does to a shot

**A plate holds a picture or a clip.** A board is drawn before it is shot and
cut after it is shot, and the same document should carry both — a frame that
is a drawing on Monday is a piece of footage on Friday, in the same shot, in
the same row.

A clip brings one thing a drawing does not: **its own length**. So the
Duration column has a fourth line under Tail:

| | Where its number comes from |
| --- | --- |
| **Header** | Typed |
| **Dialogue** | The words, until the writer types over it |
| **Tail** | Typed |
| **Video** | **The file.** Read on the way in, and never typed |

A shot with no clip still draws the line, and it says nothing — a dash, the
way an empty column always reads here.

**Sound and picture run at once.** Head, line and tail are the *sound*; the
clip is the *picture*; they do not queue up behind one another. So a shot is
over when both are done — **the longer of the two** — and where the picture
outlasts the sound the sheet says `holds` beside it, quietly, and changes
nothing else. Adding a nine-second clip to a four-second line makes a
nine-second shot, not a thirteen-second one.

- The clip travels in the document like a frame does, for the same reason.
- **It is not re-encoded.** A browser cannot, and a board that silently
  transcoded somebody's footage would be worse than one that did not. So a
  clip has a size it must stay under to travel, and one over it is refused
  with the reason rather than swallowed.
- A container the machine can hold but not measure comes in with no length,
  and the shot is timed by its head, line and tail like any other.

## 4c. Printing it, and the board

**Two documents come out of a short-form project**, and they go to different
people:

| | What it is | Who wants it |
| --- | --- | --- |
| **The sheet** | What is on screen: audio, visual, frame and duration, in rows, under the masthead, each segment closing on its own four figures | The client who signs it off, and the producer who budgets from it |
| **The board** | The frames, in order, three across, each captioned with its shot number, its time and its line | The wall |

Both open with the **title page the script has**, because it is the same piece
of work; Page setup turns it off for either.

**The browser paginates these, not the program.** A screenplay is
hand-paginated because it is fixed-pitch, a page holds exactly fifty-five
lines, and where `(MORE)` falls is part of the craft. A sheet is a table of
rows whose heights depend on pictures and on how much somebody wrote —
nothing about it is countable in advance, and pretending otherwise would give
a preview that disagreed with the print. So a **shot never breaks across two
sheets**, the column heads print again at the top of every page a segment runs
onto, and the layout engine does the rest.

**A clip prints as what it is**, not as a picture: a name and a length in a
plate. There is no frame to pull out of a video without decoding it, and a
board that printed a black rectangle where the footage goes would be lying
about what is there.

A shot with no picture still gets its panel on the board. **A board with a
hole in it should look like a board with a hole in it** — that is the point of
printing one before the work is done.

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
| **Image** | **New.** A reference to a frame — a picture or a clip — in the project's own store |
| **Duration** | **New.** Seconds, an integer, zero until it is said. A clip's own length comes with the clip (§4b) |
| Its number | The story order, counted |
| Its words | The audio, counted |
| Comments | The workspace's own |

## 7. What it does not do

- **It does not time the script for you.** It counts words and says whether
  they fit, and stops there.
- **It does not draw.** Frames come from somewhere else — a drawing, a
  photograph, a still. The sheet holds them and lines them up.
- **It does not render video.** Playback is for hearing the shape, and what
  prints is paper: a clip on a plate prints as its name and its length (§4c).
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
4. **Built.** Frames (§3c): the pictures the document carries, dropping one
   on a row, more than one down a segment, and the audio spacing out against
   them.
5. **Built.** A shot's three times (§4): header, dialogue and tail, the
   dialogue estimated from its words until the writer says otherwise.
6. **Built.** One timeline (§3a): the frames above, the segments and their
   dialogue below. The playhead through both comes with playback.
7. **Built.** Playback (§5), with the voices already assigned and one
   playhead through the sheet and the timeline.
8. **Built.** Print and export (§4c): the sheet as it is on screen, and a
   board.

Stage 1 alone was worth having: a writer who can see their commercial as an AV
sheet, with the times and the counts adding up, has the document the business
actually asks for. The rest built on it, and it is all built now.

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

### Stage 4 — the frames

**Drop a picture on a row's plate**, or click it and choose one. Add a frame
for the opening, another for the action that follows, and another below that:
they are rows of the same segment, and the audio and the visual beside each
one **space out to line up with it**. The alignment is not computed — a row is
as deep as its tallest column, and that is the whole reason the layout is what
it is.

- **The picture travels in the document.** A frame pointing at a folder on
  somebody's desktop is a frame that is gone the moment the file is sent, so
  it goes into the file itself, stored once and referenced by id — a frame
  used on two rows is one picture.
- **Scaled on the way in**: no longer than 960 on its longest side, encoded as
  JPEG. What a board needs is a legible frame, not the twelve megapixels a
  camera produced, and a file with forty of those in it is a file nobody can
  send. The original is not kept: the board is the deliverable, not the
  archive.
- **A frame replaced or removed takes its picture with it**, so a board
  reworked a dozen times does not carry every version of every frame.
- A row whose picture has somehow gone reads as a row with no frame rather
  than a hole.
- Under the cursor a filled plate carries a **×**, like the row's own handles.

A file that predates frames opens with none, rather than badly.

### Stage 5 — the shot, and its three times

**A row is a shot**, and the column says so. The word count and the running
time have come off the shot number: the duration is on the other side of the
image, where it belongs.

Under **Duration**, three lines — **header**, **dialogue**, **tail** — and
beside them, under **Words +/−**, what the line's words come to. The header
and the tail are typed. The dialogue's time is the words' own estimate,
italic and in gold to say so, until the writer types over it; clearing the box
hands it back.

**+ Segment** sits at the foot of every segment as well as at the end, because
a board is written a segment at a time and the next one starts from where the
last one ended.

### Stage 6 — the strip, the slot, and lining the two columns up

**The frames sit above the timeline**, in a track of their own called
`BOARD` — one plate to a shot, in story order, each as wide as the time it
holds, so running an eye along the strip is looking at the cut. A shot with
no picture keeps its place as an empty plate rather than closing the gap: a
board with a hole in it should look like a board with a hole in it.

Under it, a segment is now **as wide as its seconds**, not as wide as its
pages. A commercial has no pages, and drawing one against a page count drew
every segment the same width however long it ran.

**Duration and Words +/− line up.** Each of the three duration lines is the
height of the line beside it, so `6 words` sits on the dialogue's own row
rather than a little above it. They are one reading, and now they look like
one.

**The slot** (§4a) sits under the title: *Time constraint*, a box to type it
in, and — over it — the total in red with `Over by 00:04` beside the box.

**A new segment arrives with its name waiting.** `+ Segment` puts the cursor
in the new segment's title, because the thing a writer wants to do the moment
they add SEGMENT 3 is say what it is.

The title itself was never typed on the sheet and still is not: it is the
title page's, which is the one set when the project is started (§2).

### Stage 7 — playing it, the clip, and the shape of the window

**Play the board.** ▶ Play in the masthead runs the board's own clock: the
shot under the playhead is shown in a monitor under the title with its line
beside it, the shot lights up on the sheet, and a gold playhead runs across
the timeline through the board strip and the segments alike. The audio is read
aloud in the voices already assigned (spec §10) — a character in theirs, and
everything else in the narrator's, because a commercial is mostly narration.

**The clock is the sheet's, not the synthesiser's.** A voice reads a line in
however long it takes; the board holds the shot for as long as the writer
said, and a read that over-runs is cut off by the next shot. That is what
happens in an edit suite, and it is the one fact playback exists to reveal —
timing the board to the voice instead would hide it.

**A plate takes a clip** as readily as a drawing (§4b), and the Video line
under Tail reads its length off the file. Where the picture outlasts the
sound the shot runs to the picture, and the sheet says `holds`.

**A shot is dragged, not arrowed** (§3d), and closing one is a boxed × above
the line that asks first.

**The window is the board's** (§3e): the sheet full size in the middle, the
timeline docked under it, the Timeline & Viewer and the side column gone, the
strip called Timeline, the ruler saying Time, and the window's count saying
`00:21 · 3 shots · 26 words`.

Two things that were wrong are right: **the zoom works** — its floor scaled
with it, so every segment was swallowed by the minimum until the slider was
most of the way across — and **Preferences closes from a square in its top
right corner** rather than from a control adrift in the middle of the panel.
The section strips (SHEET, TIMELINE, INSPECTOR) were drawn in the muted
colour, which on a light scheme is a washed-out bronze at nine and a half
pixels; they are full text colour now.

### Stage 8 — the sheet on paper, and the board on a wall

**Preview** in a short-form project shows the document rather than script
pages, with **Sheet** and **Board** beside each other and Print and Export PDF
acting on whichever is being looked at. The File menu carries the board as its
own pair — *Print the board…* and *Export the board as PDF…* — because it is a
second document, not a second view of the first; only short form has them.

The preview is drawn from the same `avSheet` as the printed HTML, under the
same class names, so the two cannot drift apart. That is the pattern the
Script's preview already follows: **one source of arithmetic, two renderings
of it.**

Files are named for the piece and apart from each other — `Know Your Enemy
sheet.pdf`, `Know Your Enemy board.pdf`. The page count reported after an
export is read out of the PDF itself, since the browser decided it.

Two things came in beside it. The **Window menu names the sections for the
format in hand** — Sheet and Timeline in short form, Manuscript in a novel —
and offers no viewer where there is none. And **Window → Reset windows to
default** puts a workspace that has been shuffled about back the way it opens:
everything docked, in its default place, at its default size, focus mode off.
