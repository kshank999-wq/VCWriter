# Addendum 07 — Writers Room

Status: specified; **stages 0–3 built and live**, September 2026. From Ken's *VC Writer Writers
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
4. Contributor colour end to end: the page stamp, the identity bar, beat
   badges, and the filters that use them (§6).
5. The showrunner dashboard, loading a writer's version, and several versions
   open at once (§10, §3.4).
6. Submitting, and the review queue (§10).
7. The brainstorming room (§11).
8. Assignments and the Assign menu (§8).
9. The Curation Tray and the non-destructive master merge (§12).
10. Comments, notifications and activity history.
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
