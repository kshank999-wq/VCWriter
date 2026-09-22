import { describe, expect, it } from 'vitest';
import {
  addCharacter,
  addLocation,
  addTheme,
  addThread,
  castByCategory,
  createProjectFile,
  describeEmptying,
  emptyGraveyard,
  graveyard,
  graveyardCount,
  locationsInOrder,
  removeCharacter,
  removeLocation,
  removeTheme,
  sendToGraveyard,
  restoreFromGraveyard,
  themesInOrder,
  threadsInOrder,
  type ProjectFile,
} from '../index.js';

/**
 * The graveyard (addendum 24, from Ken: *anything that gets removed or
 * deleted, instead of deleting it permanently, it goes to the graveyard*).
 */

const project = (): ProjectFile => createProjectFile({ title: 'A novel', format: 'novel' });

describe('the graveyard', () => {
  it('takes a deleted record off its list without taking it out of the project', () => {
    const made = addLocation(project(), { name: 'The Miller House' });
    expect(locationsInOrder(made.file)).toHaveLength(1);

    const after = removeLocation(made.file, made.location.id);
    // Off the list…
    expect(locationsInOrder(after)).toHaveLength(0);
    // …and still in the project, which is what makes restoring possible.
    expect(after.locations).toHaveLength(1);
    expect(graveyardCount(after)).toBe(1);
  });

  it('puts it back exactly where it was', () => {
    const made = addLocation(project(), { name: 'The Miller House' });
    const gone = removeLocation(made.file, made.location.id);
    const back = restoreFromGraveyard(gone, { kind: 'location', id: made.location.id as string });
    expect(locationsInOrder(back)).toHaveLength(1);
    // A place is held in the upper case a slugline prints it in.
    expect(locationsInOrder(back)[0]!.name).toBe('THE MILLER HOUSE');
    expect(graveyardCount(back)).toBe(0);
  });

  it('is not the archive: archiving something leaves it out of the graveyard', () => {
    const made = addLocation(project(), { name: 'The Miller House' });
    const archived = { ...made.file, locations: made.file.locations.map((one) => ({ ...one, archived: true })) };
    // Put away deliberately, so it is not a mistake to be undone.
    expect(graveyardCount(archived)).toBe(0);
    expect(locationsInOrder(archived)).toHaveLength(0);
    expect(locationsInOrder(archived, true)).toHaveLength(1);
  });

  it('lists what was deleted most recently first, which is what somebody just made a mistake wants', () => {
    // Stamped explicitly: two deletes inside one millisecond would tie, and
    // what is being asserted here is the order, not the clock.
    let file = project();
    const one = addLocation(file, { name: 'First' });
    file = sendToGraveyard(one.file, { kind: 'location', id: one.location.id as string }, '2026-09-22T10:00:00.000Z');
    const two = addTheme(file, { name: 'Second' });
    file = sendToGraveyard(two.file, { kind: 'theme', id: two.theme.id as string }, '2026-09-22T10:00:05.000Z');
    const rows = graveyard(file);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe('Second');
    expect(rows[0]!.word).toBe('Theme');
    expect(rows[1]!.name).toBe('FIRST');
  });

  it('reaches every kind of record it claims to', () => {
    let file = project();
    const person = addCharacter(file, { name: 'Mara' });
    file = removeCharacter(person, person.characters[person.characters.length - 1]!.id);
    const thread = addThread(file, { name: 'The bell' });
    file = thread.file;
    // The person is buried; the thread, untouched, is still on its own list.
    expect(castByCategory(file).flatMap((group) => group.characters)).toHaveLength(0);
    expect(threadsInOrder(file)).toHaveLength(1);
    expect(graveyard(file).map((row) => row.word)).toEqual(['Character']);
  });

  it('says what emptying would take, and emptying is the one act that destroys', () => {
    const made = addLocation(project(), { name: 'The Miller House' });
    const gone = removeLocation(made.file, made.location.id);
    expect(describeEmptying(gone)).toContain('cannot be undone');
    const emptied = emptyGraveyard(gone);
    expect(emptied.locations).toHaveLength(0);
    expect(graveyardCount(emptied)).toBe(0);
    expect(describeEmptying(emptied)).toBe('The graveyard is empty.');
  });

  it('leaves a record that was never deleted alone, whatever else happens', () => {
    const made = addLocation(project(), { name: 'Kept' });
    const other = addLocation(made.file, { name: 'Deleted' });
    const gone = removeLocation(other.file, other.location.id);
    expect(emptyGraveyard(gone).locations.map((one) => one.name)).toEqual(['KEPT']);
  });

  it('keeps a themes reading and a graveyard reading from disagreeing', () => {
    const made = addTheme(project(), { name: 'Grief' });
    const gone = removeTheme(made.file, made.theme.id);
    expect(themesInOrder(gone)).toHaveLength(0);
    expect(graveyard(gone).map((row) => row.name)).toEqual(['Grief']);
    const back = restoreFromGraveyard(gone, { kind: 'theme', id: made.theme.id as string });
    expect(themesInOrder(back).map((one) => one.name)).toEqual(['Grief']);
    expect(graveyard(back)).toEqual([]);
  });
});
