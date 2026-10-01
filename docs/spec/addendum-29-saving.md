# Addendum 29 — Save as, and save a copy

From Ken:

> VC Writer needs the ability in every single module to be able to save as,
> where you can save it as a location. Save a copy should give you the ability
> to save a copy that gives a version in that location. And it should save the
> location of that file so it can re-find it.

---

## 1. The item that did neither

`File ▸ Save a copy…` has existed since the menus were built (addendum 02 §13).
It carried `Ctrl+Shift+S`, it was never greyed, it never errored — and its
handler read:

```ts
case 'file.saveAs':
  return void project.saveNow();
```

An ordinary save. To the same file. With no dialog and nothing copied. **The
act was its own label's opposite**: *save a copy* saved the original.

This is addendum 20 §16b in its plainest form — *a menu command is the most
durable route in the program and the least likely to be revisited* — and it is
worth recording that the failure mode here was **worse than an unbuilt
feature**, because an unbuilt one is absent and this one answered. A writer who
pressed it got a save, saw *Saved*, and had no way to discover there was no
copy until they went looking for a file that was never written.

## 2. The two acts differ in one thing, and it is not the file

Both ask for a place and write the whole document there. What differs is
**which file you are working in afterwards**:

- **Save as** moves you. You carry on in the new file; the old one stays where
  it is, holding the work as it stood at that moment.
- **Save a copy** leaves one behind. You carry on where you were, in a document
  nothing has changed.

That is why they are two menu items rather than one with a checkbox, and why
everything else is shared: one domain module, one IPC handler, one bridge
method, one `useProject.saveAs(kind)`. **The difference is one branch** — on a
save-as the result is adopted, on a copy it is not — so the two can never come
to mean different things by drifting apart.

The sentences `saveOffer` carries say the thing each act's fear is about. Save
as names **what happens to the file left behind**, because a writer who expects
a *move* and gets a copy has two files and believes they have one. Save a copy
names **what happens to the one in hand**, because the fear it answers is that
the copy becomes the thing being edited.

## 3. A copy says it is one

`copyTitle` appends *copy* to the copy's title, and it is the **only** thing
either act changes about the document — never the file the writer stays in.

The reason is Ken's own word for what this makes: a *version*. A version you
cannot tell from the original is not one. On the desktop the file name would
carry it, but the Projects screen, the recents list, the running heads, the
contents page and the eBook metadata all name the book by its **title**, so a
copy whose title was identical would be indistinguishable everywhere a writer
actually looks for it.

It does not stack: a copy of *Lamp copy* is *Lamp copy*, because the second
word says nothing the first did not.

## 4. The location is remembered because the act writes it down

Ken's third sentence — *it should save the location of that file so it can
re-find it* — needed **no new record**. Both acts call the same
`rememberRecent` that opening and creating a project already call, so a copy
turns up on `File ▸ Open`, in the recents and on the Projects screen beside
everything else.

What was missing was only that nothing was ever written, because nothing was
ever saved anywhere.

`describeSavedTo` then **names the place rather than only the act**: *Saved*
answers nothing about finding it again, which is the whole of what was asked
for. The path is said exactly as the host gave it — a shortened path is a path
you cannot search your own disk for.

## 5. What a place is, is the host's

`window.vcwriter` is deliberately identical in the desktop and the browser so
it may not be sniffed to guess the platform (addendum 09 §8). So neither half
asks where it is running: **the renderer asks the same question and the host
answers with where it landed**, and the screen says that back rather than
composing a sentence about a place it assumed.

- **Desktop**: `showSaveDialog` — a folder and a file name, with the suggested
  name pre-filled.
- **Browser preview**: the preview's own library, keyed by `pathFor`, which has
  refused to collide since it was written.

**The preview half is not a nicety.** The temptation was to say a browser has
no folders and leave the two items dead there — which is addendum 09 §15's
`ok([])` exactly, a feature that is there, tested and working and reads as
unbuilt from the one chair it is looked at from. The `browser://` the path
carries is **said rather than hidden**: it is the one thing somebody needs to
know about a copy made here, that it is in this browser and not on their disk.

## 6. What is written is the document in hand

`printing.ts`'s rule (addendum 02 §8) arriving at the disk. The writer presses
this having just typed something, and a copy that silently predated their last
sentence is the one failure this feature exists to prevent — so the host is
handed the live document and the pending autosave is left alone, there being
nothing to wait for.

Driven in the real browser: a beat renamed through the Inspector and a copy
saved a second later, before any autosave interval could run. The copy holds
*Renamed a moment ago*; the original on disk still holds *Opening beat*. Both
halves of the claim, in one measurement.

## 7. Every single module

A popped-out room (addendum 02 §8) has **no menu bar at all**, so it had no
route to any of this — and §8's rule is that a room on the other monitor must
not be able to do less than the panel it came out of.

**A room does not write the file.** It holds the document and owns no path, so
a room that wrote one would leave the two windows disagreeing about where the
project is — and a save-as done that way would move the workspace's file
without the workspace knowing. So the room **asks** and the workspace acts:
a `command` message on the link carrying a **name and never a document**, so
this can never become a second way to change the writing, and an unrecognised
one does nothing at all.

The new path then reaches every room for free: the link's `doc` message has
carried `path` since it was built, so nothing had to be added for a room to end
up pointing at the right file.

**The keys rather than a bar.** This is addendum 02 §6c's own answer for undo —
these are the program's acts and not a focused field's — and a room that exists
to be pushed onto a second monitor should be the section and almost nothing
else, where a *Save as* button in every room's chrome is the workspace's
business arriving in seven places. So the shortcut the File menu documents
works in a room too, and nothing is said there afterwards, the banner being the
workspace's: a room cannot know whether the dialog was dismissed.

## 8. The accelerators

`Ctrl/Cmd+Shift+S` is the save-as, which is where every other program puts it.
The copy takes `Ctrl/Cmd+Alt+S`: it is the rarer act, and the one whose
accelerator being pressed by accident should not change where somebody is
writing.

## 9. Driven

Measured in Chromium against the real preview build, which is the one Ken uses.

- The File menu reads `Save as… Ctrl+Shift+S` and `Save a copy… Ctrl+Alt+S`.
- *Save a copy…* leaves `browser://The Lamp copy.vcw` beside
  `browser://The Lamp.vcw`, the banner says where it went and that the writer
  has not moved, and the title bar still names the original.
- *Save as…* answers *You are writing in … from now on* and the project's path
  changes.
- The copy carries work typed a second before and never flushed (§6).

One thing caught by looking: a dismissed dialog is **not** a failure and must
not paint one — the writer changed their mind, and a banner reading *could not
save* would read as a fault in the program.

## 2. The rooms, measured — and the keys were not enough

From Ken, sending §1's ask back **word for word** the day it shipped.

In this project that has meant one thing six times (addendum 20 §15c, §16b,
§16c, addendum 25 §4d, §4f): **everything asked for is there and none of it is
reachable from where he is standing.** So it was measured before anything was
written, in the real preview, in all five rooms:

| Room | File menu | Covered by | Ctrl+Shift+S |
| --- | --- | --- | --- |
| Research | in the DOM | its search box | fired |
| Layout | in the DOM | `sculptor-bar` | fired |
| Note Sorter | in the DOM | its tabs | fired |
| Sculptor | in the DOM | `sculptor-bar` | fired |
| Outliner | in the DOM | its tools | fired |

**A room covers the menu bar.** The File button is present and painted over by
the room's own chrome in every one, so from inside any room the only way to
save as was a shortcut with nothing on screen to suggest it existed.

§1 argued the keys were enough — *the program's acts and not a focused field's*
— which is addendum 02 §6c's reason for undo, and it is **right about where the
act belongs and wrong about whether anybody can find it**. Undo's keys are the
two every writer on earth already knows. Nothing about a room says a save-as is
waiting behind one.

The sharper lesson is about the asking. §1 ended by putting the question to
Ken — *if you'd rather have a visible button in each room, say so* — and he
answered by re-sending the whole ask. **A question about whether the feature is
finished is not the writer's to answer**: he said what he wanted the first time
(*in every single module*), and offering a choice between a built thing and a
discoverable one is offering to leave it unfinished.

### What was built

`RoomSave.tsx` — **one component in five bars**, beside each room's `PopOutButton`.
A `Save ▾` button that opens the program's own `ContextMenu`, with the two
items read from `saveOffer`, so a room says exactly what the File menu says.

Three things it does not do, each for a rule already written:

- **It does not build its own menu** (`printing.ts`'s reason): a room with its
  own popover would be a second answer to what these acts are.
- **It does not write the file** (§7): the workspace does, and in a popped-out
  room the ask is relayed.
- **It is absent where a host hands nothing down** — `onPopOut`'s own idiom,
  rather than a control that could only refuse.

### Driven

Rebuilt and measured again in all five rooms: the control is there, the menu
carries both sentences, and *Save a copy…* really writes a second project from
each one. `room-save-surfaces.test.tsx` pins it — **the test §1 did not have,
and its absence is the whole story**: §1's tests proved the acts and not one of
them asked whether a writer could reach them. A sixth room added without a
Save control fails there now rather than shipping.

### Named rather than fixed

A room covers the **whole** menu bar, so Editor, Reports, Window and Help are
unreachable from one too. Only the ask in hand is built here; that is a
separate decision about what a room is, and worth making deliberately.

## 10. Deliberately not built, and named

- **No *Save a copy* of a single room's view.** What is saved is the project;
  a room is a window onto it.
- **No choosing the copy's name in the preview.** A browser has one place
  rather than many, so there is nothing to ask; the title is what names it in
  the library, and the writer renames it on the Home page.
- **No *revert to the copy*.** Snapshots are the recovery path (spec §6, §14)
  and a second one would be a second answer to *where do I get the old one
  back*.
