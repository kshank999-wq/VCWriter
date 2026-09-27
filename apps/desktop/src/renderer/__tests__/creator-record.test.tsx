// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  CHARACTER_TYPES,
  addCharacter,
  characterCategoriesInOrder,
  createProjectFile,
  updateCharacter,
  type ProjectFile,
} from '@vcwriter/domain';
import { CharacterCreator } from '../components/CharacterCreator';

/**
 * What the record is called (addendum 25 §4c, Ken's words).
 *
 * Five labels, and a test for them because a label is the whole of what a
 * writer has to go on: *How much of the story* described the question and
 * never named the answer, so nobody could tell that picking one filed them
 * under a heading on the left. These are pinned the way §8's vocabulary sweep
 * is pinned — by reading the rendered screen — so a later edit that puts the
 * old words back fails here rather than being noticed by Ken.
 */

afterEach(cleanup);

const nothing = () => undefined;

const world = (): { file: ProjectFile; silas: string } => {
  let file = createProjectFile({ title: 'The Ledger', format: 'novel' });
  file = addCharacter(file, { name: 'Silas Crane' });
  const silas = file.characters[file.characters.length - 1]!.id;
  return { file, silas: silas as string };
};

const draw = (file: ProjectFile, silas: string) =>
  render(
    <CharacterCreator
      file={file}
      characterId={silas as never}
      currentBeatId={null}
      tab="overview"
      onTab={nothing}
      onUpdate={nothing}
      onBack={nothing}
    />,
  );

describe('what the record is called', () => {
  it('names the type control, and offers the three types', () => {
    const { file, silas } = world();
    draw(file, silas);

    const control = screen.getByLabelText('Character type');
    expect(control).toBeTruthy();
    // The offered set is the project's own headings, which a new project
    // seeds with Ken's three.
    expect(Array.from(control.querySelectorAll('option')).map((one) => one.textContent)).toEqual([
      'Not filed',
      CHARACTER_TYPES.main,
      CHARACTER_TYPES.minor,
      CHARACTER_TYPES.extra,
    ]);
    // The question it used to ask is nowhere on the screen.
    expect(document.body.textContent).not.toContain('How much of the story');
  });

  it('says character description, backstory and links', () => {
    const { file, silas } = world();
    const { container } = draw(file, silas);

    // The fold is the section; opening it is a press, so the labels inside
    // are asserted through the fold's own button rather than by finding them
    // on a screen that has not been opened.
    const fold = container.querySelector('.creator-fold-head') as HTMLElement;
    expect(fold.textContent).toContain('Character description');
    fireEvent.click(fold);

    expect(screen.getByLabelText('Character description')).toBeTruthy();
    expect(screen.getByLabelText('Backstory')).toBeTruthy();
    expect(screen.getByLabelText('Add a link')).toBeTruthy();

    const words = document.body.textContent ?? '';
    expect(words).not.toContain('History');
    expect(words).not.toContain('Tags');
  });

  it('heads the rail Characterizations', () => {
    const { file, silas } = world();
    const { container } = draw(file, silas);
    const rail = container.querySelector('.creator-rail') as HTMLElement;
    expect(within(rail).getByText('Characterizations')).toBeTruthy();
  });

  it('files somebody under a type, which is what the left-hand list groups by', () => {
    const { file, silas } = world();
    const types = characterCategoriesInOrder(file);
    const main = types.find((one) => one.name === CHARACTER_TYPES.main)!;

    const filed = updateCharacter(file, silas as never, { categoryId: main.id });
    expect(filed.characters.find((one) => (one.id as string) === silas)?.categoryId).toBe(main.id);

    draw(filed, silas);
    expect((screen.getByLabelText('Character type') as HTMLSelectElement).value).toBe(main.id as string);
  });
});
