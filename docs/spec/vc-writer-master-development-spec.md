# VC Writer — Master Development Specification

Desktop Writing Platform + VC Writer Notes Mobile Companion

| | |
| --- | --- |
| Version | Consolidated handoff — 4 September 2026 |
| Primary audience | Coding agent / product engineering team |
| Desktop targets | Windows 10, Windows 11, macOS |
| Web stack | Vercel + Supabase |
| Payments / email | Stripe + Resend |
| Purpose | Implementation blueprint for the VC Writer ecosystem |
| Source | `VC Writer / Dev spec1 / VC_Writer_Master_Development_Spec_2026-09-04.docx` (Google Drive) |

> This is the specification the repository is built from, converted to Markdown
> for reference alongside the code. The Drive document remains the document of
> record; when the two differ, the Drive document wins and this copy should be
> updated.

## 1. Product vision

VC Writer is an integrated story-development, research, outlining, drafting,
editing, playback and project-management environment for screenwriters and
novelists. It should reduce the need to move between separate outlining,
screenplay-formatting, note-taking, proofreading, text-to-speech and research
applications. VC Writer Notes extends the system to mobile capture, especially
hands-free idea and scene capture away from the desktop.

- **Core principle:** the writer moves from idea → research → structured
  scenes/chapters → beats → formatted writing → editing → export without
  leaving the ecosystem.
- **Persistent project intelligence:** characters, ideas, setups/payoffs,
  links, research, scenes, chapters, beats and used/unused material stay
  connected.
- **Professional output:** screenplay and novel views present
  industry-appropriate formatting while internal beat titles and metadata
  remain private authoring references.
- **Cross-platform distribution:** the desktop product ships for Windows 10/11
  and macOS, with the buyer choosing the correct installer during or
  immediately after purchase.

## 2. Product surfaces

| Surface | Purpose | Primary users |
| --- | --- | --- |
| VC Writer Desktop | Research, story planning, drafting, editing, playback, project management, export | Screenwriters, novelists, creators |
| VC Writer Notes | Mobile capture, dictation, categorisation, idea/scene creation and sync | Writers away from the desktop |
| VC Writer Website / Store | Marketing, accounts, purchase, platform selection, downloads, license delivery, re-downloads | Prospects and customers |
| Backend / Admin | Accounts, licenses, builds, purchases, email delivery, project sync, operational controls | VC Writer operations |

## 3. Desktop platform and distribution

### 3.1 Supported operating systems

- The Windows build supports both Windows 10 and Windows 11.
- macOS has its own supported desktop build.
- Windows and macOS releases maintain functional parity unless a
  platform-specific limitation is documented.
- Project data is portable and compatible across Windows and macOS.
- Application versioning stays synchronised across platforms where practical.

### 3.2 Purchase-time platform choice

- Present clearly labelled choices such as "Download for Windows" and
  "Download for Mac".
- Windows selection delivers the current Windows 10/11 installer; Mac selection
  delivers the current macOS installer.
- The selected platform is recorded with the order for analytics and support,
  but the license architecture permits authorised re-downloads.
- After successful payment, show an immediate download screen and send a
  confirmation email with purchase information, license/serial information and
  the appropriate download link.
- The customer account area provides re-download access to purchased installers
  and current supported builds.
- Admin tooling allows separate Windows and macOS build files, version numbers,
  release notes, minimum OS requirements and active/retired status.

### 3.3 Installation, licensing and updates

- Signed installers per OS; Windows code signing and Apple
  signing/notarisation.
- License/serial activation associates the purchase with the customer account
  and permits reasonable device management.
- Activation, deactivation and lost-device replacement flows exist so support
  does not require manual database edits.
- The application can check for a newer compatible build and guide the user
  through updating.
- Download URLs are never hard-coded in the client: use backend-managed release
  metadata or signed, expiring URLs.
- Preserve backward-compatible project migration and create a
  recovery/backup strategy before destructive schema upgrades.

## 4. Project setup and project home

- Create a project as screenplay, novel or another supported writing format.
- Project fields: title, author/creator, logline, elevator pitch,
  summary/synopsis, genre/type, optional notes, project status.
- Poster/key-art upload for a project image.
- One-sheet generator assembled from project metadata; printable, exportable
  and suitable for emailing.
- The project dashboard surfaces writing progress, unresolved research/setup
  items, the current scene/chapter, recent work and project assets.
- An email action for the one-sheet through the web/backend email service.

## 5. Story structure: lanes → scenes/chapters → beats

Beats do not sit loose in a plot lane. They belong inside a scene (screenplay)
or chapter/section container (novel), while the lane organises the larger story
thread.

### 5.1 Plot lanes

- Multiple lanes for main plot, subplots, character arcs, themes, mysteries,
  relationships or custom user-defined lanes.
- Lanes visually organise scenes/chapters in story order.
- Lane dimensions adapt to contained material so the hierarchy is visible
  without losing beat detail.
- Structural units can be reordered and moved while preserving relationships
  and references.

### 5.2 Scene/chapter containers

- For screenplays a Scene is a visible block in the lane; novels use the
  analogous Chapter/section container with the same underlying concept.
- Each container holds multiple beats in order.
- Containers are collapsible and expandable.
- Container metadata: title/reference label, sequence/order, characters,
  locations, arcs, setups/payoffs, linked research, status, notes.

### 5.3 Beats

- Each beat has an internal title so the writer can identify it quickly.
- **The internal beat title is metadata and must not automatically become part
  of the screenplay/novel manuscript.**
- Clicking a beat opens its writing workspace in the correct professional
  format.
- Beat order within a container is editable.
- Writing, research links and structural metadata stay attached to the beat
  when it moves.

## 6. Writing workspace

- The screenplay workspace behaves like a professional screenplay editor, with
  screenplay elements and industry-standard page formatting.
- The novel workspace provides appropriate manuscript/long-form formatting.
- Opening a beat shows its writing while keeping the internal beat label
  available as a reference, without printing it as manuscript content unless
  explicitly requested.
- A clean writing/focus mode with optional structural/research panels.
- Auto-save and version/recovery protection are required.
- Formatted print preview and PDF export.
- The export architecture is extensible for further manuscript/document
  formats.

## 7. Research and story intelligence

### 7.1 Research categories

- Defaults include Characters, Ideas, Plot Points and other useful
  story-development categories.
- Categories are customisable: create, rename, reorder, archive.
- Research items attach to scenes, chapters, beats, characters, arcs and other
  research items.
- Search, tags/labels and status where useful.

### 7.2 Used / unused workflow

- Material incorporated into the manuscript can move or be marked into a Used
  bin/archive.
- Unused material stays visible as a working inventory of ideas or obligations
  not yet incorporated.
- An item can be restored from Used to active/unresolved status.
- Automatic detection may suggest that an item has been used, but user
  confirmation governs destructive or status-changing actions.

### 7.3 Setups and payoffs

- A dedicated "Setups & Payoffs" section inside Research.
- A payoff can have multiple setup points and the system tracks all of them.
- Unresolved or insufficiently established setups stay in the active list.
- A completed setup/payoff can move into an archive while retaining history and
  links.
- Setup/payoff relationships are exposed in the relevant scene/beat context.

### 7.4 Links

- A dedicated linking mechanism connects story elements: a prop linked to a
  character, scene, setup and later payoff; a character linked to an arc and
  several scenes.
- Each scene/beat can display a related-elements panel.
- The panel is collapsible so it does not distract during writing.
- Links are typed, structured records rather than duplicated text, so changes
  propagate consistently.

## 8. Editor module

### 8.1 Daily Editor

Grammar, spelling, punctuation and mechanics; sentence structure, readability
and presentation; actionable suggestions with accept/reject that preserve the
writer's control and voice; targeted editing of the current beat/scene/chapter
as well as broader project passes.

### 8.2 Final Editor

An interactive structural pass approximating the questions a strong story
editor would ask before submission:

- Analyse each scene as a mini-story: what is true at the beginning, what
  changes, where the turn occurs, whether the value moves.
- Check scene purpose, conflict, stakes, character intention, turning point,
  outcome and relationship to the larger story.
- Produce a scene-by-scene story-grid style review and surface weak,
  repetitive, missing or non-turning scenes.
- Check setups/payoffs, unresolved threads, character arcs and structural
  continuity.
- Present findings as an interactive review rather than silently rewriting.

## 9. Dictation, voice capture and AI-assisted intake

- Desktop writing areas support dictation as an alternative to typing.
- VC Writer Notes supports voice-first capture away from the desk, including
  hands-free situations such as driving.
- A conceptual wake phrase — "Hey VC Writer" / "VC Writer" — subject to
  OS-level permissions and feasibility.
- The user can verbally identify the destination, such as "Character [name]" or
  "Scene", and the system routes the content accordingly.
- Captured material enters a review/approval queue before permanent
  classification when confidence is uncertain.
- An AI/NLU service may interpret commands and propose organisation; raw
  capture is retained until confirmed or safely synced.

## 10. Read-back / character voice playback

- Integrated text-to-speech, so no export to a separate read-back application.
- A curated set of natural voices spanning at least younger/older male and
  younger/older female, with accents such as British where licensing permits.
- In screenplay mode, persistent voice assignment by character so dialogue
  playback sounds like several characters conversing.
- Narrator/action voice assigned separately from character dialogue.
- Voice assignment persists per project/character and stays editable.
- Playback controls: play/pause, scene/beat scope, navigation, speed.
- Provider abstraction so the TTS vendor can change without rewriting
  manuscript data structures.

## 11. VC Writer Notes mobile companion

- Connected to the same account and projects.
- Fast access to Characters, Ideas, Plot Points and custom categories.
- Notes by typing or dictation; voice commands route a note to a
  character/category.
- Creative Scene capture mode for longer dictated scene ideas.
- An offline-tolerant capture queue so ideas are not lost on poor connectivity.
- Sync to the desktop project through Supabase/backend services.
- An approval/review queue confirms AI categorisation before material becomes
  canonical.
- Used/unused status and linked story metadata sync across desktop and mobile.

## 12. Website, accounts, commerce and delivery

### 12.1 Web architecture

Host the public website and web account surfaces on Vercel; use Supabase for
database, authentication and backend data; keep commerce, entitlement and
download authorisation server-side and never trust client-only purchase state.

### 12.2 Stripe payments

Stripe processes payments. Payment success is confirmed server-side/webhook-side
before any paid entitlement is issued. Stripe transaction/customer references
are recorded with the internal order, avoiding unnecessary storage of
payment-card data. Refund and revocation handling updates entitlement state
safely.

### 12.3 Resend transactional email

Resend sends transactional email: account verification, purchase receipt,
license/serial information and platform-appropriate download access. Templates
are versioned and managed separately from application code where practical.
Delivery status/events needed for support are logged without storing
unnecessary email content.

### 12.4 Customer download experience

1. The customer signs in or supplies the account identity used for purchase.
2. The customer purchases through Stripe.
3. The customer chooses Windows or Mac.
4. The backend confirms payment and creates/updates the entitlement and license.
5. The confirmation page offers the selected installer.
6. Resend sends confirmation, license/serial information and a secure download
   path.
7. The customer can sign in later to My Account / Downloads to retrieve the
   current Windows or macOS build permitted by the license.

## 13. Suggested core data model

| Entity | Key relationships / purpose |
| --- | --- |
| User / Account | Owns purchases, licenses, projects, preferences, devices |
| Project | Owns metadata, poster, research, story structure, manuscript, settings |
| Lane | Belongs to project; organises scenes/chapters by story thread |
| Scene / Chapter | Belongs to project/lane; contains ordered beats and structural metadata |
| Beat | Belongs to scene/chapter; owns internal title, order, manuscript segment, links |
| Research Category | Project/user-defined organisational taxonomy |
| Research Item | Belongs to category/project; supports used/unresolved state and links |
| Story Link | Typed relationship between supported story entities |
| Setup/Payoff | Payoff objective, multiple setup occurrences, status, archive state |
| Character | Project entity with metadata and persistent TTS voice assignment |
| Capture Item | Mobile/voice intake with raw content, inferred category, confidence, approval status |
| Revision / Snapshot | Recoverable manuscript/project version information |
| Order | Commerce record tied to user and payment provider reference |
| License / Entitlement | Product ownership, activation status, permitted downloads |
| Release Build | Platform, version, minimum OS, installer location, release notes, active status |
| Device Activation | License-to-device relationship for activation management |

## 14. Architecture and engineering principles

- One shared domain model for Windows and macOS rather than separate product
  logic forks.
- Keep the manuscript/project format platform-neutral.
- Separate UI, domain logic, persistence/sync, AI providers, speech-to-text,
  text-to-speech, payments, email and release delivery behind clear interfaces.
- Use stable IDs for story entities and links; never build relationships on
  display names.
- Optimistic local editing with safe sync/conflict behaviour where mobile and
  desktop may edit the same project.
- Encrypt data in transit and protect stored account/project data.
- Least-privilege access policies in Supabase and server-side authorisation for
  protected project/download endpoints.
- Structured logging and error reporting without logging manuscript content
  unnecessarily.
- Feature flags for AI/editor/voice functionality that may evolve rapidly.

## 15. Non-functional requirements

- Fast startup and responsive typing/editing in long projects.
- No manuscript data loss on crash, update, connectivity interruption or sync
  conflict.
- Keyboard-centric desktop workflows plus accessible mouse/touch interaction.
- Autosave must be frequent but non-blocking.
- Large projects stay navigable without loading every rich object into the
  active editor at once.
- The cross-platform QA matrix includes supported Windows 10, Windows 11 and
  macOS versions and hardware targets.
- The installer/update system is testable independently of the editor.
- Accessibility: navigation, text scaling, focus states, screen-reader
  semantics.

## 16. Implementation phases

| Phase | Primary deliverables |
| --- | --- |
| 1 — Foundation | Repo architecture; shared data model; Supabase schema/auth; project CRUD; desktop shell; Windows/macOS build pipeline; autosave/recovery |
| 2 — Story structure | Research categories; lanes; scene/chapter containers; beats; drag/reorder; links; setups/payoffs; used/unused workflow |
| 3 — Writing | Screenplay and novel workspaces; beat-to-manuscript mapping; focus mode; print preview; PDF export |
| 4 — Notes & sync | Mobile companion; typed/dictated capture; categorisation; approval queue; project sync; offline-tolerant capture |
| 5 — Editor & voice | Daily Editor; Final Editor framework; STT integration; TTS voices; per-character voice assignment/playback |
| 6 — Commerce | Vercel store/account; Stripe checkout/webhooks; entitlements/licenses; Resend email; Windows/Mac selection and secure downloads |
| 7 — Release ops | Signed Windows installer; signed/notarised Mac build; update/release metadata; re-download portal; activation management; telemetry/support tooling |
| 8 — Hardening | Cross-platform QA; performance; sync conflicts; backup/recovery; security review; accessibility; release readiness |

## 17. Acceptance criteria for the Windows/macOS requirement

- A purchaser can clearly choose Windows or Mac without contacting support.
- The Windows installer installs and launches on supported Windows 10 and 11
  test machines.
- The macOS installer installs and launches on the supported Mac test matrix
  and passes signing/notarisation.
- A successful Stripe purchase creates exactly one valid entitlement/license
  even if the webhook is retried.
- The post-purchase page and Resend confirmation provide the correct platform
  download path and license information.
- The customer can sign in later and re-download the current authorised build.
- Admin can publish a new Windows build without replacing the Mac artifact, and
  vice versa.
- A project created on Windows opens on Mac and vice versa without losing story
  structure, links, manuscript content or metadata.
- Updates preserve user projects and settings, with rollback/recovery
  protection for project migrations.

## 18. Decisions to keep configurable

Implemented behind configuration or provider abstractions rather than treated
as irreversible assumptions:

- Desktop application framework and packaging technology.
- License activation and device-count policy.
- Speech-to-text, AI/editor and text-to-speech providers.
- Supported macOS minimum version and CPU architecture matrix.
- Installer file formats and the automatic-update mechanism.
- Pricing model, upgrade policy, and whether one purchase grants both OS
  installers.
- Export formats beyond PDF.
- Wake-word implementation, subject to mobile OS background-audio and
  permission constraints.

## 19. Handoff notes

- Treat the Scene/Chapter → Beat hierarchy as foundational. Do not implement
  beats as free-floating lane cards that later require migration.
- Treat internal beat titles as authoring metadata, separate from printable
  manuscript text.
- Treat story relationships as first-class links, not text copied into multiple
  records.
- Treat "used" and "archived" as reversible states, not deletion.
- Design Windows/macOS parity and build automation from the beginning rather
  than porting after a Windows-only release.
- Keep external services (Stripe, Resend, AI/STT/TTS) behind server/provider
  layers with environment-specific credentials.
- Use idempotent Stripe webhook handling for orders and licenses.
- Protect download artifacts with entitlement checks or short-lived signed URLs
  rather than permanently public installer URLs.
- Before implementation, convert this specification into epics, user stories,
  database migrations, API contracts, UI states and automated acceptance tests.
