import { describe, expect, it } from 'vitest';
import {
  NO_CATEGORY_CHOICES,
  addOwnCategory,
  canRemoveNoteCategory,
  captureKeyName,
  captureVocabulary,
  categoryChoices,
  inboxGroups,
  parseCategoryChoices,
  removeNoteCategory,
  restoreBuiltInCategories,
} from '../index.js';

/** The writer's own note categories (addendum 27 §35). */
describe('own categories', () => {
  it('starts as the format’s own list', () => {
    expect(categoryChoices('screenplay').map((one) => one.key)).toEqual(captureVocabulary('screenplay').map((one) => one.key));
  });

  it('adds one, stored as my: and its name, named by that name everywhere', () => {
    const choices = addOwnCategory('screenplay', NO_CATEGORY_CHOICES, '  Mara’s   backstory ');
    const last = categoryChoices('screenplay', choices).at(-1)!;
    expect(last).toEqual({ key: 'my:Mara’s backstory', name: 'Mara’s backstory', takesName: false, own: true });
    expect(captureKeyName(last.key, 'screenplay')).toBe('Mara’s backstory');
    expect(captureKeyName(last.key, null)).toBe('Mara’s backstory');
    expect(last.key.length).toBeLessThanOrEqual(40);
  });

  it('refuses an empty name and a duplicate, and puts back a hidden built-in typed by name', () => {
    let choices = addOwnCategory('screenplay', NO_CATEGORY_CHOICES, '   ');
    expect(choices).toEqual(NO_CATEGORY_CHOICES);
    choices = addOwnCategory('screenplay', choices, 'Locations to scout');
    expect(addOwnCategory('screenplay', choices, 'locations TO scout')).toBe(choices);
    choices = removeNoteCategory('screenplay', choices, 'theme');
    expect(categoryChoices('screenplay', choices).some((one) => one.key === 'theme')).toBe(false);
    choices = addOwnCategory('screenplay', choices, 'theme');
    expect(categoryChoices('screenplay', choices).some((one) => one.key === 'theme')).toBe(true);
    expect(choices.own).toEqual(['Locations to scout']);
  });

  it('deletes its own, hides a built-in, and never empties the list', () => {
    let choices = addOwnCategory('short_form', NO_CATEGORY_CHOICES, 'Shots');
    choices = removeNoteCategory('short_form', choices, 'my:Shots');
    expect(choices.own).toEqual([]);
    choices = removeNoteCategory('short_form', choices, 'unit');
    expect(categoryChoices('short_form', choices).map((one) => one.key)).toEqual(['idea']);
    expect(canRemoveNoteCategory('short_form', choices)).toBe(false);
    expect(removeNoteCategory('short_form', choices, 'idea')).toBe(choices);
    expect(categoryChoices('short_form', restoreBuiltInCategories(choices)).map((one) => one.key)).toEqual(['unit', 'idea']);
  });

  it('reads back what was kept, and survives rubbish', () => {
    expect(parseCategoryChoices('{"own":["A",3],"hidden":["idea"]}')).toEqual({ own: ['A'], hidden: ['idea'] });
    expect(parseCategoryChoices('not json')).toEqual(NO_CATEGORY_CHOICES);
    expect(parseCategoryChoices(null)).toEqual(NO_CATEGORY_CHOICES);
  });

  it('groups notes filed under an own category by its name on the desk', () => {
    const note = { id: 'n1', status: 'pending', category: 'my:Shots', subcategory: null, capturedAt: '2026-11-12T00:00:00Z', rawText: 'wide' };
    const groups = inboxGroups([note] as never, 'screenplay');
    expect(groups.map((one) => one.name)).toEqual(['Shots']);
  });
});
