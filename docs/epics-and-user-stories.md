# Epics and user stories

Specification §19 asks for the document to be converted into epics, user
stories and acceptance tests before implementation. This is that conversion.
Each story carries acceptance criteria a test can assert; where a test already
exists it is named.

---

## Epic 1 — Project setup and project home (§4)

**1.1 Create a project in a chosen format.**
As a writer, I create a project as a screenplay, novel or other supported
format so the workspace matches what I am writing.
*Accepts:* a new screenplay opens with a scene container; a new novel opens
with a chapter container; both start with one lane, one container, one beat and
the default research categories.
*Tested:* `structure.test.ts` — "creates a usable project", "uses chapters for
novels".

**1.2 Record project metadata.**
Title, author, logline, elevator pitch, synopsis, genre, status and notes are
editable and persist.
*Accepts:* every field survives a save/load round trip.
*Tested:* `project-file.test.ts` — round-trip.

**1.3 Poster and one-sheet.**
Upload key art; generate a printable one-sheet from project metadata and email
it.
*Accepts:* poster stored in the private `project-assets` bucket under the
project id; one-sheet renders without the writer re-entering any metadata.
*Status:* asset path and bucket exist; the generator is Phase 3 work.

**1.4 Project dashboard.**
Progress, unresolved research, current scene/chapter and recent work are
visible on opening a project.
*Accepts:* counts for scenes, beats, words, unused research and unresolved
setups are derived, never stored stale.
*Implemented:* `projectStats`.

---

## Epic 2 — Story structure (§5)

**2.1 Organise scenes and chapters into plot lanes.**
*Accepts:* multiple lanes; lanes reorder; a container can move between lanes
and keeps its beats.
*Tested:* `structure.test.ts` — "moves a scene between lanes".

**2.2 Beats live inside a scene or chapter.**
*Accepts:* creating a beat requires an existing container; there is no code
path or column that permits a beat with no container.
*Tested:* `structure.test.ts` — "refuses to create a beat outside a
scene/chapter container". Enforced again by `beats.unit_id NOT NULL`.

**2.3 Reorder beats and move them between containers.**
*Accepts:* order survives reload; a moved beat keeps its manuscript, links and
metadata; inserting between two beats writes only the moved row.
*Tested:* `structure.test.ts` — "keeps beats ordered", "moves a beat to another
scene while preserving its links"; `ordering.test.ts`.

**2.4 The internal beat title is never manuscript text.**
*Accepts:* the rendered manuscript does not contain any beat title; an
annotated reference copy includes it only when explicitly requested.
*Tested:* `render.test.ts` — "never emits the internal beat title".

**2.5 Collapse and expand containers.**
*Accepts:* collapsed state persists per container.
*Status:* `collapsed` field exists; the interaction is Phase 2.

---

## Epic 3 — Research and story intelligence (§7)

**3.1 Default and custom research categories.**
*Accepts:* Characters, Ideas and Plot Points exist in a new project; categories
can be created, renamed, reordered and archived.
*Tested:* `research.test.ts` — "seeds the default categories".

**3.2 Used / unused workflow.**
*Accepts:* marking material used removes it from the working inventory without
deleting it; restoring returns it; the record and its history survive both.
*Tested:* `research.test.ts` — "moves an item to used and back again without
deleting it".

**3.3 Automatic detection proposes, the writer decides.**
*Accepts:* an inferred usage is stored as unconfirmed and is distinguishable
from a writer's decision.
*Tested:* `research.test.ts` — "records an unconfirmed suggestion distinctly".

**3.4 Setups and payoffs.**
*Accepts:* one payoff tracks any number of setups; unresolved obligations stay
on the active list; resolving then archiving keeps every setup point and link;
un-archiving restores it to the active list.
*Tested:* `research.test.ts` — "tracks several setups for one payoff",
"archives a resolved record reversibly".

**3.5 Typed links between story elements.**
*Accepts:* a prop can link to a character, a scene, a setup and a later payoff;
each beat can list its related elements; the same link is never duplicated.
*Tested:* `structure.test.ts` — "does not create duplicate links";
`selectors.ts` — `relatedRefs`.

---

## Epic 4 — Writing workspace (§6)

**4.1 Write in the correct professional format.**
*Accepts:* screenplay elements render with industry layout — headings and
character cues uppercase, dialogue indented; prose formats render as
manuscript paragraphs.
*Tested:* `render.test.ts` — "uppercases screenplay headings and indents
dialogue".

**4.2 Autosave and recovery.**
*Accepts:* an edit is on disk within the configured interval; a crash mid-save
leaves the previous good file intact; snapshots are written periodically and
can be restored; restoring is itself reversible.
*Tested:* `project-store.test.ts` — atomic replace, snapshot round trip,
"refuses a corrupt file".

**4.3 Focus mode, print preview, PDF export.**
*Status:* Phase 3. Export is a renderer over the manuscript element list, so no
data change is required.

---

## Epic 5 — Editors (§8)

**5.1 Daily Editor** — grammar, spelling, punctuation, readability, with
accept/reject that preserves the writer's voice.
**5.2 Final Editor** — scene-by-scene structural review: what is true at the
start, what changes, where the turn is, whether the value moves; surfaces weak,
repetitive or non-turning scenes and unresolved threads.
*Accepts:* findings are presented for review; nothing is rewritten silently.
*Status:* Phase 5. The scene/beat model and the setup/payoff records supply the
inputs.

---

## Epic 6 — Voice (§9, §10)

**6.1 Assign a voice per character.**
*Accepts:* assignment persists per project and stays editable; dialogue resolves
to the speaking character's voice, action and prose to the narrator voice.
*Tested:* `render.test.ts` — "assigns each character its persistent voice".

**6.2 Dictation and hands-free capture.**
*Accepts:* raw capture is retained until the writer confirms classification;
uncertain classifications enter a review queue rather than being written into
the project.
*Status:* Phase 4/5. `CaptureItem` models it, `capture_items` stores it.

---

## Epic 7 — Commerce and delivery (§3.2, §12, §17)

**7.1 Choose Windows or Mac at purchase.**
*Accepts:* the buyer picks a platform without contacting support and the choice
is recorded with the order.
*Implemented:* `/download` and `orders.selected_platform`.

**7.2 A successful purchase creates exactly one license.**
*Accepts:* replaying the same webhook event, or two concurrent deliveries,
still leaves one order and one license.
*Enforced:* unique `stripe_checkout_session_id`, unique `licenses.order_id`,
and an event-id claim table.

**7.3 Immediate download and confirmation email.**
*Accepts:* the post-payment page offers the chosen installer; the email carries
the license and a link to downloads; a failed email never fails the purchase.

**7.4 Re-download later.**
*Accepts:* signing in shows the current authorised build for each entitled
platform; each download is a fresh short-lived signed URL.
*Implemented:* `/account`, `/api/downloads/[platform]`.

**7.5 Refunds and revocation.**
*Accepts:* a refund or dispute moves the order and revokes the license, and the
next download attempt fails.

**7.6 Publish platforms independently.**
*Accepts:* publishing a new Windows build leaves the active macOS build
untouched.
*Enforced:* one active build per platform/channel.

---

## Epic 8 — Cross-platform parity (§3.1, §17)

**8.1 A project moves between Windows and macOS.**
*Accepts:* structure, links, manuscript and metadata are identical after
opening on the other platform.
*Tested:* the domain and project-store suites run on Windows, macOS and Linux
runners in CI.

**8.2 Updates preserve projects.**
*Accepts:* a format migration takes a recovery snapshot first; a file from a
newer build is refused with an explanation rather than partially read.
*Tested:* `project-file.test.ts` — "refuses a project saved by a newer build";
`project-store.test.ts` — "snapshots before opening an older format version".
