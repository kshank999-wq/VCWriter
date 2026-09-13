import { describe, expect, it } from 'vitest';
import {
  RELATIONSHIP_KIND_NAMES,
  addCharacter,
  answerRelationship,
  createProjectFile,
  relate,
  relationshipName,
  relationshipsOf,
  removeRelationship,
  updateRelationship,
  type ProjectFile,
} from '../index.js';

/**
 * Relationships (addendum 08, stage 7 — §11).
 *
 * **The two directions are allowed to disagree, and that is the requirement.**
 * *A trusts B while B is manipulating A* is two records; a model that stored one
 * per pair would have to pick which of those two sentences to keep, and the
 * drama is the difference between them.
 */

const cast = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  file = addCharacter(file, { name: 'MARA' });
  const mara = file.characters[file.characters.length - 1]!.id;
  file = addCharacter(file, { name: 'DEAKINS' });
  const deakins = file.characters[file.characters.length - 1]!.id;
  return { file, mara, deakins };
};

describe('one person read against another', () => {
  it('keeps both readings of a pair, and they may say opposite things', () => {
    const { file, mara, deakins } = cast();
    const one = relate(file, {
      fromCharacterId: mara,
      toCharacterId: deakins,
      kind: 'friend',
      description: 'She thinks he is the only one who never asked her for anything.',
      state: 'Trusts him completely.',
    });
    const two = relate(one.file, {
      fromCharacterId: deakins,
      toCharacterId: mara,
      kind: 'dependency',
      description: 'He needs what she can be talked into.',
      state: 'Working her, carefully.',
    });

    const hers = relationshipsOf({ characterId: mara as string, file: two.file });
    expect(hers.outward).toHaveLength(1);
    expect(hers.outward[0]!.otherName).toBe('DEAKINS');
    expect(hers.outward[0]!.relationship.state).toBe('Trusts him completely.');
    expect(hers.inward).toHaveLength(1);
    expect(hers.inward[0]!.relationship.state).toBe('Working her, carefully.');
  });

  it('refuses a relationship with oneself', () => {
    const { file, mara } = cast();
    expect(relate(file, { fromCharacterId: mara, toCharacterId: mara }).relationship).toBeNull();
  });

  it('refuses a second identical reading and hands back the one there', () => {
    const { file, mara, deakins } = cast();
    const once = relate(file, { fromCharacterId: mara, toCharacterId: deakins, kind: 'rival' });
    const twice = relate(once.file, { fromCharacterId: mara, toCharacterId: deakins, kind: 'rival' });

    expect(twice.file.characterRelationships).toHaveLength(1);
    expect(twice.relationship!.id).toBe(once.relationship!.id);
  });

  it('allows the same pair twice when the reading differs', () => {
    // Two things can be true at once: rivals at work, family at home.
    const { file, mara, deakins } = cast();
    const one = relate(file, { fromCharacterId: mara, toCharacterId: deakins, kind: 'rival' });
    const two = relate(one.file, { fromCharacterId: mara, toCharacterId: deakins, kind: 'family' });

    expect(two.file.characterRelationships).toHaveLength(2);
  });

  it('takes away one reading and leaves the other standing', () => {
    const { file, mara, deakins } = cast();
    const one = relate(file, { fromCharacterId: mara, toCharacterId: deakins, kind: 'friend' });
    const two = relate(one.file, { fromCharacterId: deakins, toCharacterId: mara, kind: 'dependency' });
    const after = removeRelationship(two.file, one.relationship!.id);

    expect(after.characterRelationships).toHaveLength(1);
    expect(relationshipsOf({ characterId: mara as string, file: after }).outward).toHaveLength(0);
    expect(relationshipsOf({ characterId: mara as string, file: after }).inward).toHaveLength(1);
  });
});

describe('the other way round', () => {
  it('says when a reading has not been answered', () => {
    const { file, mara, deakins } = cast();
    const one = relate(file, { fromCharacterId: mara, toCharacterId: deakins, kind: 'friend' });
    expect(relationshipsOf({ characterId: mara as string, file: one.file }).outward[0]!.answered).toBe(
      false,
    );

    const two = relate(one.file, { fromCharacterId: deakins, toCharacterId: mara, kind: 'enemy' });
    expect(relationshipsOf({ characterId: mara as string, file: two.file }).outward[0]!.answered).toBe(
      true,
    );
  });

  it('opens an empty reading rather than copying the first one', () => {
    // Copying the description across would be the module putting words in
    // somebody else's mouth; the point of the second row is that it may say
    // something completely different.
    const { file, mara, deakins } = cast();
    const one = relate(file, {
      fromCharacterId: mara,
      toCharacterId: deakins,
      kind: 'friend',
      description: 'The only one who never asked her for anything.',
      state: 'Trusts him.',
    });
    const back = answerRelationship(one.file, one.relationship!.id);

    expect(back.relationship!.fromCharacterId).toBe(deakins);
    expect(back.relationship!.toCharacterId).toBe(mara);
    expect(back.relationship!.description).toBe('');
    expect(back.relationship!.state).toBe('');
  });
});

describe('what it is called', () => {
  it('prefers the label the writer wrote to the kind', () => {
    const { file, mara, deakins } = cast();
    const one = relate(file, {
      fromCharacterId: mara,
      toCharacterId: deakins,
      kind: 'custom',
      label: 'Owes him for the Tulsa thing',
    });
    expect(relationshipName(one.relationship!)).toBe('Owes him for the Tulsa thing');
  });

  it('falls back to the kind when there is no label', () => {
    const { file, mara, deakins } = cast();
    const one = relate(file, { fromCharacterId: mara, toCharacterId: deakins, kind: 'mentor' });
    expect(relationshipName(one.relationship!)).toBe(RELATIONSHIP_KIND_NAMES.mentor);
  });

  it('carries a history, a state now, and how it changes', () => {
    const { file, mara, deakins } = cast();
    const one = relate(file, { fromCharacterId: mara, toCharacterId: deakins, kind: 'friend' });
    const after = updateRelationship(one.file, one.relationship!.id, {
      description: 'They came up together on the night shift.',
      state: 'Cold since the audit.',
      evolution: 'Colder, then useful again in the third act.',
    });

    const row = relationshipsOf({ characterId: mara as string, file: after }).outward[0]!;
    expect(row.relationship.description).toContain('night shift');
    expect(row.relationship.state).toBe('Cold since the audit.');
    expect(row.relationship.evolution).toContain('third act');
  });
});
