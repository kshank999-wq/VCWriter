# Addendum 07 — Writers Room

Status: specified; **stages 0–10 built**, September 2026. From Ken's *VC Writer Writers
Room Development Specification v1.0* of 11 September, and his elaboration of
the same day — **the showrunner's dashboard is the front door, everyone has a
login, and everyone submits.** Extends §12 (commerce), §14 (sync) and §15 (no
manuscript data loss) of the master specification, and is the module addendum
03 §14.4 stage 10 has been waiting on.

Writers Room is **the collaborative, subscription-based extension of VC
Writer**: shared cloud access, contribution tracking, review, comparison,
curation, and controlled assembly of a master script. The desktop application
stays the primary local writing environment. The Room is where a television
room, a writing team, a pair of co-writers, an editor or a showrunner meet
around the same story.

## 1. The decision that shapes everything

**One writer's work is never destroyed by another writer's edits.**

This is the source specification's §5 in one sentence, and it is the sentence
the whole module hangs off. It is not a quality of the merge algorithm; it is a
constraint on what the data model is allowed to be. A single shared file cannot
honour it — the moment two people write into one document, the only question
left is whose edit is lost. So:

- A project in the Room is **a line of versions**, not a file.
- A writer works on **a branch**, privately, and **submits** what they choose.
- A merge **makes a new version**. It never rewrites the contribution it drew
  from.
- Rejected, superseded and unused material **stays recoverable**. Nothing in
  the Room's vocabulary means *gone*.
- Removing a collaborator's seat removes their access, never their authorship.

Everything the source specification asks for downstream — version history,
snapshots, the curation tray, merge records, the audit trail — is an expression
of that one rule rather than a separate feature.

## 2. The second decision: a writer gets the whole program

Ken's words: *their individual packages are gonna act like an independent
software program*.

A collaborator in the Room is not given a web comment tool or a cut-down
editor. They are given **VC Writer** — the Script, the timeline, Research, the
Story Sculptor, the Outliner, the Story Grid, the reports, the print — running
in a browser, on a project that lives in the cloud instead of on their disk.
Two things are different from the desktop, and only two:

1. where the project lives, and
2. there is a **Submit** button.

This is affordable because it is almost already true, and §3.1 says why.

## 3. What already exists, and what the Room is allowed to assume

This module is unusual among the addenda: most of its foundations are already
in the product, built for one writer. Naming them decides how much of it is new
work and how much is widening.

| What the Room needs | What exists today | Where |
| --- | --- | --- |
| A web application on the account | The site, auth, admin console | `apps/web` |
| A browser build of the editor | `/preview`, the renderer built for a browser | `apps/web/public/preview`, `preview-gate.ts` |
| The editor on something other than a local file | The browser bridge: the preload interface over IndexedDB | `apps/desktop/src/renderer/browser-bridge.ts` |
| Several scripts open side by side | The pane API: a real window on the desktop, a browser window in the preview, joined by a document link | `preload/index.ts` (`PaneApi`, `LinkApi`), `renderer/link.ts` |
| Project data in the cloud | Eleven synced collections, round-tripping | `packages/domain/src/sync-mapping.ts` |
| A merge | Per-record merge with the loser preserved | `packages/domain/src/sync-merge.ts` |
| Access control on every project table | One security-definer function, `owns_project` | `0001_core_story_schema.sql` |
| A landing screen before the editor | The Welcome screen: recent projects, then open one | `renderer/components/Welcome.tsx` |
| Purchases, receipts, entitlement | Stripe orders, licences, activations | `0002_commerce_and_releases.sql` |
| Transactional email | Resend, with delivery events recorded | `email.ts`, `email_events` |
| Admin gate | `profiles.is_admin`, `public.is_admin()` | `0008_admin_release_management.sql` |

Four of these deserve a decision rather than a row in a table.

### 3.1 The Room is the preview, grown up

The source specification's §1 says the Room "evolves the existing browser-based
VC Writer testing environment". That environment is real and it works: the
desktop renderer is built for the browser and served at `/preview`, behind the
admin gate, and it is the same code the desktop runs. It is not a mock.

**So the Room does not get a second editor written again for the web.** It gets
the one editor, with a third bridge behind it. The renderer talks to
`window.vcwriter`; the desktop implements that against Electron and the file
system, the preview implements it against IndexedDB, and the Room implements it
against the cloud. Nothing in `src/renderer` needs to know which it is — that
is the whole point of the interface, and it has already been proved twice.

This is what makes §2 affordable. *An independent software program* is not a
thing to be built for the Room; it is the thing that already exists, reached
over a different bridge.

What changes at `/preview` is the gate. Today it admits administrators only;
under the Room it admits a member of a room, at a URL that names the room and
the branch. The admin-only path stays, because the preview is still where the
interface under development is looked at.

### 3.2 Membership widens one function; it does not add a second set of rules

Every child table in the project schema — lanes, units, beats, markers,
research, characters, links, setups — carries the same generated policy:

```sql
create policy … for all using (public.owns_project(project_id))
                      with check (public.owns_project(project_id));
```

One function decides who may touch a project's rows, everywhere. That is the
single seam the Room enters through: **widen the question from "do you own this
project" to "may you read it" and "may you write to it"**, with membership and
role answering. Every existing table becomes room-aware at once, and there is
no second set of per-table policies to keep in step with the first — the same
argument addendum 06 §5 made for using the existing relationship system rather
than a new one.

Read and write must split, because the roles differ in exactly that way: a
Viewer reads approved material, an Editor comments without writing, a Writer
writes to their own branch and not to anyone else's.

The source specification's §12 is emphatic and correct: **server-side
authorisation on every object; hiding it in the interface is not access
control.** The policy function is where that lives.

### 3.3 The sync merge is not the Room's merge

`sync-merge.ts` resolves a conflict by taking the newer record and keeping the
loser whole so the writer can be told and can put it back. That is right for
**one person on two machines**, which is what it was built for: there is one
author, and the question is only which of their two edits is later.

It is wrong for a room, and not because it is badly made. It **decides**, and a
room must not decide. Two writers with different versions of a scene do not
have a conflict to be resolved by timestamp; they have two drafts, and choosing
between them is the showrunner's job and the reason the module exists.

So the Room's model is branches and explicit submission, and `sync-merge.ts`
stays exactly what it is: the desktop-to-cloud path for a single writer's own
project. The two never meet. What the Room reuses from that file is its
conscience — the losing side is always kept — not its algorithm.

### 3.4 Several writers' scripts, side by side, is the windowing that exists

Ken asks to *open multiple script windows at a time from different writers*.
The mechanism is built: a section of the workspace already goes out to a window
of its own — a real window on the desktop, a browser window in the preview —
and the windows stay in step over a document link that does not care which it
is (`renderer/link.ts`).

What the Room changes is **what gets opened**. Today the thing in a window is a
*section* of one project; in the Room it is a *version* — this writer's Script,
that writer's Script, the master — and each window wears its writer's colour
and name. Three windows showing the same scene are indistinguishable without
that, which is the whole reason §6's stamp is not decoration.

## 4. The plans in the cloud — **built**

**Boards and outlines did not sync.** `SYNC_TABLES` named eleven collections,
and neither the Story Sculptor's boards (addendum 03) nor the Outliner's
outlines (addendum 06) was among them: they lived in the project file and
nowhere else. A Room built on that would carry a script and no plan, and
addendum 03 §14.4 stage 10 — Writers Room attribution and alternate boards —
cannot be built on a board the cloud has never seen.

So this was stage 0, and it is done. Migration `0023_boards_and_outlines.sql`
adds five tables, and `sync-mapping.ts` gains the five collections that fill
them.

### 4.1 Five collections, not two

A node is what two writers edit independently, so a node is a **row** and a
merge compares one at a time. The five are `boards`, `sculptor_nodes`,
`sculptor_links`, `outlines`, `outline_items`.

A board's **columns** stay one `jsonb` column on the board rather than becoming
tables. A column is the board's *shape* rather than its content: it is always
read and written whole with the board, nothing queries inside it, and — unlike
a node — it carries no timestamps, so there is nothing for a per-record merge
to compare anyway.

### 4.2 The document nests them and the database does not

This is the one real decision in the stage, and the answer is not to change the
document. A board *is* its nodes to the module that draws it, which is why
addendum 03 built it that way and why every reader in the Sculptor and the
Outliner reads it that way.

So the flattening lives in `sync-mapping.ts`, which is already "the only place
the two spellings meet" — the third spelling joins the other two there.
`planParts` takes the plans apart into five flat lists; `withPlanParts` puts
them back. Two consumers ask through one door — `recordsOf` and `withRecords` —
so neither the merge nor the restore has to know which collections the document
nests.

Flattening loses exactly one fact that nesting was carrying for free: **the
board a link belongs to**. It travels in the flat form the same way
`project_id` travels in a row — the document gets it from where the thing sits,
and anything flat has to be told.

### 4.3 What the journey drops

Putting the plans back drops what cannot be drawn, the way `pruneOrphans`
already drops a beat whose scene has gone: a node whose board did not survive,
and a **link whose two ends did not both survive**. The board's own rule makes
the second one easy — a link is an observation rather than what holds anything
together (addendum 03 §7), so losing one costs the observation and nothing
moves.

### 4.4 One thing this fixed on the way past

`pushRows` deleted the server's stale rows by reading the remote **project
file** with a collection's name. That worked only because every collection so
far happened to be a key on `ProjectFile` — `sculptorNodes` is not, and asking
for one would have found nothing to delete and quietly brought deleted nodes
back on the next pull. It reads through `toRows(remote)` now, which is the same
encoding as what is going out and is right for every collection rather than for
eleven of them.

## 5. Where you land

**Signing in does not open the software. It opens the room.**

This is Ken's structure and it is the right one: *when you sign in, before you
go into the actual software, there's a showrunner dashboard*. The editor is
something you open **from** the room, the way the Welcome screen already stands
in front of the desktop application and hands you a project.

So there is one front door and it shows you your standing in the room:

- **A showrunner** lands on the room dashboard (§10): who is writing, what has
  been submitted, what is unread, what conflicts, what the master version is.
- **A writer** lands on their own: what they are assigned, what they have
  submitted and what became of it, and the button that opens their branch.
- **An editor or a viewer** lands on what they are allowed to see, which is
  approved material and the room views they were given.

It is the same page answering the same question — *what is my part in this* —
with a different answer per role, rather than four pages.

## 6. Identity: name, title, colour, initials

**The showrunner hands these out.** Ken's words: *that assigns names, titles to
a person with a color*. A seat is invited by email; the showrunner gives it a
display name, a **title**, and a **colour**, and the room proposes a colour
from a palette so that nobody has to think about it to get started.

**Role and title are different things and must not be one field.**

- **Role** is permission: Owner, Writer, Editor, Viewer (§7). The database
  reads it.
- **Title** is credit: *Staff Writer*, *Co-Producer*, *Executive Story Editor*.
  The room reads it. It appears beside a name on the dashboard and on a
  submission, and it changes nothing about what a person may do.

Conflating them is how a writer ends up given producer permissions because
somebody wanted the word on a page.

### 6.1 The page stamp

**Colour and initials in the top corner of every page of a writer's version.**
This is Ken's requirement almost word for word, and it is the single most
useful thing in the module, because §3.4 puts three writers' drafts of one
scene on the screen at once.

The geometry is already decided by the script and must not be argued with: the
**page number sits top right from page two**, because that is where scripts put
it. So the stamp goes **top left, on every page including the first** — the
initials in the contributor's colour, with the name spelled out on the first
page and in the identity bar above the document on screen.

### 6.2 Where colour is used, and where it is refused

Used in exactly four places:

- the **page stamp** (§6.1) and the identity bar above a writer's version;
- a small **initials badge** on every beat, saying who originated it;
- the **contribution overlay**, where the master script is tinted by source;
- the **boxes in the brainstorming room** (§11) — Ken: *the boxes are
  colorized*.

**Never on a lane.** Plot lanes already carry colour (addendum 02 §8), and two
colour languages on one page is neither. A lane is a thread of the story; a
contributor colour is a fact about who wrote a line. They must not be mistaken
for each other, so they never appear in the same role.

### 6.3 Origin is immutable, and the master is clean

Scenes, beats, notes, proposals and imported material keep their origin
metadata after being incorporated into a master draft — that is what makes §1's
promise auditable rather than merely intended.

But **the master script carries none of it**. Attribution is authoring
metadata, in exactly the sense the beat's internal title is (master spec §5.3,
§19): it belongs to the room and not to the script that leaves it. A printed
master carries no stamp, no badges and no tint, and that is what clean-reading
mode shows on screen.

A **writer's version** is the opposite case and the distinction matters: it is
a draft circulating inside the room, and it is *supposed* to say whose it is.
It carries the stamp on screen and on paper. The rule is therefore not "never
print attribution" but **the master is clean and a contribution is signed**.

## 7. Roles and access

| Role | What it may do | Typical |
| --- | --- | --- |
| **Owner / Showrunner** | Everything: review all work, curate, publish the master draft, invite and remove seats, set names, titles and colours | Showrunner, lead writer |
| **Writer** | A private working branch, plus the contributions they explicitly submit; submit scenes, beats, research and ideas for review | Staff writer, co-writer |
| **Editor / Producer** | Comment, compare, review, and propose changes — never a destructive write | Producer, editor |
| **Viewer** | Read approved material and the room views they are given | Executive, stakeholder |

Two rules the table does not say:

- **A Writer's private branch is private.** Presence may show that someone is
  in a scene; it never shows the text they have not submitted. A room where
  everyone can read everyone's unfinished draft is a room where nobody drafts.
- **An Editor proposes.** *Propose* is a submission from someone who is not a
  Writer, and it lands in the same review queue. It is not a second mechanism.

## 8. Assignments

Ken: *if a specific person is assigned to a task, there needs to be a menu for
that to assign tasks*.

An **assignment** is a piece of the story given to a person, with a state. It
is made from the showrunner's dashboard or from the thing itself — a scene, a
beat, an act, a research question — through an **Assign** menu that lists the
room's seats by name, title and colour. An assignment carries an optional due
date and a note.

It appears in three places, and they are the same fact seen from three angles:

- on the **writer's landing page** (§5), as what they are being asked for;
- on the **scene or beat**, as a badge beside the originator's;
- on the **dashboard**, as the column that says who owes what.

**An assignment is not a lock.** It says who is expected to write something; it
does not stop anyone else writing it, because a room where two writers took a
run at the same scene is a room working properly, and §1 exists so that both
runs survive. Soft locks are a separate and deliberate act by the showrunner
(§9).

## 9. Versions, branches and history

- **Branch.** A writer's working line, taken from an approved version.
- **Version.** An immutable point on a branch: timestamp, author, source
  version, change summary.
- **Snapshot / milestone.** A version the writer named — *First Draft*, *Room
  Pass*, *Network Notes*, *Production Draft*.
- **Master version.** The approved room draft, made by a merge and never by
  someone typing into it.

Autosave goes to the writer's own branch. Restoring or duplicating an earlier
version **adds** a version; it never removes the ones after it. Conflict
detection reports when two changes target the same scene, beat or script range
— it reports, it does not resolve. Soft locks are available for sections the
showrunner is holding, and a private branch stays editable regardless, because
a lock that could stop a writer working is a lock that stops the room.

The audit trail records who created, submitted, accepted, rejected, moved or
modified collaborative material. It is the record §1 is enforced by.

## 10. Submitting

**One button, and what you are looking at decides where it goes.** This is the
whole of Ken's mechanism and it needs no more machinery than that: you submit
*from* somewhere, and the somewhere says what kind of thing it is.

| Submitted from | Arrives as | Lands in |
| --- | --- | --- |
| The Script, a scene, a beat | A script contribution | The review queue, and the Curation Tray (§12) |
| Research, the Sculptor, the Outliner, a character, an idea | A research contribution | The **brainstorming room** (§11) |

A submission carries its author, their colour, a timestamp, the version it came
from, and an optional note saying what it is. Its state runs *Draft → Submitted
→ In Review → Approved / Revision Requested / Rejected → Incorporated*, and no
state in that list deletes anything.

Submitting **copies nothing out of the writer's branch**. The contribution
references the version it was taken from, so the writer carries on working and
what the showrunner is reading does not move under them.

## 11. The brainstorming room

Ken: *when they wanna submit either research or the ideas, characterizations,
ideas for a story, that goes to the showrunner's brainstorming research area.
When everyone submits, then they consider it out and talk about it from the
showrunner's screen. And you can see whose ideas are what, because they're
colorized and the boxes are colorized.*

This is a second destination, not a second copy of the Curation Tray, and the
difference is real: the tray assembles a **script**, and this is where a room
argues about **what the story is** before there is a script to assemble.

- It is the project's Research, shared — the same categories, the same items —
  with a **Submitted** space where contributions arrive before anyone files
  them.
- **Every box wears its author's colour**, so a screenful of ideas says at a
  glance whose room this is and where the agreement is.
- The showrunner can file a submission into a real research category, hold it,
  ask for more, or leave it in the open where it is.
- Discussion happens on it: threaded comments, `@mentions`, and the room notes
  area for concepts that belong to nobody yet.
- Filing a submission does **not** consume it. It stays attributed, and it
  stays findable, because §1 is about ideas as much as pages.

One consequence falls out for free and is worth saying: the Research shelf
already lives *inside* the Sculptor and the Outliner (addendum 06 §3), so a
colourised shelf reaches both without either of them being taught anything.

## 12. Curation

The staging area between individual contributions and the master script, and
the reason the source specification gives for it is the right one: *without it,
reviewing competing ideas is copy-and-paste chaos*.

- Compare alternate scenes, beats, dialogue passages, character ideas, research
  items and structural proposals.
- Take a whole contribution **or a precise excerpt** into a **Curation Tray**.
- Drag curated material into the master scene and beat structure.
- Combine material from several writers **with each source's attribution
  intact** — a merged scene has more than one author and says so.
- **Accept, reject, hold, or request revision.** Rejected and unused material
  stays recoverable.
- **Preview the resulting master sequence before committing.**
- Committing creates a new master version with a **merge record** naming every
  source contribution.

## 13. The views

| View | What it is |
| --- | --- |
| **Master Script** | The current approved room version, clean (§6.3) |
| **Writer Version** | One writer's branch, stamped with their colour (§6.1) |
| **Several at once** | Two or more versions in windows of their own, side by side (§3.4) |
| **Contribution Overlay** | The master script tinted by source authorship |
| **Beat / Scene** | Badges, assignment, comments, status, origin history |
| **Diff** | Additions, deletions, moves and rewrites between any two versions |
| **Clean reading** | All collaboration metadata hidden — the same view the printer gets |

## 14. Communication, AI, and the rest

**Communication.** Threaded comments at project, scene, beat, paragraph and
research-item level. `@mentions` and assignments with a due date and a status
(§8). A room notes area for concepts not yet in the script. Notifications in
the Room, optionally by email — Resend already carries transactional mail and
records delivery outcomes.

**AI.** It uses the existing VC Writer AI service rather than a second stack
(`apps/web/src/app/api/ai`). Three rules, all from the source specification's
§10 and all consequences of §1:

- AI **respects room permissions** and **never automatically merges or rewrites
  another writer's work**. It may summarise differences, find duplicated ideas,
  summarise room notes, and help the showrunner compare submissions. Deciding
  is still a person's job.
- AI-generated material is **labelled AI-assisted** and attributed to the user
  who asked for it. It is a contribution like any other, with an origin.
- Room-level usage and cost controls are the owner's to set.

**Subscription and seats.** A Writers Room entitlement is **separate from the
desktop licence**: the base subscription includes the owner's seat and further
collaborators are billable seats. An invited-but-not-accepted seat is
distinguishable from an active one, because the two bill differently.
Deactivating a seat removes access and keeps every contribution that seat ever
made (§1). Stripe extends to recurring billing — `pricing.ts` already carries a
`recurring` flag on a displayed price, and `licenses` already treats
entitlement as data rather than a hard-coded rule — and Resend extends to
invitations, room notifications and access changes.

**Desktop integration.** An approved master version opens in the desktop
application. The desktop says whether a local project is **current, ahead,
behind or diverged** from the cloud master, in those words. Uploading desktop
work **creates a contribution**, never an overwrite of the master. The Sculptor,
the Outliner, Research, setups and payoffs, characters, arcs and scene and beat
metadata share object ids with the cloud, which is what makes attribution
survive the journey — and which is why §4 is a prerequisite and not a detail.

## 15. Build order

0. **Built.** Boards and outlines sync (§4). A prerequisite, in
   `packages/domain` and `packages/supabase` rather than in the Room. It also
   unblocks addendum 03 stage 10.
1. **Built.** Rooms, entitlement, invitations, roles, titles, colours and seat
   management — and `owns_project` split into a read question and a write one
   (§3.2, §19).
2. **Built.** The landing page (§5): sign in, see your part in the room, open
   the editor from it (§19).
3. **Built.** Cloud projects with branches, autosave, snapshots and immutable
   version history — the third bridge behind the renderer (§3.1, §19).
4. **Built.** Contributor colour end to end: the page stamp, the identity bar,
   beat badges, and the filters that use them (§6, §19).
5. **Built.** The showrunner dashboard, loading a version, and several of them
   open at once (§10, §3.4, §19).
6. **Built.** Submitting, and the review queue (§10, §19).
7. **Built.** The brainstorming room (§11, §19).
8. **Built.** Assignments and the Assign menu (§8, §19).
9. **Built.** The Curation Tray and the non-destructive master merge (§12, §19).
10. **Built.** Comments, notifications and activity history (§14, §9, §19).
11. Desktop synchronisation, and export/backup of a whole room.
12. AI comparison and summarisation, and the advanced collaboration features.

Stage 9 is the point of the module, the way promotion is the point of the
Outliner: everything before it is making it possible to see what the room
wrote, and that is where the room's work becomes the script.

## 16. What it must never do

- **Never let one writer's edit destroy another's** (§1). Everything else here
  is a way of keeping this.
- **Never resolve a disagreement by timestamp.** Two drafts are a decision, not
  a conflict (§3.3).
- **Never show a private branch's text** to anyone but its writer (§7).
- **Never let attribution reach the master script** — and never strip it from a
  contribution, which is supposed to be signed (§6.3).
- **Never make role and title one field** (§6).
- **Never let an assignment become a lock** (§8).
- **Never let removing a seat remove authorship** (§14).
- **Never rely on the interface for access control.** The policy function
  decides, on the server, every time (§3.2).
- **Never overwrite the cloud master with an upload** (§14).
- **Never require the Room.** The desktop application is a complete product for
  a writer who never signs in, and it stays one.

## 17. Acceptance

- Signing in lands on the room, not on the editor, and says what your part in
  it is.
- Two writers edit separate branches of one project at the same time without
  overwriting each other.
- Each writer's pages carry their initials in their colour, top left, on every
  page, on screen and on paper.
- Three versions of one scene can be open at once, in windows of their own, and
  told apart without reading a word of them.
- The showrunner assigns a scene to a writer, and it appears on that writer's
  landing page, on the scene, and on the dashboard.
- A writer submits a scene and a research idea, and the two arrive in different
  places — the review queue and the brainstorming room — both in that writer's
  colour.
- The showrunner compares alternatives, curates a selection, and commits a
  master version that is recoverable and preserves every source contribution.
- A printed master script carries no collaboration metadata at all.
- Removing a collaborator's active seat erases neither their historical
  authorship nor the room's record of it.
- A non-member is refused by the database, not by the page.

## 18. Names

| Name | What it is |
| --- | --- |
| **Room** | One collaborative workspace, attached to a project |
| **Seat** | One collaborator's place in a room, billable and revocable |
| **Role** | What a seat may do. The database reads it |
| **Title** | What a seat is called. The room reads it |
| **Stamp** | The initials and colour in the top corner of a writer's page |
| **Branch** | A writer's private working line |
| **Version** | An immutable point on a branch |
| **Snapshot** | A version the writer named |
| **Master version** | The approved room draft, made only by a merge |
| **Contribution** | Material a writer has submitted, script or research |
| **Assignment** | A piece of the story given to a person, with a state |
| **Brainstorming room** | Where research and ideas are submitted and argued about |
| **Curation Tray** | The staging area between contributions and the master |
| **Merge record** | What a master version was assembled from |
| **Overlay** | The master script tinted by who wrote what |

## 19. What is built

### Stage 0 — the plans in the cloud

§4 says what it is and why: boards and outlines now sync, nested in the
document and flat in the database, with `planParts`/`withPlanParts` the one
place that knows the difference.

### Stage 1 — rooms, seats, and the question split in two

**The one question became two.** Since 0001 every child table in the project
schema has carried the same policy — `owns_project(project_id)` — and §3.2 says
that is the seam the Room enters through. It is now `may_read_project` and
`may_write_project`: a live seat in the room reads, and the project's owner
writes. Seventeen tables changed at once and none of them needed a policy
written for it, which was the whole argument for entering there.

**Writing is owner-only for now, on purpose.** A Writer writes to a *branch*
(§9), and branches are stage 3. Until one exists, letting a Writer write to the
project's own rows would let one writer's edit land on top of another's — §1,
exactly. So `may_write_project` is written with the room in view and grants
nothing yet, and widening it is a one-place change when there is somewhere safe
for that writing to go.

**Two policies per table, not one**, and this is the part that had to be got
right. A single `for all using (read) with check (write)` reads plausibly and
is wrong: `with check` governs the rows a statement *produces*, so an UPDATE or
a DELETE is decided by `using` alone — and a Viewer would have been able to
delete the script they were invited to read. Reading and writing are separate
policies over separate commands.

**The invitation token is not on the seat.** Row-level security is row-level: a
policy letting the room see who else is in it would have shown a pending
invitation's token too, and a Viewer who took up a pending Writer invitation
would have promoted themselves. Tokens therefore live in `room_invitations`,
which has RLS on and **no policy at all** — the one arrangement nobody but the
server can read. Only a fingerprint is stored, because the room's database is
not where a working invitation link should be recoverable from.

**Role is permission and title is credit**, in two columns, as §6 requires. The
seat also carries the colour and the initials that become the stamp (§6.1) —
the room proposes a colour nobody is using so that nobody has to think about it
to start, and the showrunner can overrule it.

**Invited is not active**, in the state rather than in a comment, because they
bill differently (§14): an invitation nobody has answered is not a seat, and
charging for one would be charging for an email. A **deactivated** seat is
neither billed nor deleted — it is how a room stops paying for somebody who has
left without losing what they wrote, which is §1 applied to the invoice.

Two rules came out of writing it down. A room cannot lose its **last
showrunner**, because a room with nobody who can curate or invite is a room
nobody can reopen. And an address that was deactivated **can be asked back**,
because people leave rooms and return to them — so the constraint binds only
the seats still standing.

**Nothing on screen.** The landing page is stage 2; this is the model, the
schema and the data layer under it, plus the invitation email.

**Verified against a real Postgres**, not by reading the SQL. All twenty-four
migrations applied to a clean database, then four callers — the showrunner, a
Writer with a seat, a Viewer with a seat, and a stranger — were each put
through the same transaction. All three members read the project, its beats,
its board and who else is in the room; the stranger read nothing. Only the
showrunner could edit or delete a beat, delete the board, promote a seat or
delete the project. Nobody at all, the showrunner included, could read an
invitation.

### Stage 2 — the front door

**Signing in opens the room, not the software.** `/rooms` lists the rooms you
are in and each card already says what you are in it; `/rooms/<id>` is the
landing, and it is **one page answering one question** — *what is my part in
this* — with a different answer per role rather than four pages that would
drift apart.

What each role is shown is `landingFor` in the domain rather than a condition
in a component, so the decision is testable and the page draws what it is
given. A showrunner gets the seats, the invitation form and what the room
costs. A writer gets the room and their own standing in it. Everyone gets
**their stamp** — their initials in their colour, at the size it will appear in
the corner of a page (§6.1), because a colour described in a sentence is not a
colour anyone will recognise across a desk.

**The door is drawn and it does not lie.** A writer's control says *Open your
draft* and a showrunner's says *Open the room's script* — §1 stated as a door —
and both are disabled with a line saying the editor opens from here once the
room can hold a draft of its own. A button that pretended to work would be
worse than a button that says what it is waiting for.

**Invitations go out by email and the token is never returned to the browser.**
The route sends it and answers with the seat; the secret belongs in the message
and nowhere else. Taking it up needs a signed-in person, because a seat is what
a person holds and billing counts people — an unsigned visitor is sent to sign
in and brought straight back. Accepting spends the link.

**Nothing here can delete a seat**, which is §16 built rather than promised:
the row is what keeps a contribution's author, so the control says *take out of
the room* and deactivates.

Looking at it caught four things tests could not. The seat table ran off the
right of the page, so the two controls stack and the table scrolls inside its
own box rather than making the page scroll sideways. The stamp was rendering at
body size, because `.card p` is the more specific selector and won. The *you*
pill sat flush against the name. And the invitation row came out at three
different heights, because the site styles an email field and a select and
leaves a plain text input alone — the room's own fields are given one shape
rather than left to inherit three.

### The migrations, applied

`0023`, `0024` and `0025` are on the live project. Three things are worth
keeping, because two of them were mistakes the linter caught after the fact.

**The cloud was empty.** Nine accounts and not one project: nobody had ever
synced a story up, so the access change had no existing data to endanger. That
is worth saying because it will not be true a second time.

**A write policy was also a read policy.** 0024 gave every table
`<t>_member_read` for SELECT and `<t>_owner_write` `for all` — and `for all`
*includes* SELECT, so two permissive policies were being evaluated on every
read of every row. The linter counted 101. 0025 says what the write policy is
for: INSERT, UPDATE and DELETE. That narrows nothing, and the reason is the
shape of the two functions — `may_write_project` is true only for the owner and
`may_read_project` is true for the owner *and* every live seat, so the writer is
a subset of the reader and the read policy already covered every SELECT the
write policy was covering.

**Four foreign keys had no covering index**: `bound_unit_id` and
`bound_beat_id` on `sculptor_nodes` and `outline_items` — the columns saying
which scene or beat a node or a row *is*. They are `on delete set null`, so
deleting one scene made Postgres scan both tables to find what pointed at it.
Migration 0011 made exactly this correction for the tables that existed then;
0023 should have carried it and did not.

**Proved on the live database, twice** — once after 0024 and again after 0025,
to show the split narrowed nothing. Four callers (the showrunner, a Writer with
a seat, a Viewer with a seat, and a stranger) went through the same transaction:
all three members read the project, its beats, its board, its outline and who
else is in the room; the stranger read nothing. Only the showrunner could add,
edit or delete anything, or promote a seat. Nobody at all — the showrunner
included — could read an invitation. The transaction was rolled back and the
tables are empty again.

One advisory stands and is correct as it is: `may_read_project` and
`may_write_project` are `SECURITY DEFINER` functions executable by
`authenticated`. They have to be — a row-level policy is evaluated as the
querying user, so the user must be able to call the function the policy calls,
which is why migration 0005 granted `owns_project` the same way and said so.

### Stage 3 — branches, versions, and the third bridge

**`may_write_project` did not need widening after all, and that is the better
answer.** Stages 1 and 2 left it owner-only "until branches exist", assuming
branches would open it up. They do the opposite: a writer never writes to the
project's rows at all, they write to **their own branch**, which is a different
table. §1 stops being a rule the policies have to be careful about and becomes
a fact about the schema — there is no statement a writer can issue that reaches
the master or anybody else's draft.

**The desk is not the record.** A branch has one mutable head, which is what
autosave rewrites forty times an afternoon, and a chain of **versions**, made
when somebody decides a point has been reached. A history that recorded every
autosave would be one nobody could read; one that recorded nothing would not be
a history.

**Immutable in fact.** A trigger refuses any update or delete on `versions` —
not a policy, a trigger, so it refuses the **service role** too. Proved: the
server's own credentials get *"A version cannot be changed once it exists"*.
That is the difference between §1 being enforced and §1 being intended.

**A private branch is private, and the showrunner is not an exception.** Proved
on the live database: the showrunner sees *that* a writer has a branch, and
reads neither its desk nor its snapshots. Submitting is how work becomes theirs
to read (§10), and until then a room where everyone can read everyone's
unfinished draft is a room where nobody drafts (§7).

**The third bridge works, and the application did not have to be told.** The
renderer talks to `window.vcwriter`; the desktop implements it against Electron
and files, the preview against IndexedDB, and `cloud-bridge.ts` against the
room. It is built *on* the browser bridge rather than beside it, because only
the handful of methods about where the project lives differ — printing, the
panes, the document link and the menu are the same in a room as anywhere else.
A `path` is a branch id, so the one string the renderer already carries is the
only thing it needed.

`/preview?room=<id>` is the whole editor on that bridge, and the gate now has
two ways through: an administrator bare, or a member of the named room, which
the middleware does not judge — it asks for the row and row-level security
answers.

Three things came out of building it.

**Nothing opened the project.** The bridge worked and the Welcome screen still
asked which project to open — a question that, in a room, was settled before
the page loaded. `autoOpen` on the bridge says so, and it is the only thing
added to the interface for the whole stage.

**A room's version had no name in the history.** Mapping a version onto the
snapshot list dropped its label and showed a date instead, and worse, called
the room's master draft *"before a sync that had conflicts"* — a sentence that
is untrue about a version somebody made on purpose. `SnapshotSummary` gained an
optional `label`; a named point says its name and keeps the date underneath,
and one taken by a timer still shows what it always did, because a date is the
only true thing to say about it.

**The trigger function had a mutable `search_path`** — caught by the linter
after the migration was applied, and corrected in 0027. Every other function in
the schema pins it, and a trigger is the one place it matters most: it runs on
every write to `versions`, under whatever search path the caller happens to
have.

### Stage 4 — colour, end to end

**A record names a person and nothing else.** `origin` on a scene and on a beat
is `{ authorId, at }` — no colour, no initials, no name. Every one of those is
read through the seat when it is drawn, so a showrunner who recolours a writer
has recoloured every page that writer wrote, rather than leaving a hundred
stale copies of last week's colour scattered through the document. Migration
`0028` gave the two tables the column, and `sync-mapping.ts` carries it both
ways; without that the origin would have been dropped on the journey to the
database and silently lost.

**Signing is one seam, not a dozen.** A room has a dozen controls that can make
a scene and there will be more, and threading an author through each of them
would put a fact about the room into components that have no business knowing
there is one. Instead the bridge signs: `signWork` on the cloud bridge is
called on every edit, and `signNewWork` in the domain marks what this writer
made. It is right for a reason worth keeping — **what was in the draft when it
opened is not this writer's**. A branch carries the master's scenes, and a
bridge that signed everything it could see would hand one writer the credit for
the whole room's script. So the baseline is taken at open, and a record that is
already signed is never re-signed.

**The master is clean and a contribution is signed** (§6.3). This is where §5's
first draft was wrong, and stage 4 is where the correction becomes code. Three
things follow from one predicate, `isSigned`: the stamp in the corner of the
printed page, the marks on the records, and the contributor filter all appear
together on a writer's own draft and all vanish together on the master — and
**clean reading** is the same switch, for reading a draft the way it will be
read outside the room.

**Picking a contributor marks their work; it never hides anyone else's.** A
script with the other three writers' scenes taken out of it is not a script,
it is a pile of fragments — the same reasoning addendum 06 §8 gives for
bringing a match's parents with it. The bar's initials are toggles, and the
same press again is how a writer stops picking somebody out.

**The mark went on the block, not on the name row.** It was on the beat's name
header first, which was wrong the moment the screen was looked at: beat names
are an authoring annotation the writer switches off, and whose words these are
is not. It sits on the beat block itself, opposite the ✎ and outside the page's
own column, so it never crowds the manuscript it describes.

**Where colour is refused.** The stamp is on the printed page and the PDF; the
screen carries the identity bar and the marks. Nothing colours a lane — a lane
is a thread of the story and a contributor colour is a fact about who wrote a
line, and two colour languages on one page is neither (§6.2).

**Addresses stay in the room.** `/api/rooms/[roomId]/identity` returns the
seats as row-level security gives them to the caller, with every email but the
caller's own blanked: a badge needs a name and a colour, and a script window
has no use for the room's address book.

**And two things 0026 shipped that the linter caught.** `versions` had a
policy for *it is mine* and a second for *it is the room's master*, both
permissive and both evaluated on every read — one question with two true
answers, which is what `or` is for; and `branches.owner_id`, the column
`owns_branch` reads on every save, had no covering index. Corrected in `0029`,
and neither changes who may read what. This is the third time the advisors
have found something the SQL read as though it did correctly, which is why
CLAUDE.md now says to run them as part of the change.

### Stage 5 — the dashboard, and a version in a window of its own

**The dashboard's real content is a refusal, and it says so out loud.** A
showrunner opening the room sees a row per seat: who is in it, who has a
working line, and — for everybody but themselves — *Working. What is on their
desk is theirs until they submit it.* That is not a gap waiting for stage 6 to
fill; it is §7, and a dashboard that quietly showed an empty column would have
made the promise look like a fault. `desksIn` in `packages/domain/desk.ts`
decides what a reader is offered, and `mayReadVersion` states the rule in the
same words the database's own policy uses — this decides what to *offer*, and
a link it wrongly offered would still be refused on the way through.

**A version opens in a window of its own.** `/preview?room=…&version=…` is one
point in the room's history rather than anybody's desk: the master, or a
recorded point somebody may read. Several sit side by side, which is what §3.4
asked for and what the pane windowing already made possible — the new part is
*what gets opened*.

**The window wears the author's name, not the reader's.** This is the one
mistake §3.4 exists to prevent, and it very nearly shipped: the bar drew the
reader's seat because the interface asked who was in the room before the window
knew whose version it held. Both now wait on the same answer. A page of Mara's
draft is stamped MO whoever is looking at it, so `RoomIdentity` carries `you`
(who is reading) and `author` (whose this is) as two different facts, and the
stamp and the bar read the second.

**A recorded version cannot be changed, and the window says so first.** The
database refuses it with a trigger — it refuses the service role (§19, stage 3)
— but a writer should not learn that from autosave a minute after they typed.
The bar carries *Read only* from the moment it draws, the bridge refuses the
save in the same words, and nothing is signed in a window where nobody is
writing.

**What stage 5 does not do.** A read-only window still lets a reader type; the
edit simply never lands, and the refusal is explicit rather than silent. Making
every control inert is a larger change than this stage needs, and the honest
version of it belongs with submitting (stage 6), where a reader has a reason to
want a copy of what they are reading rather than an edit of it.

### Stage 6 — submitting, and the queue

**This is where reading widens for the first time, and the widening is the
whole stage.** Until now a version was readable by its author or, as the
master, by the room. Now a version that has been *submitted* is also readable
by whoever curates the room it went to — and §7 still holds exactly as it did,
because an unsubmitted draft is nobody else's. Submitting is the act that
changes that, which is what §7 said it would be.

Proved on the live database rather than in a test, ten claims in one
transaction and rolled back afterwards: Jo submits her own version; Jo cannot
submit **Mara's** version; Jo cannot approve her own submission; Mara cannot
read Jo's submission *or* the version behind it; Ken reads both; Ken **cannot**
read Mara's unsubmitted point; Ken can move it along; and nobody, Ken included,
can delete a submission.

**A submission copies nothing.** It references the version it was taken from,
and a version cannot be changed once it exists (the trigger from stage 3
refuses even the service role), so the writer carries straight on and what the
showrunner is reading cannot move under them. Pressing Submit records the point
on the line and sends *that* — a writer submitting never has to know what a
version is.

**Deciding is the showrunner's alone, and that is a schema decision rather than
a careful one.** It was tempting to let a writer edit their own note, but
row-level security is row-level: the same policy would have let them set their
own state to `approved`. A writer who wants to say something else sends another
submission, which is the more truthful record anyway.

**No state deletes anything** (§1), and the transitions say so out loud: a
decision can be unmade — `rejected` goes back to `in_review`, `approved` back
to `revision_requested` — because a showrunner who rejected the wrong scene at
midnight should not have to ask a writer to send it again. Exactly one door is
one-way: `incorporated`, because unsaying *the master carries this* is a change
to the master rather than to a row.

**The queue is oldest first**, which is the opposite of everywhere else in the
product. A version history is newest-first because the newest is the one you
want; a queue is oldest-first because the oldest is who has been waiting
longest, and a queue that buried it under this morning's would quietly punish
whoever submitted first.

**One button, and what is open decides where it goes.** Ken's mechanism, and it
needed no machinery: the Script is a pass on the script and goes to the review
queue; Research, the Sculptor and the Outliner are ideas and go to the room's
ideas (§11, stage 7). The control still shows which, because the writer is the
one who knows what they meant — but it is already right.

**It says what it did.** Submitting is otherwise invisible: the draft does not
change, the writer stays where they are, and without a sentence back the only
evidence would be a page on somebody else's screen. So it says *Sent for
review. Your draft is untouched — carry on.*

Reading a submission opens the version it references in a window of its own —
the same read-only window stage 5 built, reached the same way. Nothing new was
needed for that, which is the second time §3.4's windowing has paid.

**Two more `SECURITY DEFINER` helpers**, `curates_room` and
`version_submitted_to_me`, joining the six that were already there. The linter
warns about all eight for the same reason and the answer is the same: a policy
expression runs as the calling role, so `authenticated` must be able to execute
them or row-level security stops working. Each answers one true-or-false
question *about the caller* and leaks nothing else.
### Stage 7 — the brainstorming room

**One rule carries the stage and it is the easy one to break by accident:
filing does not consume it.** A submission the showrunner takes into the
project's research is still a submission — still in the room, still in its
writer's colour, still openable. `fileIdeas` in `packages/domain/src/ideas.ts`
*copies*: it returns a project with the chosen items added and says nothing at
all about the submission. Marking it taken up is a separate act, and a separate
sentence, because it is a fact about the **room** rather than about the
research. The page says both at once — *Taken into the project's research.
Still here, still theirs.*

**Every copy keeps its own author, not whoever filed it.** An item that already
says whose it is keeps saying so; only an item that says nothing is credited to
whoever sent it, and a showrunner filing somebody's idea is agreeing with it,
not taking it. That is what makes the box keep its colour after it has been
filed, in a project nobody submitted.

**A new id every time.** The filed item is the project's and the submitted one
is still the writer's; sharing an id would make editing one silently edit the
other, which is §1 broken in the quietest possible way.

**`author`, not `origin`, on a research item.** A scene and a beat carry whose
work they are under the name `origin` (stage 4), but `research_items.origin`
has meant *how it got into the project* — desktop, mobile capture, import —
since 0001. Two different questions, so two different names; migration 0032
adds the column and `sync-mapping.ts` carries it both ways.

**A box, not an item, is the unit.** Ken: *you can see whose ideas are what,
because they're colorized and the boxes are colorized.* So a submission draws
as one card in its writer's colour, down the left edge where it cannot be
mistaken for a highlight, and the items sit inside it. A filed box is
deliberately **not** faded: it keeps every word at full strength and takes a
quiet ✓ Filed in its header, because dimming it would say the opposite of §1 in
the one place the page is meant to say it.

**Filing is the showrunner's, and the route says so rather than failing
silently.** Writing into the project's own research is `may_write_project`,
which is the owner's; `canReview` draws the control and the route checks it
before `writeResearch` goes in as the server — the same arrangement `rooms.ts`
uses for seats, and for the same reason (a co-showrunner holds the room's owner
seat without owning the project). Only the research rows are written back: the
rest of the document came out of the database a moment ago and putting it all
back would be a merge nobody asked for.

**And §11's free consequence collected itself.** The Research shelf already
lives inside the Sculptor and the Outliner (addendum 06 §3), so colourising the
shelf reached both without either being taught anything: an item on the shelf
wears its author's colour down the edge, carries their initials, and names them
in the tooltip. An item nobody signed stays plain, which is right — most
research has no author and inventing one would be worse than saying nothing.

### Stage 8 — assignments, and the Assign menu

**An assignment is not a lock**, and that is the sentence the whole stage was
built around rather than a caveat added to it. Nothing consults an assignment
before letting anybody write: not a policy, not the data layer, not the
renderer. It records who is *expected* to write something, which is a different
fact, and §1 is why — two writers taking a run at the same scene is a room
working properly, and both runs survive. Proved rather than asserted: in the
preview, Jo types straight into a scene assigned to Mara and nothing objects.

**One row, three angles.** The writer's landing page says what is being asked
of them; the dashboard says who owes what; and a badge stands beside the scene
itself, which is where a writer actually is when the question *is somebody
already doing this?* occurs to them. Three readings of one row rather than
three places keeping their own copy — the same argument §6 made for colour.

**Drawn so it does not look like a lock.** The badge is hollow where the
contributor's mark beside it is solid: that one says who *wrote* this, and this
says who is *expected to*, and the pair reads as two questions rather than one
emphasis. A heavier badge on a scene is exactly where somebody would otherwise
assume they must not touch it, so the tooltip says so in words as well.

**A target with no foreign key, deliberately.** The record an assignment names
lives in the project *document*, and every branch carries its own copy of the
master's scenes under the same ids — which is precisely what lets one
assignment mean the same thing on four writers' lines at once. A foreign key
would tie it to the master's row and quietly stop being true the moment
somebody worked on a branch. The label is copied onto the row as well, so it
still reads after a rename and for a reader who cannot open the scene.

**And a target is optional**, which matters as much as the four kinds §8 names.
An assignment with no target is a task — *write the cold open* — and that is
what Ken asked for when he said *assign tasks*. A room gives out work that has
not been written yet; insisting every assignment name an existing record would
be insisting the work exist before it is asked for.

**Two people may touch the row and they may say different things about it**,
which is where this parts company with a submission. Stage 6 refused to share
the update at all, because row-level security is row-level and a note-editing
policy would have let a writer approve themselves. Here the writer genuinely
has something to say — how their own work is going — so the *column* question
gets a column answer: a `before update` trigger lets a non-curator change the
state and nothing else, and only into *accepted*, *being written* or *done*.
Calling it off is the showrunner unasking for it; picking a called-off ask back
up is the showrunner asking again. Twelve claims on the live database, in one
transaction and rolled back: Ken assigns and Jo cannot; Ken cannot assign to a
seat he took out of the room; Jo says she is writing it; Jo cannot rewrite what
was asked, hand it to Mara, or call it off; Mara sees what the room owes and a
stranger sees nothing; nobody deletes one, Ken included.

**Wider reading than a submission, on purpose.** Everybody in the room sees
every assignment. Who owes what is not a secret from a room, and a writer who
cannot see that a scene is already asked of somebody is a writer about to
duplicate it by accident — it is the information that makes a lock unnecessary
rather than a softer kind of one.

**The dashboard lists everybody, including whoever owes nothing**, because *who
is free* is the other half of the question a showrunner is asking when they look
at it, and a column that only listed people with work could not answer it.

**A trigger function that nobody can call.** The advisor flagged
`assignment_guard` alongside the eight policy helpers, and unlike them it could
actually be closed: a policy expression is evaluated as the calling role and
would stop working, but a trigger function's `execute` is checked when the
trigger is *created* and never again when it fires. So it is revoked from
`authenticated` as well — no REST caller can reach it, and it still guards every
update. Re-proved after the revoke, because a security fix that quietly
disables the thing it protects is worse than the finding.

### Stage 9 — the Curation Tray, and the master merge

**The point of the module.** Everything before this made it possible to see what
a room wrote; this is where the room's work becomes the script.

**A merge adds. It does not overwrite.** Committing writes a *new* master
version beside the one before it and points the room at it — so the master the
room had five minutes ago is still a version anybody can open, every writer's
line is untouched, and a scene the room changed its mind about is recovered by
opening the version it came from, which is exactly where it still is. Two tests
exist purely to keep this honest: after a merge, the master it started from and
the contribution it took are byte-for-byte the objects they were.

**Attribution survives the journey, and it cost nothing.** A record has carried
`origin` since stage 4, and taking it into the master carries `origin` with it —
so a scene assembled from Mara's pass and one of Jo's beats genuinely has two
authors, and the preview draws both chips against that scene. §12 asks for
*combine material from several writers with each source's attribution intact*;
it falls out of stage 4 rather than being built again.

**The preview is the merge.** §12 asks to see the resulting master sequence
before committing, and the only truthful way to show it is to build it — so
`applyTray` is pure, the page runs it to draw the preview, and the commit route
runs the same function over the same rows. There is no second code path that
could disagree with the picture, and the route re-reads the tray rather than
trusting what the page drew, so a stale page cannot commit something nobody saw.

**A beat is the precise excerpt.** §12 asks for *a whole contribution or a
precise excerpt*, and a beat is where the manuscript lives, so scene and beat
are the two grains the tray takes. Finer than that — a range of elements inside
one beat — is a different and much more delicate thing, and pretending a beat is
not precise enough would have meant building it badly today rather than properly
later.

**Two ways in, and `add` is the interesting one.** *In place of it* is the
ordinary case: a writer was asked for a pass on a scene and this is it.
*Alongside what is there* gives the piece an id of its own so the room keeps
both — which is how §12's *compare alternate scenes* actually works, and why the
beats are copied with new ids too: sharing an id would make editing one silently
edit the other.

**Merging something still waiting to be read *is* approving it**, so a
submission that had not been decided on is walked through `approved` on the way
to `incorporated` rather than jumping the state machine — two things happened
and the row records both. A submission the showrunner had already **turned
down** is deliberately left where it is: taking one beat out of a rejected pass
is a real thing to do and does not un-reject the pass, and the merge record
names the version permanently, which is the truthful account of what went in.

**The merge record lives on the version rather than in a table.** A version
cannot be changed once it exists — 0026's trigger refuses even the service role,
which this stage re-proved — so a record written there is permanently true and
can never drift from what it describes, which a separate table could.

**The one delete in the whole Room, and it is the right one.** Taking a piece
back *out of the tray* destroys nothing: the submission is untouched, the
version is immutable, and the piece is where it always was. A tray that could
not be cleared would make a showrunner commit things to be rid of them, which is
a worse outcome than a delete. The tray is also the one thing here a writer
cannot see — who owes what is information a room needs (§8), but what the
showrunner is *considering* taking is a decision in progress.

**And a hole 0026 left, closed by the first stage able to close it.**
`versions_own_insert` let anybody in the room insert a version of any kind, and
`versions_master_read` makes a master-kind version readable by the whole room —
so a writer could have published their own draft to everybody by labelling it
`master`. Nothing ever did, because nothing made master versions until now.
Proved closed on the live database, alongside nine other claims in one
transaction: Jo cannot publish herself as the master, cannot put anything in the
tray and cannot read it; the same piece cannot be taken twice; Ken commits a
master with its record and Mara can read it; nobody can rewrite the version it
drew from — not Ken, not its author, not the service role.

### Stage 10 — comments, mentions, and the trail

**A comment is speech about the work, not the work**, and that one distinction
settles nearly every decision in the stage. It is why a comment *can* be edited
— somebody correcting their own typo is not rewriting anybody's script — and why
it still cannot be **deleted**: a thread with a hole in it is a conversation
nobody can follow, and §1's *no state means gone* covers the record of a room as
much as its pages. Withdrawing is a state, and the thread still reads.

One line was drawn inside that rule rather than against it: a withdrawn thread
**with nothing built on it** is not shown. Nobody answered it, so there is no
conversation left to keep readable, and an empty *withdrawn by the person who
said it* is clutter rather than record. One with replies always stays, because
taking it away would orphan them — which is the hole the rule refuses.

**The audit trail is a reading, not a second recording**, and this is the best
thing in the stage. §9 asks for a record of who created, submitted, accepted,
rejected, moved or modified collaborative material — and every one of those
facts is *already written down*: a version carries its author and its moment, a
submission its state and who decided it, an assignment both, a seat its dates.
A log table beside them would be a second copy of the same events, and a second
copy drifts, which is the one thing an audit trail must never do. So `activityIn`
reads the records and orders them, and there is no table at all. What that costs
is said out loud in the file: the trail shows a submission's *current* standing
rather than every state it passed through, and keeping every step is a real
feature to build deliberately rather than a side effect to leave half-done.

**Notifications are computed for the same reason.** A mention is a comment that
names you; a reply is a comment in a thread you are in. Both are already
written, so *what is new* is a reading of the comments rather than a
notification row per event. The only thing recorded is when each person last
looked — one small table, private to them in every direction, because when
somebody last opened a room is nobody else's business.

**One person per `@`, walking the text.** Asking each name whether it appears
anywhere looks equivalent and is not: `@Jo Calder` *contains* `@Jo`, so a room
with a Jo Calder and a Jo would quietly address both from one mention. The
walk was written first the wrong way and the test caught it, which is what that
test was for. Mentions are then **stored resolved**, like an assignment's label:
a mention is a fact about a moment, and renaming somebody two weeks later must
not silently re-address what was already said.

**A ninth `SECURITY DEFINER` helper was avoided**, and the reason is worth
keeping. The eight that exist are definers because the caller usually cannot
read the table the question is about. Here they can — `room_seats_member_read`
already lets a member see the room's seats — so *may this person speak* is a
plain subquery evaluated under the caller's own rights, and the advisor's list
did not grow.

**Where the conversation lives.** The writing program shows a **count** beside a
scene and nothing more: quieter again than the assignment badge, which is
quieter than the contributor's mark, because that is the order of their
importance to somebody about to type — whose this is, who it is asked of,
whether there is something to read first. The threads themselves are read and
answered on the room page, where a discussion has room to be one, rather than
turning the script into a comment client.

Eleven claims proved on the live database and rolled back: a writer comments and
a viewer cannot, though a viewer reads; a stranger sees nothing; nobody comments
in somebody else's name; the author corrects their own and the showrunner
settles a thread while a viewer cannot; nobody deletes a comment, the showrunner
included; a comment on the room may not also name a record; and a read-mark is
visible only to the person it belongs to.
