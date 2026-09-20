# Addendum 22 — Short stories and collections

*A short-story project holds one story or many. A story is a marker over
its sections, so the Layout room sets a collection as it sets a novel — a
story to a chapter, the contents page listing them — and stories are
written in the workspace or added from documents, one story each.*

Status: built, 19 September 2026; §7 says what each stage does.

## 0. Where it came from

Ken, 19 September:

> In the short story module, I want the ability to create a collection of
> stories. So in the layout module, you can lay out a novel-length book full
> of short stories that allows you to divide them into chapters. So under
> short story, you can import multiple stories or write multiple stories in
> one collection. In this way, you have the ability to output from the
> layout panel. Also, I want to change the name, when you select and create
> the project, to short stories and collections.

## 1. The audit: what already exists

Nearly all of it, and the reason is one line in the noun table. A
short-story project's unit is already a **Section**, and its markers are
already the chapter-kind marker every prose format has — the one that sits
above units, carries a page of its own, drives the contents page and, since
addendum 20, opens a chapter in the Layout room. What a marker *covers* is
already a reading, `chapterSpan`, from its marker to the next.

So the whole of "a book full of short stories divided into chapters" was
standing: put a marker at the head of each story and the Layout room lays
the collection with each story opening on a recto, the contents page names
them, and the export is the book. What was missing was the **reading** — a
story as a thing the program knows about — and the two ways in: writing a
new story, and adding stories from documents. And one word was wrong: a
short story's marker printed *Chapter I*, which no story has.

## 2. A story is a marker over its sections

`isCollection` in `formats.ts` is the short-story format, and `collection.ts`
reads its stories: a `Story` is a placed chapter-kind marker and the
sections from it to the next story's marker, with the words counted every
time. Nothing new is stored — no story table, no story id on a section —
because a story *is* the marker, and a second record kept in step with it
would be a second answer about where one story ends and the next begins.

Two consequences in the markers module. **A story is called nothing before
its number**: `markerNoun('chapter', 'short_story')` is empty, so a
numbered collection prints *3* at the head of a story and never *Story 3*,
which no book prints. And **a collection numbers nothing by default**:
`defaultMarkerNumbering('short_story')` is `none`, so a story's page carries
its title and only its title — the writer can turn numbering on, and then
it is a plain number. A marker with neither a noun nor a number now has an
empty label rather than borrowing its title for one, so the page does not
print the title twice; the timeline's chip joins the parts it has. The
project itself is a **Collection** in the noun table, whether it holds one
story or twenty, and the format is offered as *Short stories and
collections*.

**A document cannot say which it is.** Ken imported a short story and got
a story per heading: the builder made a chapter-kind marker of every
heading, which on a collection is a story each, and a story with three
parts became three stories. The import dialog now asks, on this format
alone, *what the document is*: **one story** (the default) — its headings
divide it into sections, the first heading names the story and is not
repeated, and every later heading stays in the words as a heading, so no
words are lost to the choice — or **a collection**, a story per chapter
heading, with the count said. `materialiseScenes` carries it as
`headings: 'sections'`, and `appendImportedStory` reads the same way now:
it used to drop a document's later headings on the floor.

## 3. Writing a story

The timeline's *+ Marker* is *+ Story* on a collection, and it does one
thing differently: it starts the story **on a section of its own at the
end**, rather than marking the selected section. A marker placed on the
selected section would divide the story before it, and a story is not a
division of its neighbour. `beginStory` adds the section and the marker
together and hands back both ids, so the new section is selected and
writing can start.

**The stories down the right.** A collection's stories are what a series'
episodes are — the divisions a writer moves between and adds to — so a
collection has the episode rail's shape with a story in each row
(`StoryRail.tsx`, *Window ▸ Stories*): its number where the collection
numbers, its name, its sections and words. One click goes to it; two open
**its own page**, the leaf the story opens on (the chapter page, opened on
that story), because a story in a collection has a page of its own the way
an episode has a title page. **+ New story** at the foot is `beginStory`,
as many as the writer wants. In the Layout room the stories are the rail's
chapters, each with its *Story page* row before it, and a story **drags**
there to move it in the collection as a block (`moveChapterBlock`, addendum
20 §9), its sections with it.

## 4. Adding stories from documents

*File ▸ Add stories to the collection…*, on a collection and absent
elsewhere (`AddStoriesDialog.tsx`). Several files at once, **one story
each**: a Word document read by its headings (addendum 21), or a plain-text
file read as paragraphs. `appendImportedStory` is the whole of the domain's
part — the read document's scenes become the story's sections, one marker
on the first carries its title, and the lot lands after the last section
already there. **A document's headings divide its story into sections and
never make stories**: the markers the project builder would have placed at
each heading are deliberately not made, because a story called *II* is the
reader's mistake waiting to happen. The title is the document's, or the
file's name where the document carried none. Nothing already in the
collection is touched, which is the same rule the room's merge keeps.

It shares its builder with the script importer: `materialiseScenes` in
`import-build.ts` is what both call to turn read scenes into units, beats,
pictures and markers, so the two cannot differ about what an element
becomes — a paragraph set in Garamond keeps its face whichever way it came
in.

A short story typed in Word divides at *I*, *II*, *III*, so `opensChapter`
now takes a **bare numeral set centred** as a section head, beside the
heading styles and *Chapter N* it already read.

## 4a. A series, or a collection, a file at a time

Ken, 20 September:

> This functionality could also work for importing episodic or series,
> where it asks you for one after the other, so you import one and then it
> leaves room for a title page for each … you will see a blank chapter
> page or title page between each of the stories, or episode page, in
> between each of the imports. It allows you to import in a series of
> imports … divided and in the order that you want. So if you just want to
> use VC Writer as a layout tool, importing existing manuscripts, you're
> able to organize it correctly. So people who are editors can also use
> this tool.

Two things, and both are §4 widened rather than anything new.

**Several files in one import.** *File ▸ Import a script…* takes several
files. The first makes the project, exactly as it did; on a **series** or a
**collection** each file after it is appended as the next episode or the
next story, on a page of its own, and the dialog lists them **in the order
they will go in** — the order chosen, or the order the arrows put them in,
with a × to leave one out. The first is what the dialog shows (who is in
it, where it happens), because the first is what the project is made from;
moving another file to the top changes what is shown. On any other format
a project is one document, and the rest are **said** to be left out —
*2 more files were chosen and will be left out: a novel is one document* —
rather than silently dropped, with the two formats that take several named
in the sentence.

**A series is added to the way a collection is.** *File ▸ Add episodes to
the series…* is the same dialog as *Add stories to the collection…*
(`AddStoriesDialog.tsx`, reading its words off the format): Final Draft
documents, Word documents by their indents, or PDFs, one episode each,
after the last, with the same ordered list. `appendImportedEpisode` in
`series-import.ts` is to a series what `appendImportedStory` is to a
collection — `materialiseScenes` underneath, so a scene comes in exactly
as the script importer would have brought it; whoever speaks and is not
yet in the cast joins it unfiled; and one **episode marker** on the first
scene, with a **title page that claims its number** (`Episode 2`), which is
where an episode is numbered (§17 of addendum 02) and is what keeps a
later renumbering from moving it. A series built from its first script
had scenes and no episode, so `ensureFirstEpisode` gives it one before the
second is appended — without it the second would have been *Episode 1*.

**The page between them is the marker's page.** An episode opens on its
title page and a story on its chapter page; both already existed, and both
are what the Layout room draws between the parts, so "a blank title page
between each" needed nothing drawn — it is the leaf every episode and
every story already has, empty until the writer fills it.

The file readers moved out of the two dialogs into `read-import.ts`
(`readProseFile`, `readScriptFile`), so *what is a .docx as a script* is
answered once; `shifted` there is the one list reorder both dialogs use.

## 5. Laying it out

Nothing in the Layout room changed. A story is a chapter opening, on a
recto where the book asks for one, with the leaf the writer designed for it
if it has one; the running head on a recto is the story's title; the
contents page lists the stories with the page each begins on; the export is
the book. That this needed no code is the point of §1.

## 6. What is deliberately not done

- **Sections within a story are not numbered by the program.** A story's
  sections divide it with a break, and a numeral head is the section's own
  title where the writer types one — *I*, *II* — which is how the Word
  reader brings them in.
- **A cast per story.** The cast is the project's; a collection with a
  character in two stories has one character.
- **Reordering stories as a unit.** A story moves as its sections move;
  the Outliner's *Move the chapter to match* (addendum 19) already moves a
  span as a block, and a story is a span.

## 7. What each stage built

- **Stage 1, the reading.** `isCollection`, the noun table's *Collection*,
  `markerNoun` taking the format, `defaultMarkerNumbering` giving a
  collection none, the empty label, and `collection.ts` — `storiesOf`,
  `unplacedSections`, `beginStory`, `appendImportedStory`,
  `describeCollection`.
- **Stage 2, the builder shared.** `materialiseScenes` extracted from
  `buildProjectFromImport`, with an *after* key and a switch for the
  *Chapter 3* sequence labels a story's sections do not carry.
- **Stage 3, the screen.** *Short stories and collections* on the
  new-project screen, the import dialog and the phone; *+ Story* on the
  timeline's bar and *Stories* over its row; the marker chip joining its
  parts; *File ▸ Add stories to the collection…* and the dialog behind it.
- **Stage 4, a file at a time (§4a).** Several files in one import, in
  the order listed; *Add episodes to the series…*; `appendImportedEpisode`,
  `markEpisodeAt` and `ensureFirstEpisode` in `series-import.ts`.
