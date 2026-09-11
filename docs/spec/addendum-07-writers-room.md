# Addendum 07 — Writers Room

Status: specified, nothing built, September 2026. From Ken's *VC Writer Writers
Room Development Specification v1.0* of 11 September. Extends §12 (commerce),
§14 (sync) and §15 (no manuscript data loss) of the master specification, and
is the module addendum 03 §14.4 stage 10 has been waiting on.

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

## 2. What already exists, and what the Room is allowed to assume

This module is unusual among the addenda: most of its foundations are already
in the product, built for one writer. Naming them decides how much of it is new
work and how much is widening.

| What the Room needs | What exists today | Where |
| --- | --- | --- |
| A web application on the account | The site, auth, admin console | `apps/web` |
| A browser build of the editor | `/preview`, the renderer built for a browser | `apps/web/public/preview`, `preview-gate.ts` |
| The editor on something other than a local file | The browser bridge: the preload interface over IndexedDB | `apps/desktop/src/renderer/browser-bridge.ts` |
| Project data in the cloud | Eleven synced collections, round-tripping | `packages/domain/src/sync-mapping.ts` |
| A merge | Per-record merge with the loser preserved | `packages/domain/src/sync-merge.ts` |
| Access control on every project table | One security-definer function, `owns_project` | `0001_core_story_schema.sql` |
| Purchases, receipts, entitlement | Stripe orders, licences, activations | `0002_commerce_and_releases.sql` |
| Transactional email | Resend, with delivery events recorded | `email.ts`, `email_events` |
| Admin gate | `profiles.is_admin`, `public.is_admin()` | `0008_admin_release_management.sql` |

Three of these deserve a decision rather than a row in a table.

### 2.1 The Room is the preview, grown up

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

What changes at `/preview` is the gate. Today it admits administrators only;
under the Room it admits a member of a room, at a URL that names the room and
the branch. The admin-only path stays, because the preview is still where the
interface under development is looked at.

### 2.2 Membership widens one function; it does not add a second set of rules

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

### 2.3 The sync merge is not the Room's merge

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

## 3. What is missing, and blocks work that is already scheduled

**Boards and outlines do not sync.** `SYNC_TABLES` names eleven collections,
and neither the Story Sculptor's boards (addendum 03) nor the Outliner's
outlines (addendum 06) is among them: they live in the project file and nowhere
else. A Room built today would carry a script and no plan.

This is also what blocks **addendum 03 §14.4 stage 10** — Writers Room
attribution and alternate boards — which cannot be built on a board the cloud
has never seen. It is the first prerequisite in §11's build order, and it is
work in `packages/domain` and `packages/supabase` rather than in the Room.

## 4. Roles and access

| Role | What it may do | Typical |
| --- | --- | --- |
| **Owner / Showrunner** | Everything: review all work, curate, publish the master draft, invite and remove seats | Showrunner, lead writer |
| **Writer** | A private working branch, plus the contributions they explicitly share; submit scenes, beats and ideas for review | Staff writer, co-writer |
| **Editor / Producer** | Comment, compare, review, and propose changes — never a destructive write | Producer, editor |
| **Viewer** | Read approved material and the room views they are given | Executive, stakeholder |

Two rules the table does not say:

- **A Writer's private branch is private.** Presence may show that someone is
  in a scene; it never shows the text they have not submitted. A room where
  everyone can read everyone's unfinished draft is a room where nobody drafts.
- **An Editor proposes.** *Propose* is a submission from someone who is not a
  Writer, and it lands in the same review queue. It is not a second mechanism.

## 5. Identity and colour

Every collaborator has a **persistent room colour**, a display name, and
initials. The colour is the fastest fact on the page and it is used in exactly
three places:

- the **identity bar** at the top of a writer's version, with their name;
- a small **initials badge** on every beat, saying who originated it;
- the **contribution overlay**, where the master script is tinted by source.

**It is never used on a lane.** Plot lanes already carry colour (addendum 02
§8), and two colour languages on one page is neither. A lane is a thread of the
story; a contributor colour is a fact about who wrote a line. They must not be
mistaken for each other, so they never appear in the same role.

**Origin is immutable.** Scenes, beats, notes, proposals and imported material
keep their origin metadata after being incorporated into a master draft — that
is what makes §1's promise auditable rather than merely intended.

**And none of it enters the manuscript.** Attribution is authoring metadata, in
exactly the sense the beat's internal title is (master spec §5.3, §19): it
belongs to the room, not to the script. A printed script carries no badges, no
tints, and no identity bar. The clean-reading mode is the same view the printer
gets.

## 6. Versions, branches and history

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

## 7. The room dashboard

What the showrunner opens onto: active writers, assigned material, recent
submissions, unresolved conflicts, comments, and the current master version.

- A **writer selector** that loads any contributor's complete script or their
  contribution set.
- **Side-by-side and multi-version comparison.**
- A **scene/beat matrix** saying which writers have an alternate version or a
  proposal for each story unit — the one view that shows where the room agrees
  and where it does not.
- **Filters**: new, unread, submitted, approved, rejected, incorporated,
  superseded.
- An **activity feed** and notifications for submissions, mentions,
  assignments, approvals and master-draft changes.

## 8. Curation

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

## 9. The views

| View | What it is |
| --- | --- |
| **Master Script** | The current approved room version |
| **Writer Version** | One writer's branch, under their identity bar |
| **Contribution Overlay** | The master script tinted by source authorship |
| **Beat / Scene** | Badges, comments, status, assignment, origin history |
| **Diff** | Additions, deletions, moves and rewrites between any two versions |
| **Clean reading** | All collaboration metadata hidden (§5) |

## 10. Communication, AI, and the rest

**Communication.** Threaded comments at project, scene, beat, paragraph and
research-item level. `@mentions` and assignments with a due date and a status.
A room notes area for concepts not yet in the script. The submission workflow
is *Draft → Submit → In Review → Approved / Revision Requested / Rejected →
Incorporated*. Notifications in the Room, optionally by email — Resend already
carries transactional mail and records delivery outcomes.

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
survive the journey — and which is why §3 is a prerequisite and not a detail.

## 11. Build order

0. **Boards and outlines sync** (§3). A prerequisite, in `packages/domain` and
   `packages/supabase`, not in the Room. It also unblocks addendum 03 stage 10.
1. Rooms, subscription entitlement, invitations, roles and seat management —
   and `owns_project` widened into read and write (§2.2).
2. Cloud projects with branches, autosave, snapshots and immutable version
   history.
3. Contributor colours, identity bars, beat initials badges, and the filters
   that use them.
4. The showrunner dashboard, and loading a writer's version.
5. The submission workflow, and side-by-side comparison.
6. The Curation Tray, and the non-destructive master merge.
7. Comments, assignments, notifications and activity history.
8. Desktop synchronisation, and export/backup of a whole room.
9. AI comparison and summarisation, and the advanced collaboration features.

Stage 6 is the point of the module, the way promotion is the point of the
Outliner: everything before it is making it possible to see what the room
wrote, and that is where the room's work becomes the script.

## 12. What it must never do

- **Never let one writer's edit destroy another's** (§1). Everything else here
  is a way of keeping this.
- **Never resolve a disagreement by timestamp.** Two drafts are a decision, not
  a conflict (§2.3).
- **Never show a private branch's text** to anyone but its writer (§4).
- **Never let attribution reach the manuscript** (§5).
- **Never let removing a seat remove authorship** (§10).
- **Never rely on the interface for access control.** The policy function
  decides, on the server, every time (§2.2).
- **Never overwrite the cloud master with an upload** (§10).
- **Never require the Room.** The desktop application is a complete product for
  a writer who never signs in, and it stays one.

## 13. Acceptance

- Two writers edit separate branches of one project at the same time without
  overwriting each other.
- The showrunner loads each writer's work, tells it apart on sight, compares
  the alternatives, and curates a selection from them.
- A beat shows its originator's initials and colour unless collaboration
  metadata is deliberately hidden.
- A master merge makes a recoverable new version and preserves every source
  contribution.
- Removing a collaborator's active seat erases neither their historical
  authorship nor the room's record of it.
- A printed master script carries no collaboration metadata at all.
- A non-member is refused by the database, not by the page.

## 14. Names

| Name | What it is |
| --- | --- |
| **Room** | One collaborative workspace, attached to a project |
| **Seat** | One collaborator's place in a room, billable and revocable |
| **Branch** | A writer's private working line |
| **Version** | An immutable point on a branch |
| **Snapshot** | A version the writer named |
| **Master version** | The approved room draft, made only by a merge |
| **Contribution** | Material a writer has shared or submitted |
| **Submission** | A contribution entered into review |
| **Curation Tray** | The staging area between contributions and the master |
| **Merge record** | What a master version was assembled from |
| **Overlay** | The master script tinted by who wrote what |
