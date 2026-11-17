import { describe, expect, it } from 'vitest';
import { applyCategoryCommand, emptySitting, hear, readCategoryCommand, readSpoken, readTurn, spokenVocabulary, type CategoryChoices, type Sitting } from '../index.js';

/**
 * The writer's own categories by voice (from Ken, 16 November: *do the phone
 * categories by voice*): made and deleted by saying so, and heard by name.
 */
const say = (sitting: Sitting, ...lines: string[]): Sitting => lines.reduce((at, line) => hear(at, line, 'screenplay'), sitting);

describe('own categories by voice', () => {
  it('makes one, which is then heard by its name', () => {
    const made = say(emptySitting(), 'command new category Mara');
    expect(made.categoriesChanged).toBe(true);
    expect(made.categories?.own).toEqual(['Mara']);
    expect(made.said).toMatch(/New category: Mara/);

    const noted = say(made, 'command Mara she hides the letter', 'command done');
    expect(noted.filed.at(-1)).toMatchObject({ key: 'my:Mara' });
    expect(noted.filed.at(-1)?.text).toMatch(/she hides the letter/i);
    expect(noted.categoriesChanged).toBe(false);
  });

  it('does not make one twice, or one a built-in already answers to', () => {
    const once = say(emptySitting(), 'command new category Mara');
    expect(say(once, 'command add a category mara').categoriesChanged).toBe(false);
    expect(say(emptySitting(), 'command new category idea').said).toMatch(/already a category/);
  });

  it('deletes one, and no longer hears it', () => {
    const choices: CategoryChoices = { own: ['Mara', 'Act Two'], hidden: [] };
    const dropped = say({ ...emptySitting(), categories: choices }, 'command delete category act two');
    expect(dropped.categories?.own).toEqual(['Mara']);
    expect(readTurn('command act two', { open: false, format: 'screenplay', choices: dropped.categories! }).kind).toBe('unknown');
    expect(say(dropped, 'command delete category Lighthouse').said).toMatch(/no category called/);
  });

  it('does not hear a built-in the writer hid', () => {
    const choices: CategoryChoices = { own: [], hidden: ['theme'] };
    expect(spokenVocabulary('screenplay', choices).some((one) => one.key === 'theme')).toBe(false);
    expect(readTurn('command theme loss', { open: false, format: 'screenplay', choices }).kind).toBe('unknown');
    expect(readTurn('command theme loss', { open: false, format: 'screenplay' }).kind).toBe('start');
  });
});

describe('own categories in the note screen’s own dictation', () => {
  it('hears new and delete category, with or without the command word', () => {
    expect(readCategoryCommand('new category Mara.')).toEqual({ kind: 'new', name: 'Mara' });
    expect(readCategoryCommand('command delete category Act two')).toEqual({ kind: 'drop', name: 'Act two' });
    expect(readCategoryCommand('she walks into the room')).toBeNull();
    const made = applyCategoryCommand('novel', { own: [], hidden: [] }, { kind: 'new', name: 'Mara' });
    expect(made.choices.own).toEqual(['Mara']);
    expect(made.said).toMatch(/New category: Mara/);
  });

  it('files dictation under an own category said at the start', () => {
    const said = readSpoken('Mara she keeps the key', 'screenplay', { own: ['Mara'], hidden: [] });
    expect(said).toMatchObject({ kind: 'category', category: 'my:Mara' });
    expect(readSpoken('Mara she keeps the key', 'screenplay').kind).toBe('none');
  });
});
