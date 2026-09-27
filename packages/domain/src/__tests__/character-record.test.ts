import { describe, expect, it } from 'vitest';
import {
  CHARACTER_ROLES,
  addCharacter,
  addCustomField,
  createProjectFile,
  characterSchema,
  fromRows,
  newId,
  removeCustomField,
  toRows,
  updateCharacter,
  updateCustomField,
  type CharacterId,
  type ProjectFile,
} from '../index.js';

/**
 * The character record the Overview asks for (addendum 25 §3, stage 1).
 *
 * Three fields, and the first is a **correction**: `tags` (addendum 08 §5)
 * was given the writer's own shorthand for *who somebody is* and the book's
 * own topics at once — *antagonist* beside *money*, *grief*, *the Christmas
 * thread* — which is one field answering two questions. `role` takes the
 * first and tags keep the second.
 */

const peopled = (): { file: ProjectFile; characterId: CharacterId } => {
  let file = createProjectFile({ title: 'The Ledger', format: 'novel' });
  file = addCharacter(file, { name: 'Silas Crane' });
  return { file, characterId: file.characters[file.characters.length - 1]!.id };
};

const person = (file: ProjectFile, id: CharacterId) => file.characters.find((one) => one.id === id)!;

describe('the record', () => {
  it('starts with no role, no background and no fields of the writer’s own', () => {
    // Nothing about a character made before this moves: every one of the three
    // has a default, so a project written last week reads exactly as it did.
    const { file, characterId } = peopled();
    const made = person(file, characterId);
    expect(made.role).toBe('');
    expect(made.background).toEqual({ age: '', look: '', history: '' });
    expect(made.customFields).toEqual([]);
  });

  it('takes a role from the six, or the writer’s own words', () => {
    const { file, characterId } = peopled();
    // Offered, never imposed: the field is text, so the chips are a shortcut
    // rather than the vocabulary.
    expect(CHARACTER_ROLES).toContain('Protagonist');
    const chipped = updateCharacter(file, characterId, { role: 'Protagonist' });
    expect(person(chipped, characterId).role).toBe('Protagonist');
    const own = updateCharacter(chipped, characterId, { role: 'The one who knows' });
    expect(person(own, characterId).role).toBe('The one who knows');
  });

  it('keeps the role and the tags apart, which is the whole of the correction', () => {
    const { file, characterId } = peopled();
    const set = updateCharacter(file, characterId, {
      role: 'Protagonist',
      tags: ['money', 'grief', 'the Christmas thread'],
    });
    expect(person(set, characterId).role).toBe('Protagonist');
    expect(person(set, characterId).tags).not.toContain('Protagonist');
  });

  it('holds the optional half without making it the point', () => {
    const { file, characterId } = peopled();
    const set = updateCharacter(file, characterId, {
      background: { age: '64', look: 'Frayed black coat', history: 'Inherited the mill.' },
    });
    expect(person(set, characterId).background.look).toBe('Frayed black coat');
    // One field of the three is a perfectly ordinary state.
    const half = updateCharacter(set, characterId, {
      background: { ...person(set, characterId).background, history: '' },
    });
    expect(person(half, characterId).background).toEqual({ age: '64', look: 'Frayed black coat', history: '' });
  });
});

describe('the writer’s own fields', () => {
  /**
   * **A list rather than a map**, which is what lets a field be renamed: the
   * id is what a rename holds onto, where a map would have the name as the key
   * and renaming would be a delete and an add that loses the value.
   */
  it('renames a field and keeps what is in it', () => {
    const { file, characterId } = peopled();
    const made = addCustomField(file, characterId, 'Voice');
    const field = person(made, characterId).customFields[0]!;
    const filled = updateCustomField(made, characterId, field.id, {
      value: 'Clipped. Answers questions with prices.',
    });
    const renamed = updateCustomField(filled, characterId, field.id, { name: 'How he talks' });
    const after = person(renamed, characterId).customFields[0]!;
    expect(after.id).toBe(field.id);
    expect(after.name).toBe('How he talks');
    expect(after.value).toBe('Clipped. Answers questions with prices.');
  });

  it('keeps them in the order they were made, and takes one away', () => {
    const { file, characterId } = peopled();
    let made = addCustomField(file, characterId, 'Voice');
    made = addCustomField(made, characterId, 'Smell');
    made = addCustomField(made, characterId, 'Handwriting');
    expect(person(made, characterId).customFields.map((one) => one.name)).toEqual([
      'Voice',
      'Smell',
      'Handwriting',
    ]);
    const gone = removeCustomField(made, characterId, person(made, characterId).customFields[1]!.id);
    expect(person(gone, characterId).customFields.map((one) => one.name)).toEqual(['Voice', 'Handwriting']);
  });

  it('does nothing at all where there is no such person', () => {
    const { file } = peopled();
    const nobody = 'not-a-character' as CharacterId;
    expect(addCustomField(file, nobody)).toBe(file);
    expect(updateCustomField(file, nobody, 'x', { name: 'y' })).toBe(file);
    expect(removeCustomField(file, nobody, 'x')).toBe(file);
  });
});

describe('the round trip', () => {
  /**
   * The claim the module makes to a writer is that what they typed is there on
   * the second machine (addendum 08 stage 1). Migration 0053 carries the three.
   */
  it('takes the whole record to the rows and back', () => {
    const { file, characterId } = peopled();
    let set = updateCharacter(file, characterId, {
      role: 'The one who knows',
      background: { age: '64', look: 'Frayed black coat', history: 'Inherited the mill.' },
      tags: ['money'],
    });
    set = addCustomField(set, characterId, 'Voice');
    set = updateCustomField(set, characterId, person(set, characterId).customFields[0]!.id, {
      value: 'Clipped.',
    });

    const back = fromRows(toRows(set));
    const after = back.characters.find((one) => one.id === characterId)!;
    expect(after.role).toBe('The one who knows');
    expect(after.background).toEqual({ age: '64', look: 'Frayed black coat', history: 'Inherited the mill.' });
    expect(after.customFields).toEqual(person(set, characterId).customFields);
    expect(after.tags).toEqual(['money']);
  });

  it('reads a row written before 0053 as a record with none of the three', () => {
    // The columns are absent rather than null on an older row; the schema's own
    // defaults are what fill them, which is why the reader hands `undefined`
    // rather than an empty object.
    const older = characterSchema.parse({
      id: newId(),
      projectId: newId(),
      name: 'Silas Crane',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(older.role).toBe('');
    expect(older.background).toEqual({ age: '', look: '', history: '' });
    expect(older.customFields).toEqual([]);
  });
});
