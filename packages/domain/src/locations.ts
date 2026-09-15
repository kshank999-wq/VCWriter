import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { parseSceneHeading, sceneHeadingOf, setSceneHeading } from './scene-heading.js';
import { locationDescriptionSchema, locationSchema } from './entities/locations.js';
import type { Location, LocationDescription } from './entities/locations.js';
import type { ProjectFile } from './project-file.js';
import type { LocationDescriptionId, LocationId, StructuralUnitId } from './ids.js';
import { isProseFormat } from './formats.js';

/**
 * Locations (addendum 14).
 *
 * Three decisions shape everything here.
 *
 * **A location fills a heading in; it never owns one.** Choosing a place writes
 * `INT. MILLER HOUSE - DAY` into the scene, and from that moment the scene's
 * heading is the scene's: change it to NIGHT and the location is untouched,
 * because a scene at the same house at night is a scene, not a second house.
 * The record holds *defaults*, and §4.2 asks for exactly that.
 *
 * **Which scenes use a location is a reading, never a stored list.** It is
 * worked out by matching the place in each scene's heading, so renaming a scene
 * heading by hand moves it between locations with nothing running, and there is
 * no membership table to drift. `usedIn` is that reading.
 *
 * **An inserted description is a snapshot.** §4.3 is explicit and right: once
 * prepared prose is in the scene it is the writer's text, and editing the
 * master description must never silently rewrite a page that has been written.
 * So insertion copies, and nothing links the two afterwards.
 */

// ------------------------------------------------------------------ records

export const addLocation = (
  file: ProjectFile,
  input: { name: string; setting?: string; time?: string; notes?: string },
): { file: ProjectFile; location: Location } => {
  const at = nowIso();
  const location = locationSchema.parse({
    id: newId<LocationId>(),
    projectId: file.project.id,
    name: input.name.trim().toUpperCase(),
    ...(input.setting === undefined ? {} : { setting: input.setting }),
    ...(input.time === undefined ? {} : { time: input.time }),
    notes: input.notes ?? '',
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, locations: [...(file.locations ?? []), location] }, location };
};

export const updateLocation = (
  file: ProjectFile,
  locationId: LocationId,
  patch: Partial<Pick<Location, 'name' | 'setting' | 'time' | 'shortName' | 'notes' | 'archived'>>,
): ProjectFile => ({
  ...file,
  locations: (file.locations ?? []).map((location) =>
    location.id === locationId
      ? locationSchema.parse({
          ...location,
          ...patch,
          ...(patch.name === undefined ? {} : { name: patch.name.toUpperCase() }),
          updatedAt: nowIso(),
        })
      : location,
  ),
});

/**
 * Rename a place, and rename it in the scenes that use it.
 *
 * §8 asks that renaming update the references without *unexpectedly* rewriting
 * finished text, and the line between the two is the heading: a scene heading
 * is a structural line the program already writes, so carrying the new name
 * into it is a rename. A description already inserted into a scene is prose the
 * writer has edited, and is left exactly alone.
 */
export const renameLocation = (
  file: ProjectFile,
  locationId: LocationId,
  name: string,
): ProjectFile => {
  const location = (file.locations ?? []).find((one) => one.id === locationId);
  const wanted = name.trim().toUpperCase();
  if (!location || wanted.length === 0 || wanted === location.name) {
    return location ? updateLocation(file, locationId, { name }) : file;
  }

  let next = updateLocation(file, locationId, { name: wanted });
  for (const unit of usedIn(file, locationId)) {
    const heading = sceneHeadingOf(next, unit.id);
    if (!heading) continue;
    next = setSceneHeading(next, unit.id, { ...heading, place: wanted });
  }
  return next;
};

export const removeLocation = (file: ProjectFile, locationId: LocationId): ProjectFile => ({
  ...file,
  locations: (file.locations ?? []).filter((location) => location.id !== locationId),
});

// ------------------------------------------------------------- descriptions

export const addDescription = (
  file: ProjectFile,
  locationId: LocationId,
  input: { title: string; body?: string },
): ProjectFile => {
  const at = nowIso();
  const description = locationDescriptionSchema.parse({
    id: newId<LocationDescriptionId>(),
    title: input.title.trim(),
    body: input.body ?? '',
    createdAt: at,
    updatedAt: at,
  });
  return {
    ...file,
    locations: (file.locations ?? []).map((location) =>
      location.id === locationId
        ? { ...location, descriptions: [...location.descriptions, description], updatedAt: at }
        : location,
    ),
  };
};

export const updateDescription = (
  file: ProjectFile,
  locationId: LocationId,
  descriptionId: LocationDescriptionId,
  patch: Partial<Pick<LocationDescription, 'title' | 'body'>>,
): ProjectFile => ({
  ...file,
  locations: (file.locations ?? []).map((location) =>
    location.id === locationId
      ? {
          ...location,
          descriptions: location.descriptions.map((one) =>
            one.id === descriptionId ? { ...one, ...patch, updatedAt: nowIso() } : one,
          ),
          updatedAt: nowIso(),
        }
      : location,
  ),
});

export const removeDescription = (
  file: ProjectFile,
  locationId: LocationId,
  descriptionId: LocationDescriptionId,
): ProjectFile => ({
  ...file,
  locations: (file.locations ?? []).map((location) =>
    location.id === locationId
      ? {
          ...location,
          descriptions: location.descriptions.filter((one) => one.id !== descriptionId),
          updatedAt: nowIso(),
        }
      : location,
  ),
});

// -------------------------------------------------------------- the reading

/** The active locations, alphabetically — the order a picker wants. */
export const locationsInOrder = (file: ProjectFile, includeArchived = false): Location[] =>
  (file.locations ?? [])
    .filter((one) => includeArchived || !one.archived)
    .sort((a, b) => a.name.localeCompare(b.name));

/**
 * The scenes that use a location, by what their heading says.
 *
 * A reading rather than a list, so a heading edited by hand moves the scene
 * between locations with nothing running — and nothing has to be kept in step.
 */
export const usedIn = (file: ProjectFile, locationId: LocationId) => {
  const location = (file.locations ?? []).find((one) => one.id === locationId);
  if (!location || location.name.length === 0) return [];
  return unitsInStoryOrder(file).filter((unit) => {
    const heading = sceneHeadingOf(file, unit.id);
    return heading?.place === location.name;
  });
};

/** How many scenes use it, and whether any do. §10's usage count. */
export const timesUsed = (file: ProjectFile, locationId: LocationId): number =>
  usedIn(file, locationId).length;

/** The location a scene's heading names, where the project knows it. */
export const locationOfScene = (file: ProjectFile, unitId: StructuralUnitId): Location | null => {
  const heading = sceneHeadingOf(file, unitId);
  if (!heading || heading.place.length === 0) return null;
  return (file.locations ?? []).find((one) => one.name === heading.place) ?? null;
};

/**
 * A place named in the script that has no record.
 *
 * Offered so a writer who has been typing headings can adopt them rather than
 * retyping them — which is the only honest way into a module that arrives after
 * the script has started.
 */
export const placesWithoutRecords = (file: ProjectFile): string[] => {
  const known = new Set((file.locations ?? []).map((one) => one.name));
  const found = new Map<string, true>();
  for (const unit of unitsInStoryOrder(file)) {
    const heading = sceneHeadingOf(file, unit.id);
    if (!heading || heading.place.length === 0 || known.has(heading.place)) continue;
    found.set(heading.place, true);
  }
  return [...found.keys()].sort();
};

// -------------------------------------------------------- using one in a scene

/**
 * Put a location into a scene's heading.
 *
 * The scene may override the setting or the time — §4.2's requirement that a
 * scene-specific heading must not corrupt the master record — and what is not
 * overridden comes from the location's defaults. What is already in the
 * heading wins over the default when nothing was asked for, because a writer
 * who has set this scene to NIGHT and then picks the location again meant to
 * name the place, not to undo the time.
 */
export const useLocationInScene = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  locationId: LocationId,
  override: { setting?: string; time?: string } = {},
): ProjectFile => {
  const location = (file.locations ?? []).find((one) => one.id === locationId);
  if (!location) return file;
  const standing = sceneHeadingOf(file, unitId);
  return setSceneHeading(file, unitId, {
    setting: override.setting ?? standing?.setting ?? location.setting,
    place: location.name,
    time: override.time ?? standing?.time ?? location.time,
  });
};

/**
 * Put a prepared description into the scene, as text.
 *
 * **A snapshot, never a link** (§4.3). Once it is in the scene it is the
 * writer's prose: editing the master description afterwards changes nothing
 * that has been written, which is the only behaviour that makes prepared
 * descriptions safe to keep editing.
 *
 * It goes in **after the scene heading** and before whatever follows, because
 * that is where a description of a place goes, and it is inserted as ordinary
 * elements of the format the project is in.
 */
export const insertDescription = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  locationId: LocationId,
  descriptionId: LocationDescriptionId,
): ProjectFile => {
  const location = (file.locations ?? []).find((one) => one.id === locationId);
  const description = location?.descriptions.find((one) => one.id === descriptionId);
  if (!description || description.body.trim().length === 0) return file;

  const beat = beatsForUnit(file, unitId)[0];
  if (!beat) return file;

  const type = isProseFormat(file.project.format) ? 'paragraph' : 'action';
  const made = description.body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((text) => ({
      id: newId<never>() as unknown as string,
      type,
      text,
      characterId: null,
      attributes: {},
    }));
  if (made.length === 0) return file;

  const elements = beat.manuscript.elements;
  // After the heading, where a description of a place goes.
  const headingAt = elements.findIndex((one) => one.type === 'scene_heading');
  const at = headingAt < 0 ? 0 : headingAt + 1;

  return {
    ...file,
    beats: file.beats.map((one) =>
      one.id === beat.id
        ? {
            ...one,
            manuscript: {
              elements: [...elements.slice(0, at), ...made, ...elements.slice(at)] as typeof elements,
            },
            updatedAt: nowIso(),
          }
        : one,
    ),
  };
};

/** What the module owes, in one line. */
export const describeLocations = (file: ProjectFile): string => {
  const active = locationsInOrder(file);
  if (active.length === 0) return 'No locations yet.';
  const unused = active.filter((one) => timesUsed(file, one.id) === 0).length;
  if (unused === 0) return `${active.length} ${active.length === 1 ? 'location' : 'locations'}, all used.`;
  return `${active.length} ${active.length === 1 ? 'location' : 'locations'} · ${unused} not in the script yet`;
};

export { locationDescriptionSchema, locationSchema } from './entities/locations.js';
export type { Location, LocationDescription } from './entities/locations.js';
export { parseSceneHeading };
