# Addendum 34 — Where new projects go

From Ken:

> When creating your project, there needs to be on that page the ability to set
> that file location and it'll save it in a file or a cloud drive and remember
> where it is. So when you open VC Writer, that it'll be able to find that
> location.

---

## 1. The audit

Paid a **twenty-ninth** time, and the half it found is the half that makes the
report worth reading properly: **the question was always asked.** Creating a
project has opened a save dialog since the application was written, defaulting
to `Documents/VC Writer`, writing where the writer said and putting the file on
the recent list.

| What he asks for | What was already there |
| --- | --- |
| *save it in a file* | `project:create` → `showSaveDialog` → `saveProject` |
| *remember where it is* | `rememberRecent`, which the Welcome screen and the Projects screen both read |
| *find that location* when you open | The recents list, and `openProjectAtPath` |

So what is new is not a mechanism. It is **three things that were wrong about
where the question is asked**, and each is a separate fault:

1. **It is not on the page.** The dialog opens *after* Create is pressed, over
   a panel that never mentioned where anything goes. A writer filling that
   panel in cannot see the folder and cannot set it. That is §9's own shape in
   another room: the control exists, and not where they are standing.
2. **It was never remembered.** The default was `Documents/VC Writer` **every
   time**. Save into Dropbox once and the next project still opened at
   Documents, which is the clause of Ken's sentence with no implementation at
   all behind it.
3. **Open started nowhere.** `project:open` passed no `defaultPath`, so after
   ten projects into a cloud folder, *Open a project file…* still landed
   wherever the operating system last felt like. That is his last sentence
   word for word.

## 2. A cloud drive is a folder

iCloud Drive, Dropbox, OneDrive and Google Drive each appear on the machine as
an ordinary directory, so saving into one needs **no account, no API and no
second kind of location**. That is worth saying on the screen rather than
implying the program integrates with them: what a writer is owed here is the
truth about where their book is, and *Any folder will do, including one a cloud
drive keeps in step* is both the truth and the whole feature.

## 3. The folder is the machine's

Where files live is a fact about this computer, not about the document — a book
opened on a second machine must not drag the first machine's folders with it —
so it lives beside the recents in `userData` and never in a project file.
`defaultHome` is what the program used before anybody could choose, so a machine
that has never been asked behaves exactly as it did.

**It is remembered by being used.** Creating a project somewhere and saving one
somewhere both say where this writer keeps their work. *Opening* one does not:
a colleague's file read out of Downloads must not move where your own books are
written.

## 4. One question, asked once

The folder is set on the page, so **the save dialog on Create is gone**. Two
controls for one act are two answers, and the one being removed is the one that
appeared over a screen that had not mentioned it. The file is named from the
title, through `suggestedFileName` — which the create handler had been
duplicating with a private regular expression of its own.

**Nothing already in the folder is replaced**, which is the one rule about this
a writer would not forgive being wrong once: the file in that folder is
somebody's book. `freeName` is that rule, and the audit paid again inside it —
the browser's own library has numbered its keys this way since it was written,
so this is **one reading both hosts ask** rather than a second copy on the
desktop free to differ.

## 5. What the page shows

It stands **between the format and the button**, which is addendum 30 §2a read
properly rather than broken: nothing that is *not part of making the project*
may stand there, and where the project is written is part of making it.

Three states, and the third is the one that matters.

| | |
| --- | --- |
| A host with folders | The path in full, a **Change…** press, and the sentence |
| A host without | *This browser’s own storage*, the reason, and **no press** — absent rather than greyed, a button that can only refuse being one a writer never trusts again |
| A host that cannot answer | **No row at all** |

That last one is not defensive habit. Two existing test fixtures stub the
bridge without the new method, and the first draft **blanked the entire Welcome
screen** on them — an effect that throws takes the screen down (addendum 25
§4g), and this screen is somebody's only way into their work while the row is
the least of what is on it. A host that does not know where projects go is not
made to say something about it, and the two fixtures then pass by drawing
nothing, which is the honest outcome rather than an edited test.

## 6. The name that was taken

`ProjectHome` is addendum 17's project home page, and has been since it was
built — the **fifth** name this project has had to step around after
`origin`→`found`, `Standing`→`Situation`, `code`→`discount` and
`LAPSE_PROMISE`. It is `ProjectFolder` with a `path`, and the thing worth
keeping is that this is the first of the five **caught by the compiler**: a
clashing *type* is refused at the door, where addendum 32 §7's clashing *value*
re-exported through a star compiled cleanly, passed 2,666 tests and returned a
500 from one page.

## 7. Driven

At 1440 × 900, on the real screens of both hosts.

- **Desktop**: the row draws under Format at 630 × 101 with the folder in full
  at the reading colour, **Change…** at the right, and the sentence under it;
  pressing Change… and choosing
  `/Users/ken/Library/Mobile Documents/com~apple~CloudDocs/Scripts` — an iCloud
  Drive folder, which is the ask — puts that path on the row.
- **Preview**: *This browser’s own storage*, the reason, no press.
- Nothing runs past the panel in either: the row's right edge is 1035 inside a
  panel ending at 1056, and a long path **breaks rather than truncating**,
  because a shortened path is one you cannot search your own disk for
  (addendum 29 §1) and one that ran off the edge would be a control behind a
  scrollbar that paints nothing (addendum 19 §10).

Looking at it caught the one thing no test did: the path drew in `--muted` at
12px, inherited from the recents list, where **here the path is the value**
rather than an annotation beside a file name — it is the answer to the question
the row exists to ask. `.path` is now the general rule and the row reads it at
the body colour.

## 8. What is deliberately absent

**No cloud account, no sync service, no second kind of location.** §2 is the
whole of it: a cloud drive is a folder, and the day this program grows its own
idea of one is the day there are two answers to where a book is. The Writers
Room is the other thing, and it is not this — it is collaboration on a project,
not a place on a disk.

**The folder is not per project.** It is where *new* ones go; moving an
existing one is `File ▸ Save as…`, which addendum 29 built and which now opens
at this folder and remembers where it lands.
