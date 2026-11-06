// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { checkWord, synonymsOf, setProjectWords, addToDictionary, loadThesaurus } from '../spelling';
import { TextMenu } from '../components/TextMenu';

/**
 * Spelling and the thesaurus on a right-click (from Ken: *it should give you
 * suggestions, thesaurus, and all that, just like the word processor… across
 * every module*), from the program's own dictionary on every platform.
 */
afterEach(cleanup);
beforeAll(async () => {
  await loadThesaurus();
});

describe('the dictionary', () => {
  it('knows ordinary words, flags a misspelling and suggests the word meant', () => {
    expect(checkWord('hamburger').misspelled).toBe(false);
    const wrong = checkWord('hambuger');
    expect(wrong.misspelled).toBe(true);
    expect(wrong.suggestions).toContain('hamburger');
  });

  it('reads a screenplay’s capitals as words, and never flags numbers or initials', () => {
    expect(checkWord('KITCHEN').misspelled).toBe(false);
    expect(checkWord('1999').misspelled).toBe(false);
    expect(checkWord('J').misspelled).toBe(false);
  });

  it('takes the project’s names and the writer’s own words as words', () => {
    expect(checkWord('Zarnoff').misspelled).toBe(true);
    setProjectWords(['Ivo Zarnoff']);
    expect(checkWord('Zarnoff').misspelled).toBe(false);
    addToDictionary('blorptastic');
    expect(checkWord('blorptastic').misspelled).toBe(false);
  });

  it('offers synonyms, from a stem where the word itself is not listed, in the writer’s capitals', () => {
    expect(synonymsOf('beautiful')).toEqual(expect.arrayContaining(['lovely', 'pretty']));
    expect(synonymsOf('strolling').length).toBeGreaterThan(0);
    const capital = synonymsOf('Beautiful');
    expect(capital[0]![0]).toBe(capital[0]![0]!.toUpperCase());
  });
});

describe('the right-click menu over any text field', () => {
  it('offers the spelling for a misspelled word and puts the choice in place', () => {
    render(
      <>
        <TextMenu />
        <textarea aria-label="Note" defaultValue="She ate a hambuger today" spellCheck />
      </>,
    );
    const box = screen.getByLabelText('Note') as HTMLTextAreaElement;
    box.setSelectionRange(12, 12);
    fireEvent.contextMenu(box, { clientX: 10, clientY: 10 });
    const menu = screen.getByRole('menu', { name: 'Editing' });
    expect(within(menu).getByRole('menuitem', { name: 'Add to Dictionary' })).toBeTruthy();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'hamburger' }));
    expect(box.value).toBe('She ate a hamburger today');
  });

  it('offers synonyms for a word spelled right, and the standard editing items', () => {
    render(
      <>
        <TextMenu />
        <input aria-label="Title" defaultValue="A happy ending" />
      </>,
    );
    const box = screen.getByLabelText('Title') as HTMLInputElement;
    box.setSelectionRange(4, 4);
    fireEvent.contextMenu(box, { clientX: 10, clientY: 10 });
    const menu = screen.getByRole('menu', { name: 'Editing' });
    expect(menu.textContent).toContain('Synonyms for “happy”');
    for (const name of ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select All']) expect(within(menu).getByRole('menuitem', { name })).toBeTruthy();
  });

  it('stays out of the way of a screen with its own menu', () => {
    render(
      <>
        <TextMenu />
        <textarea aria-label="Line" defaultValue="hambuger" onContextMenu={(event) => event.preventDefault()} />
      </>,
    );
    fireEvent.contextMenu(screen.getByLabelText('Line'), { clientX: 5, clientY: 5 });
    expect(screen.queryByRole('menu', { name: 'Editing' })).toBeNull();
  });
});
