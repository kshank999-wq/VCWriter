# Addendum 17 — The project home

Status: **built**, September 2026. Master spec **§4**, which until now
was the one section of the master spec that existed only as a data model.

## 0. The gap, and how it was found

A survey of the master spec against the code turned up one section that was
**entirely unreachable**. `projectSchema` has carried `logline`,
`elevatorPitch`, `synopsis`, `genre`, `notes`, `status` and `posterAssetId`
since the beginning; `sync-mapping.ts` round-trips all seven to the database.
Grepping the whole of `apps/desktop/src/renderer` and `apps/web/src` for any of
them returned **nothing**.

So a writer could not type a logline anywhere in the application, and the column
was there waiting. §4's other four bullets — the poster, the one-sheet, the
dashboard and the email action — had nothing at all.

This is the opposite failure from the one the module audits usually find. There
the spec asked for a mechanism that already existed under another name; here the
mechanism existed under its *own* name and nobody had built the way in.

## 1. Most of the dashboard was already a reading

The same audit, run on §4's dashboard bullet — *writing progress, unresolved
research/setup items, the current scene/chapter, recent work and project
assets*:

| §4 asks for | What already answers it |
| --- | --- |
| writing progress | `projectStats` (`selectors.ts`) — units, beats, written beats, words |
| unresolved research | `unusedResearch`, already counted by `projectStats` |
| unresolved setups | `unresolvedSetupsPayoffs`, likewise |
| recent work | `writingReport` and `daysOfWriting` (`sessions.ts`) |
| project assets | `file.assets`, and `graphicsInOrder` for a book |
| the current scene/chapter | **new**, and the only one that needed thought |

So the dashboard is **an arrangement of readings that already existed**, plus
one. `projectHome` composes them and adds nothing to the document.

## 2. Where you are is read from the work, not from the window

The one genuinely new reading, and the decision worth keeping.

*The current scene/chapter* is tempting to store: the workspace knows which beat
is selected, and writing it down would be one line. It is the wrong line. A
selection is a fact about **a window**, and this project opens the same document
in several windows at once (addendum 02 §8) — so a stored "current" would be
whichever pane was clicked last, and would differ between two monitors showing
the same book.

`whereYouAre` instead reads the **most recently updated beat** and names the
unit above it. **Ties are broken by story order, latest first** — and the tie is
real rather than theoretical: a writer who lays out six chapters in one sitting
stamps them all in the same millisecond, and the first draft of this walked the
document's own array order, so it answered with whichever beat happened to be
first in memory. That is not an answer. The last one in the story is: they had
just added it. That is a fact about the work: it is where the writing last
happened, it is the same answer in every window, it survives closing the
application, and it needs nothing recorded. A document nobody has written in
yet honestly has no answer, and says so rather than pointing at the first scene.

## 3. The one-sheet is assembled, never stored

`oneSheet` takes the project's own fields and returns what would print. There is
no one-sheet table, no saved copy and no *regenerate* command, for the reason
the book index has no page column (addendum 10 §3): a stored copy is a second
answer that goes stale the moment somebody edits the logline.

It **says what is missing rather than hiding it**. A one-sheet with no synopsis
is a one-sheet the writer has not finished, and `oneSheetGaps` names the empty
fields — because a sheet that silently omitted the synopsis would print as
though the writer meant it that way, and they would find out after sending it.

Nothing about it is a judgement: *there is no logline* is a fact about the
document. Whether that matters is the writer's business, and the sheet prints
either way.

## 4. Status is the writer's, and nothing reads it

`status` — development, drafting, revising, complete, archived — is **set by the
writer and consulted by no logic anywhere**. It is deliberately not a state
machine: nothing refuses an edit because a project is *complete*, nothing
archives a project that has not been touched, and there is no rule about which
status may follow which.

The temptation is to make it mean something, and the reason not to is that every
such rule is a guess about how somebody works. A writer who marks a finished
screenplay *drafting* because they are about to open it again is not making a
mistake the software should correct.

## 5. Where the code is

| | |
| --- | --- |
| The readings and the sheet | `packages/domain/src/project-home.ts` |
| The fields on the project | `packages/domain/src/entities/project.ts` (unchanged) |
| The screen | `apps/desktop/src/renderer/components/ProjectHomePanel.tsx` |
| The printed sheet | `packages/domain/src/print-one-sheet.ts` |
| Sending it | `apps/web/src/app/api/one-sheet/route.ts`, `oneSheetEmail` |
| The page itself | `Home` in `PageBar.tsx` |

## 6. What is deliberately not here

- **A stored "current scene".** §2.
- **A stored or cached one-sheet.** §3.
- **Any rule that reads `status`.** §4.
- **A migration.** Every field this module writes has existed since 0001, and
  the poster is an asset in the document like every other.

## 7. Build order

1. **The domain** — the readings, the sheet, and the mutations. *Built.*
2. **The home screen** — the fields, the poster, and the dashboard. *Built.*
   It is the **first** page on the bar and deliberately **not** the one the
   application opens on: a writer opening a file wants the writing, not a
   dashboard about it. The figures are **stated rather than scored** — *3 of 7
   written* is a fact, while *43% complete* with a bar creeping toward a goal is
   the software having an opinion about somebody's morning. The one chart, a
   fortnight of sittings, is measured against the busiest of those days rather
   than against a target, and **a day spent cutting is drawn as a day's work**
   in red rather than as a gap.
3. **The one-sheet printed, and the email action** (§4's last bullet). *Built.*
   Print and Save as PDF go through the same `PrintKind` path as every other
   document; **Email it…** goes to `/api/one-sheet`.

### 3a. The request carries fields, never markup

The obvious design for the email action is to post the sheet the client already
has on screen. It would turn vc-writer.com into a machine for sending whatever
HTML anybody posts to it, over its own domain and its own sending reputation.

So the payload is **the eight plain strings a one-sheet is made of**, and the
server builds and escapes the markup itself through the domain's own
`renderOneSheetBody`. There is no field in the request that can hold a tag, and
a test posts `sheetHtml` alongside the fields and watches it not arrive. The
same shape-is-the-permission move the learning aid makes, pointed at a different
risk: there it was a model with nowhere to put replacement prose, here it is a
client with nowhere to put a page.

**Signed in is the whole of the gate** — sending your own one-sheet is not a
licensed feature — but anonymous is refused, because an unauthenticated send
endpoint is a spam relay. Its rate limit is tighter than the AI ones and for the
opposite reason: those are spending limits, this is a noise limit, and nobody
sends their own one-sheet to twenty people in an hour.

**The key art does not travel.** A poster is a few hundred kilobytes of data URI
— most of a message-size limit spent on something half the clients refuse to
show — so `renderOneSheetBody` takes a `withArt` flag, the route passes `false`,
and the screen says so before anybody presses send. The PDF still has it.

A send failure is **reported**, unlike a room notice that can fail quietly
because the work it accompanies is already saved. This has no other half: the
writer pressed send, and either it went or it did not.
