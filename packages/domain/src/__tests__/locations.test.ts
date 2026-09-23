import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addDescription,
  addLocation,
  addUnit,
  buriedPlacesInScript,
  createProjectFile,
  describeLocations,
  fromRows,
  insertDescription,
  locationOfScene,
  locationsInOrder,
  placesWithoutRecords,
  removeLocation,
  renameLocation,
  restoreFromGraveyard,
  sceneHeadingOf,
  setSceneHeading,
  timesUsed,
  toRows,
  unitsInStoryOrder,
  updateDescription,
  useLocationInScene,
  usedIn,
  type ProjectFile,
} from '../index.js';

/**
 * Locations (addendum 14).
 *
 * Three claims. **A location fills a heading in and never owns one** — so a
 * scene set at night is a scene, not a second house. **Which scenes use a place
 * is a reading of their headings**, so editing one by hand moves the scene with
 * nothing running. And **an inserted description is a snapshot**, so editing the
 * master never rewrites a page that has been written.
 */

const script = (scenes: number) => {
  let file: ProjectFile = createProjectFile({ title: 'The House', format: 'screenplay' });
  const trackId = file.tracks[0]!.id;
  for (let at = 0; at < scenes; at += 1) {
    const scene = addUnit(file, { trackId, title: `Scene ${at + 1}` });
    file = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' }).file;
  }
  return { file, ids: unitsInStoryOrder(file).map((unit) => unit.id) };
};

describe('a location fills a heading in', () => {
  it('writes the place, and takes its defaults where the scene says nothing', () => {
    const { file, ids } = script(1);
    const made = addLocation(file, { name: 'Miller House', setting: 'EXT.', time: 'NIGHT' });
    const used = useLocationInScene(made.file, ids[0]!, made.location.id);

    expect(sceneHeadingOf(used, ids[0]!)).toEqual({ setting: 'EXT.', place: 'MILLER HOUSE', time: 'NIGHT' });
  });

  it('leaves a time the scene already set, because naming the place is not undoing it', () => {
    const { file, ids } = script(1);
    const made = addLocation(file, { name: 'Miller House', setting: 'INT.', time: 'DAY' });
    let current = setSceneHeading(made.file, ids[0]!, { setting: 'INT.', place: 'ELSEWHERE', time: 'NIGHT' });
    current = useLocationInScene(current, ids[0]!, made.location.id);

    expect(sceneHeadingOf(current, ids[0]!)).toEqual({ setting: 'INT.', place: 'MILLER HOUSE', time: 'NIGHT' });
  });

  it('takes an override for this scene without touching the record', () => {
    const { file, ids } = script(1);
    const made = addLocation(file, { name: 'Miller House', setting: 'INT.', time: 'DAY' });
    const used = useLocationInScene(made.file, ids[0]!, made.location.id, { time: 'NIGHT' });

    expect(sceneHeadingOf(used, ids[0]!)!.time).toBe('NIGHT');
    // The master record still says DAY: a scene at night is a scene.
    expect(used.locations[0]!.time).toBe('DAY');
  });
});

describe('which scenes use it is a reading', () => {
  it('finds them by what their headings say', () => {
    const { file, ids } = script(3);
    const made = addLocation(file, { name: 'Miller House' });
    let current = useLocationInScene(made.file, ids[0]!, made.location.id);
    current = useLocationInScene(current, ids[2]!, made.location.id);

    expect(usedIn(current, made.location.id).map((one) => one.id)).toEqual([ids[0], ids[2]]);
    expect(timesUsed(current, made.location.id)).toBe(2);
  });

  it('follows a heading edited by hand, with nothing stored to keep in step', () => {
    const { file, ids } = script(2);
    const made = addLocation(file, { name: 'Miller House' });
    let current = useLocationInScene(made.file, ids[0]!, made.location.id);
    expect(timesUsed(current, made.location.id)).toBe(1);

    // The writer retypes the heading. No membership list to update.
    current = setSceneHeading(current, ids[0]!, { setting: 'INT.', place: 'THE BOAT', time: 'DAY' });
    expect(timesUsed(current, made.location.id)).toBe(0);
    expect(locationOfScene(current, ids[0]!)).toBeNull();
  });

  it('offers a place named in the script that has no record', () => {
    const { file, ids } = script(2);
    const current = setSceneHeading(file, ids[0]!, { setting: 'INT.', place: 'THE BOAT', time: 'DAY' });
    expect(placesWithoutRecords(current)).toEqual(['THE BOAT']);

    const made = addLocation(current, { name: 'The Boat' });
    expect(placesWithoutRecords(made.file)).toEqual([]);
  });
});

describe('renaming', () => {
  it('carries the new name into the scenes that use it', () => {
    const { file, ids } = script(2);
    const made = addLocation(file, { name: 'Miller House' });
    let current = useLocationInScene(made.file, ids[0]!, made.location.id);
    current = useLocationInScene(current, ids[1]!, made.location.id);

    const renamed = renameLocation(current, made.location.id, 'The Miller place');
    expect(renamed.locations[0]!.name).toBe('THE MILLER PLACE');
    expect(sceneHeadingOf(renamed, ids[0]!)!.place).toBe('THE MILLER PLACE');
    expect(timesUsed(renamed, made.location.id)).toBe(2);
  });

  it('does not touch prose the writer has written', () => {
    const { file, ids } = script(1);
    let current = addLocation(file, { name: 'Miller House' }).file;
    const locationId = current.locations[0]!.id;
    current = addDescription(current, locationId, { title: 'Initial reveal', body: 'The house leans west.' });
    current = useLocationInScene(current, ids[0]!, locationId);
    current = insertDescription(current, ids[0]!, locationId, current.locations[0]!.descriptions[0]!.id);

    const renamed = renameLocation(current, locationId, 'The Boat');
    const beat = renamed.beats.find((one) => one.unitId === ids[0]);
    // The heading changed; the paragraph did not.
    expect(sceneHeadingOf(renamed, ids[0]!)!.place).toBe('THE BOAT');
    expect(beat!.manuscript.elements.some((one) => one.text === 'The house leans west.')).toBe(true);
  });
});

describe('a description is a snapshot', () => {
  it('goes in after the heading, as ordinary text', () => {
    const { file, ids } = script(1);
    let current = addLocation(file, { name: 'Miller House' }).file;
    const locationId = current.locations[0]!.id;
    current = addDescription(current, locationId, {
      title: 'Initial reveal',
      body: 'The house leans west.\n\nNobody has painted it since the war.',
    });
    current = useLocationInScene(current, ids[0]!, locationId);
    const after = insertDescription(current, ids[0]!, locationId, current.locations[0]!.descriptions[0]!.id);

    const elements = after.beats.find((one) => one.unitId === ids[0])!.manuscript.elements;
    expect(elements[0]!.type).toBe('scene_heading');
    expect(elements[1]!.text).toBe('The house leans west.');
    expect(elements[2]!.text).toBe('Nobody has painted it since the war.');
    expect(elements[1]!.type).toBe('action');
  });

  it('does not change when the master description is edited afterwards', () => {
    const { file, ids } = script(1);
    let current = addLocation(file, { name: 'Miller House' }).file;
    const locationId = current.locations[0]!.id;
    current = addDescription(current, locationId, { title: 'Initial reveal', body: 'The house leans west.' });
    const descriptionId = current.locations[0]!.descriptions[0]!.id;
    current = insertDescription(current, ids[0]!, locationId, descriptionId);

    const edited = updateDescription(current, locationId, descriptionId, { body: 'Something else entirely.' });
    const elements = edited.beats.find((one) => one.unitId === ids[0])!.manuscript.elements;
    // Once it is in the scene it is the writer's prose.
    expect(elements.some((one) => one.text === 'The house leans west.')).toBe(true);
    expect(elements.some((one) => one.text === 'Something else entirely.')).toBe(false);
  });

  it('keeps several descriptions, because a place is described differently twice', () => {
    const { file } = script(1);
    let current = addLocation(file, { name: 'Miller House' }).file;
    const locationId = current.locations[0]!.id;
    current = addDescription(current, locationId, { title: 'Initial reveal', body: 'One.' });
    current = addDescription(current, locationId, { title: 'After the fire', body: 'Two.' });

    expect(current.locations[0]!.descriptions.map((one) => one.title)).toEqual([
      'Initial reveal',
      'After the fire',
    ]);
  });

  it('inserts nothing at all when there is nothing to insert', () => {
    const { file, ids } = script(1);
    let current = addLocation(file, { name: 'Miller House' }).file;
    const locationId = current.locations[0]!.id;
    current = addDescription(current, locationId, { title: 'Empty', body: '   ' });
    const after = insertDescription(current, ids[0]!, locationId, current.locations[0]!.descriptions[0]!.id);
    expect(after).toBe(current);
  });
});

describe('the list', () => {
  it('is alphabetical, and says how many are not in the script yet', () => {
    const { file, ids } = script(1);
    let current = addLocation(file, { name: 'The Boat' }).file;
    current = addLocation(current, { name: 'Miller House' }).file;
    const miller = current.locations.find((one) => one.name === 'MILLER HOUSE')!;
    current = useLocationInScene(current, ids[0]!, miller.id);

    expect(locationsInOrder(current).map((one) => one.name)).toEqual(['MILLER HOUSE', 'THE BOAT']);
    expect(describeLocations(current)).toMatch(/1 not in the script yet/);
  });
});

describe('the round trip', () => {
  it('keeps a location and its descriptions through sync', () => {
    const { file } = script(1);
    let current = addLocation(file, { name: 'Miller House', setting: 'EXT.', time: 'NIGHT' }).file;
    const locationId = current.locations[0]!.id;
    current = addDescription(current, locationId, { title: 'Initial reveal', body: 'The house leans west.' });

    const back = fromRows(toRows(current));
    expect(back.locations[0]!.name).toBe('MILLER HOUSE');
    expect(back.locations[0]!.setting).toBe('EXT.');
    expect(back.locations[0]!.time).toBe('NIGHT');
    expect(back.locations[0]!.descriptions[0]!.title).toBe('Initial reveal');
    expect(back.locations[0]!.descriptions[0]!.body).toBe('The house leans west.');
  });
});

/**
 * A deleted place whose name the script still carries (addendum 24 §5l).
 *
 * The module's readings were already clean — everything asks
 * `locationsInOrder` — so the hole was not a stale list but the one reading
 * that must look at the **buried**: the names come off the headings, which a
 * delete never touches, so `placesWithoutRecords` offered to adopt a place
 * whose record was in the graveyard, and adopting it made a second record of
 * the same name.
 */
describe('a deleted place the script still names', () => {
  const named = () => {
    const { file, ids } = script(2);
    const made = addLocation(file, { name: 'Miller House' });
    const used = useLocationInScene(made.file, ids[0]!, made.location.id);
    return { file: used, gone: removeLocation(used, made.location.id), id: made.location.id, ids };
  };

  it('is not offered as a place with no record', () => {
    const { file, gone } = named();
    // Nothing to adopt before, and nothing to adopt after: the record exists.
    expect(placesWithoutRecords(file)).toEqual([]);
    expect(placesWithoutRecords(gone)).toEqual([]);
  });

  it('is named as deleted instead, so the offer is to restore it', () => {
    const { file, gone } = named();
    expect(buriedPlacesInScript(file)).toEqual([]);
    expect(buriedPlacesInScript(gone).map((one) => one.name)).toEqual(['MILLER HOUSE']);

    const back = restoreFromGraveyard(gone, { kind: 'location', id: gone.locations[0]!.id as string });
    expect(locationsInOrder(back).map((one) => one.name)).toEqual(['MILLER HOUSE']);
    expect(buriedPlacesInScript(back)).toEqual([]);
  });

  it('never ends up as two records of one name, which is what restoring promised against', () => {
    const { gone, ids } = named();
    // The scene still says MILLER HOUSE, and the record is buried.
    expect(sceneHeadingOf(gone, ids[0]!)!.place).toBe('MILLER HOUSE');
    const back = restoreFromGraveyard(gone, { kind: 'location', id: gone.locations[0]!.id as string });
    expect(back.locations.filter((one) => one.name === 'MILLER HOUSE')).toHaveLength(1);
    // And the scene is pointed at it again with nothing run.
    expect(locationOfScene(back, ids[0]!)?.name).toBe('MILLER HOUSE');
  });

  it('still offers a place that genuinely has no record at all', () => {
    const { gone, ids } = named();
    const typed = setSceneHeading(gone, ids[1]!, { setting: 'EXT.', place: 'THE PIER', time: 'NIGHT' });
    expect(placesWithoutRecords(typed)).toEqual(['THE PIER']);
  });
});
