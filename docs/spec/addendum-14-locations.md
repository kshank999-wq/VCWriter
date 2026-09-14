# Addendum 14 — Location Research & Scene Integration

Status: **built**, September 2026. From Ken's *VC Writer — Location Research &
Scene Integration Development Specification v1.0*.

A *Locations* research folder existed and held ordinary notes, and the slugline
SmartType offered places already typed into headings. Neither is a location
record. Everything below is new.

## 1. A location fills a heading in; it never owns one

This is the decision the module rests on, and §4.2 asks for it directly.

Choosing a place writes `EXT. MILLER HOUSE - NIGHT` into the scene, taking the
location's defaults for anything the scene has not already said. **From that
moment the heading is the scene's.** Change it to DAY and the record is
untouched — a scene at the same house in daylight is a scene, not a second
house.

So the record holds `setting` and `time` as **defaults, not facts about the
place**, and the screen says so in those words. A writer who picks the location
again after setting this scene to NIGHT meant to name the place, not to undo the
time, so what the scene already says wins over the default.

## 2. Which scenes use a location is a reading

**There is no `scene_locations` table, and the absence is the point.**

`usedIn` matches the place in each scene's heading. Retype a heading by hand and
the scene moves between locations with nothing running; there is no membership
list to drift out of step with what the script actually says. This is the same
absence `usage_links` has for *used* and the book index has for page numbers.

It also gives §10's *unused location* indicator for free, and `placesWithoutRecords`
— the places the script already names that have no record — which is the only
honest way into a module arriving after the script has started: a writer who has
been typing headings adopts them with one press rather than retyping them.

## 3. Several prepared descriptions, and an inserted one is a snapshot

§3.3 asks for several descriptions per location rather than one paragraph, and
the reason holds: a place is described differently the second time it is seen,
and a single field would make the writer overwrite the first description to
write the second. *Initial reveal*, *Night version*, *After the fire*.

**Nothing is inserted because a place was chosen.** Choosing the location and
inserting prose are two separate acts, the second named on its own control —
§3.3 and §4.3 both insist, and they are right: a description appearing
unbidden in a scene is the module writing the script.

**What is inserted is a snapshot.** It goes in after the scene heading as
ordinary elements of the project's format, and nothing links it back. Editing
the master description afterwards changes nothing already written, which is the
only behaviour that makes prepared descriptions safe to go on editing.

## 4. Renaming, and where the line is

§8 asks that renaming update references without *unexpectedly* rewriting
finished text. The line is the heading:

- A **scene heading** is a structural line the program already writes, so the
  new name is carried into every scene that uses the place.
- A **description already inserted** is prose the writer has since edited, and
  is left exactly alone.

Removing a record asks first, and says what goes: the record. The scenes keep
their headings, because a heading is the script and the record is a note about
it. A location can also be **put away** rather than removed.

## 5. Where it is

- **Research ▸ Locations** — the library: name, defaults, notes, the prepared
  descriptions, and the scenes that use it.
- **In the scene's own dialog**, beside the heading it fills in: a picker of
  prepared places, **New location…** which makes one without leaving the scene
  (§5 — a writer sent to Research to name a house will type the heading by hand
  instead, and the library will be empty forever), and, where the place has any,
  a second control to insert one of its descriptions.

## 6. Where the code is

| | |
| --- | --- |
| The record | `packages/domain/src/entities/locations.ts` |
| The module | `packages/domain/src/locations.ts` |
| The library | `apps/desktop/src/renderer/components/LocationsPanel.tsx` |
| In the scene | `apps/desktop/src/renderer/components/SceneDialog.tsx` — `LocationPicker` |
| The table | `packages/supabase/migrations/0048_locations.sql` |

The prepared descriptions ride inside the location row as JSON: they are *parts
of* a location rather than records of their own, nothing else references one,
and a second table would make deleting a place a two-step deletion for no gain.

## 7. What is deliberately not here

- **A stored list of which scenes use a place.** §2.
- **Automatic insertion of a description.** §3.
- **A link between an inserted description and its master.** §3. Once it is in
  the scene it is the writer's prose.
- **Location imagery and mood boards**, **production scouting metadata**, and
  **AI-drafted descriptions** — all named in §10 as follow-on enhancements.
