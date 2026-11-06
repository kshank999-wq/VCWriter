# Addendum 03 — Story Sculptor 2.0

Status: built, November 2026, from Ken's *Story Sculptor Development
Specification v2.0* (5 November 2026). **This replaces the column board**
(Sculptor version 1, September 2026). There is one Sculptor; the old one is
not reachable. Version 1's text is in git history before this change.

Story Sculptor 2.0 is a **visual story-architecture workspace**: a nested,
expandable story mind map. A writer puts in the big frames, drills into
scenes, nests the characters in each scene and what they do, and keeps going
as deep as the story needs. At any time the whole hierarchy can be exploded
onto one canvas, cross-linked, and folded back by level or by branch.

## 1. Where it is

The **Sculptor** button on the bottom bar (and the Window menu, and its own
pop-out window) opens it, as before. Same entry point, same room, new
contents. It covers the workspace, with **Exit** at the top right.

## 2. The screen

| Region | What it does |
| --- | --- |
| Top bar | Breadcrumbs (*Whole story › Act one › The warehouse*), search, saved status, pop-out, Save, Exit |
| Toolbar | Explode all, Collapse all, Collapse to (Frame, Scene, Character, Action, Full detail, or Level 0–n), Explode branch, Collapse branch, Show ancestors, Fit view, Focus selection, Auto layout, Connect, Undo, Redo, Zoom, Views (save and apply arrangements, show or hide link types), Notes (the research shelf and phone notes) |
| Left: palette | Frame, Plot point, Scene, Character, Action, Beat, Note, Custom. Drag one onto a card to put it inside, onto the canvas to put it at the top, or click to add under the selected card |
| Centre: canvas | Pan (drag the background, or the wheel; Space+drag), zoom (Ctrl+wheel or the slider), cards, containment lines, cross-links, minimap |
| Right: inspector | The selected card: title, type, description, typed details, the scene it is in, its script link, its connections, and actions. A selected connection shows its kind, label and direction instead |
| Right: library | Characters (the cast), places, reusable plot items, scenes already in the script, and research. Search, filters, favourites (★), and how many times each is placed. Drag onto a card, or click to place under the selection |

## 3. Typed cards

| Type | Colour | Badge | Details the inspector offers |
| --- | --- | --- | --- |
| Frame | Indigo | FR | Story order, Purpose, Summary, Polarity, Arc |
| Plot point | Violet | PP | Stakes, Cause, Effect |
| Scene | Blue | SC | Slugline, Purpose, Summary, Sequence |
| Character | Amber | CH | Scene objective, Emotional state |
| Action | Coral | AC | Verb, Target, Outcome |
| Beat | Teal | BT | Rhythm, Turn, Polarity |
| Note | Grey | NT | (subtype optional) |
| Custom | Slate | CU | (named by the writer: *Location*, *Reveal*) |

- The colour is a stripe and the two-letter badge is printed on every card,
  so colour is never the only signal.
- **Corner dots.** A card with anything under it shows one dot per type of
  what is nested (up to four, then *+N*). Hovering says *3 characters,
  5 actions*. When folded, the dots carry the count. Clicking them folds or
  opens; double-clicking opens the card as its own map.
- Any card may hold any other, without a depth limit
  (`canContain` is the one place to restrict that, and today it allows all).
- Cards can be renamed (on the card with F2 or the menu, or in the
  inspector), retyped where valid, duplicated, copied and pasted, moved,
  reparented and deleted with a question first.

The table lives in `packages/domain/src/sculptor-types.ts`.

## 4. Definitions and placements

A **definition** (`SculptorEntity`) is the reusable thing; a **placement**
is a card that shows it. A card with no definition is just itself.

- A **character** is the cast's own character. Placing Mara in five scenes
  makes five cards and one definition, and the name is read from the cast,
  so renaming her anywhere renames every card. Renaming a character card
  renames the cast record.
- Places, research notes and themes work the same way (`sourceKind`,
  `sourceId`): linked, never copied.
- Any card can be made **reusable** (menu or inspector). It then appears in
  the library's *Plot & scenes* and can be placed again.
- **Duplicate placement** makes another card of the same definition.
  **Paste inside as new items** clones the board's own definitions
  (characters stay the same characters). Ordinary paste keeps them shared.
- **Deleting a card** takes the card and its branch. Definitions, the other
  placements and the cast stay. **Deleting a definition** (✕ in the library)
  takes every placement of it, and never the project record it stands for.
- Local context stays on the card: a character's *Scene objective* in one
  scene is not her objective in another.

## 5. Nested navigation

- **Double-click a card, or press Enter, to open it as its own map.** The
  canvas then shows that card and what is under it, with breadcrumbs back to
  every ancestor and to *Whole story*. Esc goes up one level.
- Each map remembers its camera (zoom and position) while the room is open.
- Connections to cards outside the open map are counted on the card (↗N).
- *Show ancestors* opens every card above the selected one.

## 6. Explode and collapse

What is open is **view state**, kept apart from the story
(`board.viewState`):

- `level`: everything (`all`), a depth (`depth`, root = 0), or a type
  (`type`: a branch folds at a card whose type ranks at or past it). The
  ranks are Frame 0, Plot point 1, Scene 2, Character 3, Action and Beat 4,
  Note and Custom 5.
- `open` and `closed`: branches the writer opened or folded by hand, which
  win over the level.
- `rootId`: the card shown as a mini map.
- `hiddenLinkTypes`: link types switched off in Views.

**Explode all** clears every fold and shows the whole hierarchy.
**Collapse all** returns to the frames. **Collapse to** applies a preset or
a depth. **Explode branch** opens one card and everything under it, leaving
the rest as it was. **Collapse branch** folds that card only, and what was
open under it stays open for next time.

Cross-links survive every fold. A link into a folded branch is drawn to the
card standing in for its hidden end (dotted, with *(inside)* on the label).
Several links between the same two shown cards are drawn once with ×N. A link
whose ends both fold into one card is counted on it (⇄N).

## 7. Connections

**Containment** (parent to child) and **cross-links** are different things.

- Containment never loops: a card cannot go under itself or anything under
  it (`canReparent`). Each card has one parent.
- Cross-links join any two cards and may loop. Types: Related to, Causes,
  Appears in, Sets up / pays off, Conflict, Influences, Custom. Each has a
  label and may or may not have a direction.
- Make one by dragging from a card's ● port to another card, with **Connect**
  in the toolbar, or with *Connect to…* on the right-click. Select a line or
  its label to edit its kind, label and direction, reverse it, or delete it.

## 8. The canvas

- `mapPicture` lays out what is open as a tree from left to right, each
  card's children stacked to its right and centred on it. It is
  deterministic: the same story always draws the same.
- **Dragging a card** onto another card moves it, and its branch, inside that
  card. If that takes a beat or a character out of its scene, the room asks
  first and says the script is not changed. Dropped on empty canvas, the card
  stays where it was put (`board.layout`), and its branch moves with it.
- **Auto layout** forgets hand placements; the story is untouched.
- Under 55% zoom the cards are drawn simplified, with a large title and
  badge, so they stay legible.
- Over 300 cards only those near the window are drawn. The layout,
  summaries and link aggregation are single-pass and indexed. 5,000 cards
  with 800 links lay out well inside a second (tested).
- **Views** saves the current open state and hand layout under a name and
  reapplies it.

## 8a. Export: PNG, PDF and JSON

**Export** on the toolbar offers five things: a PNG image or a PDF of the map
*as shown on the canvas* (the folds, the open mini map and the hand
placement as they are), or of *the whole story, every card open*. Exporting
everything never changes the view: the board is exploded in memory only
(`explodedBoard`).

- One picture serves both: `sculptMapSvg` draws the cards (type stripe,
  badge, two-line title, type, *in N places*, *in the script*, the hidden
  count on a folded card), the containment lines, and the cross-links with
  their arrows and labels, from the same layout the canvas uses. Dark ink on
  white, with the project title and a count of cards and connections at the
  top.
- **PNG**: the room draws that SVG on a canvas at twice its size (the
  longest side held under 16,000 pixels) and saves it where the writer says,
  beside the project, as *Title story map.png*.
- **PDF**: `sculptMapHtml` puts it on one page the shape of the map, at
  least Letter on its long side and up to 48 inches, so a big map is a big
  page rather than small type. It goes through the same PDF window as every
  other export (kind `map`); in the browser preview it opens for the
  browser's own Save as PDF.

- **JSON data** (`sculptMapJson`) is the whole map as structured data,
  whatever is folded: `format: "vc-writer-story-map"`, `version: 1`, the
  project and board, counts, the **definitions** (with the live name of the
  cast member, place or note each stands for, and how many placements it
  has), the **cards** in reading order (id, parent, order among siblings,
  depth, the path of titles above it, type, title, note, details, the
  definition it places, and its script binding with the scene or beat
  title), the **connections** (type, label, direction), and the view, hand
  layout and saved views. Saved beside the project as *Title story map.json*,
  indented so a person can read it too.

## 8b. Import: JSON

**Import…** on the toolbar reads a story map that *Export › JSON data* wrote,
from this project or another (`parseMapJson`, `importMapJson`).

- The file is checked before anything changes. Not JSON, not a story map, a
  newer version than this build reads, or a damaged file each get one plain
  sentence on the status line, and nothing is imported.
- A dialog shows what is in it (cards, reusable items, connections) and asks
  where it goes: **as a new map in this project** (the default), or **into
  this map**, under the selected card (or the card shown as a mini map, or at
  the top), after what is already there. **Nothing already here changes.**
- Every card, definition and connection gets a new id, so importing the same
  file twice gives two copies and never a collision. Order among siblings,
  types, titles, notes and details come across as they were. A file whose
  parents loop is cut at the loop rather than refused.
- **Characters** are matched to the cast by id, then by name (ignoring
  case); anyone the cast does not have is added to it. **Places, research
  notes and themes** are matched the same way; one that is not here stays on
  the map as a map-only item with its name. A character already defined on
  the open map is reused, never defined twice.
- **Script links** are kept only where that scene or beat exists in this
  project and nothing else (a card or an outline row) already stands for it,
  so importing a map back into its own project never binds one scene twice.
- A new map brings its view: folds, hand layout and saved views. Imported
  into the open map, the writer's own view stays as it is, and the card it
  landed under is opened.
- The status line says what happened: cards and connections imported, how
  many items linked to what the project already has, who was added to the
  cast, what stayed map-only, and how many script links were left off.

With more than one map, the toolbar shows a **Which map** list, **✎** to
rename the map and **✕** to remove it (with a question first; the script,
cast and research are not touched, and Undo brings it back).

## 9. Keys

Enter opens; Esc clears, then goes up a level; arrows walk the visible tree;
Tab adds the usual child (Frame → Scene → Character → Action → Note); F2
renames; Delete asks; Ctrl+C / Ctrl+V copy and paste a branch (Shift for new
items); Ctrl+F searches; Ctrl+Z / Shift+Ctrl+Z undo and redo. Every drag has
a click alternative: palette and library items place on click, Connect is a
button, and the right-click menu moves cards.

## 10. Search

Search covers titles, notes, details and type names, including inside folded
branches. Each result shows its path (*Act one › The warehouse › Mara*).
Choosing one opens its ancestors, leaves a mini map that does not contain
it, selects it and centres it.

## 11. The script, and the rest of VC Writer

- **Scenes and beats** bind to the script exactly as in version 1: *Add to
  track* (create in VC Writer, with the beats under it), or *link an
  existing* scene or beat. Bound cards rename both ways, and *Open scene* or
  *Open beat* goes to it. A beat under a character under a scene still
  belongs to that scene (`sceneOf`).
- **Nothing in the script changes on its own.** Moving or deleting a card
  never moves, rewrites or deletes a scene. When a bound card's order
  disagrees with the script, the inspector says so and offers *Move to
  match*.
- The library's *In the script* lists scenes not yet on the map; placing one
  makes a scene card linked to it.
- Characters, places and research are linked, not copied, and *Open in
  Research* goes to them.
- Phone notes, research and outline rows dropped from the Notes shelf onto a
  card land inside it, as before. The Outliner's *carry to the board* and the
  board's *carry to the outline* still work; rows arrive as typed cards.

## 12. Storage

The same document and the same three tables carry v2. Migration
`0076_story_sculptor_v2` adds:

- **boards**: `schema_version`, `entities`, `view_state`, `layout`, `views`,
  `legacy` (jsonb, read and written whole with the board, like `columns`).
- **sculptor_nodes**: `subtype`, `entity_id`; `column_id` now nullable.
- **sculptor_links**: `link_type`, `directed`.

A card's type is its `kind`. Row-level security, cascades and indexes are
unchanged; `sculptor_nodes_entity_idx` is new. The advisors raised nothing
new.

## 13. Version 1, upgraded

When a project is opened, every version-1 board is upgraded once
(`upgradeBoards`, called from `parseProjectFile` and again when the room
opens). The written mapping:

| Version 1 | Version 2 |
| --- | --- |
| Structure column card | Frame, top level, same order |
| Beginning / End | Ordinary frames with the same titles |
| Scene column card | Scene |
| Beat column card | Beat |
| Writer's own column card | Custom, named after the column |
| A kind the writer typed | That type if v2 has it, else Custom named so |
| Column field answers (by field id) | Details, by the field's name |
| People on a card (`characterIds`) | Character placements under the card |
| Folded card | A closed branch in the view state |
| Binding to a scene or beat | Kept as it is |
| Writer's links | Kept, as *Related to*, directed as drawn |

Nothing is dropped. The upgrade is idempotent (a version-2 board is returned
as it is) and logs what it did (`UpgradeLog`).

**Rollback.** The version-1 board is kept whole in `board.legacy`, and the
columns and each card's `column_id` stay on migrated boards.
`downgradeBoard` puts the old board back exactly (tested). The cloud held no
version-1 boards when this shipped (0 boards, 0 nodes), so the upgrade only
ever runs on local files.

## 14. Definition of done (spec §14)

| Criterion | Where it is met |
| --- | --- |
| One Sculptor entry, opening v2 | Same button, room and pane; the column board's code is gone |
| Frame → scene → character → action and deeper | `sculptor-v2.test.ts` |
| Palette creates; library reuses with canonical identity | `sculptor.test.tsx` (desktop), `sculptor-v2.test.ts` |
| Colour-coded cards, type labels, corner dots | §3; desktop test checks badges and dots |
| Mini maps, breadcrumbs, state kept | §5; desktop test |
| Explode all, Collapse all, presets, per-branch | §6; both test files |
| Cross-links persist through folds, save/reload and reparenting | `sculptor-v2.test.ts` (file and database round trips) |
| No containment cycles; deleting a placement keeps the master | `sculptor-v2.test.ts` |
| Version-1 boards migrated safely; links to VC Writer stay valid | §13; upgrade tests; binding tests unchanged in substance |
| Tests for migration, graph ops, relationships, indicators, save/reopen, legacy retirement | `sculptor-v2.test.ts`, `sculptor-binding.test.ts`, `crossing.test.ts`, `sync-plans.test.ts`, desktop `sculptor.test.tsx` |

All three optional exports of spec §11 (PNG, PDF, JSON) are built (§8a), and JSON reads back in (§8b).

## 15. Code

- `packages/domain/src/entities/sculptor.ts`: the schema (board, card,
  definition, link, view state, saved view).
- `packages/domain/src/sculptor.ts`: every operation, the view state,
  `mapPicture`, `drawnLinks`, `nestedSummaries`, `searchBoard`.
- `packages/domain/src/sculptor-types.ts`: types, colours, badges, details,
  ranks, link kinds.
- `packages/domain/src/sculptor-upgrade.ts`: version 1 to 2, and back.
- `packages/domain/src/sculptor-binding.ts`: the script link.
- `packages/domain/src/sculptor-map.ts`: the minimap.
- `apps/desktop/src/renderer/components/SculptorWindow.tsx`: the room.
