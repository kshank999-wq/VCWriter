// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addCharacter,
  addCharacterization,
  addTrait,
  addUnit,
  createProjectFile,
  pinUsage,
  type ProjectFile,
} from '@vcwriter/domain';
import { CharacterCreator } from '../components/CharacterCreator';

/**
 * The one-column card stack (addendum 25 §4b).
 *
 * §4a kept the shelf — a list of traits beside one trait's moments — and Ken
 * overruled it. What the stack has to be true about is the thing the shelf
 * could not do: **every trait's moments on the screen at once**, with the red
 * counts of all of them in front of you. So this asserts the shape rather than
 * the styling: nine traits draw nine cards, a card's moments are on the screen
 * without anything being pressed, folding takes the moments and keeps the
 * head, the head's counts are the *whole* trait's whatever the filter bar is
 * showing, and the four controls the shelf's middle column held are still
 * reachable — behind the ⋯ rather than gone.
 */

afterEach(cleanup);

const nothing = () => undefined;

/** Silas, two traits, and one moment of the first pinned into the writing. */
const world = (): { file: ProjectFile; silas: string } => {
  let file = createProjectFile({ title: 'The Ledger', format: 'novel' });
  file = addCharacter(file, { name: 'Silas Crane' });
  const silas = file.characters[file.characters.length - 1]!.id;

  const unit = addUnit(file, { trackId: file.tracks[0]!.id, title: 'The Counting House' });
  const beat = addBeat(unit.file, { unitId: unit.unit.id, title: 'The coal bill' });
  file = beat.file;

  const miserly = addTrait(file, { characterId: silas, name: 'Miserly' });
  file = miserly.file;
  const first = addCharacterization(file, {
    characterId: silas,
    traitId: miserly.trait!.id,
    text: "Argues over a ha'penny",
  });
  file = first.file;
  const second = addCharacterization(file, {
    characterId: silas,
    traitId: miserly.trait!.id,
    text: 'Counts the collection plate',
  });
  file = second.file;

  const sentimental = addTrait(file, { characterId: silas, name: 'Secretly sentimental' });
  file = sentimental.file;
  file = addCharacterization(file, {
    characterId: silas,
    traitId: sentimental.trait!.id,
    text: "Keeps Ada's letters",
  }).file;

  // One of them is in the writing, so the two counts differ.
  file = pinUsage(file, {
    ownerKind: 'characterization',
    ownerId: first.item!.id as string,
    beatId: beat.beat.id,
  }).file;

  return { file, silas: silas as string };
};

/** The bar, not a moment's state button — both are buttons reading *On deck*. */
const bar = (container: HTMLElement, word: string) =>
  within(container.querySelector('.creator-filter') as HTMLElement).getByRole('button', {
    name: new RegExp(word),
  });

const draw = (file: ProjectFile, silas: string) =>
  render(
    <CharacterCreator
      file={file}
      characterId={silas as never}
      currentBeatId={null}
      tab="traits"
      onTab={nothing}
      onUpdate={nothing}
      onBack={nothing}
    />,
  );

describe('the trait stack', () => {
  it('draws every trait as a card, with its moments, without anything being pressed', () => {
    const { file, silas } = world();
    const { container } = draw(file, silas);

    expect(container.querySelectorAll('.creator-card')).toHaveLength(2);
    // The shelf could show one trait's moments at a time; the stack shows all.
    expect(screen.getByRole('button', { name: "The moment: Argues over a ha'penny" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'The moment: Counts the collection plate' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "The moment: Keeps Ada's letters" })).toBeTruthy();
  });

  it('folds a card down to its head, and opens it again', () => {
    const { file, silas } = world();
    const { container } = draw(file, silas);

    fireEvent.click(screen.getByRole('button', { name: 'Fold Miserly' }));
    expect(screen.queryByRole('button', { name: "The moment: Argues over a ha'penny" })).toBeNull();
    // The head stays, counts and all — a folded card still says what it owes.
    expect(screen.getByRole('button', { name: 'Open Miserly' })).toBeTruthy();
    expect(container.querySelectorAll('.creator-card')).toHaveLength(2);
    // Its neighbour is untouched: folding is per card.
    expect(screen.getByRole('button', { name: "The moment: Keeps Ada's letters" })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open Miserly' }));
    expect(screen.getByRole('button', { name: "The moment: Argues over a ha'penny" })).toBeTruthy();
  });

  it("keeps a head's counts the whole trait's when the bar narrows the rows", () => {
    const { file, silas } = world();
    const { container } = draw(file, silas);

    const countsOf = () =>
      Array.from(container.querySelectorAll('.creator-card-counts')).map((node) =>
        (node.textContent ?? '').replace(/\s+/g, ''),
      );
    expect(countsOf()).toEqual(['11', '1']);

    fireEvent.click(bar(container, 'On deck'));
    // One row left under Miserly…
    expect(screen.queryByRole('button', { name: "The moment: Argues over a ha'penny" })).toBeNull();
    expect(screen.getByRole('button', { name: 'The moment: Counts the collection plate' })).toBeTruthy();
    // …and the head still says one of each, which is what the trait holds.
    expect(countsOf()).toEqual(['11', '1']);
  });

  it('drops a card with nothing left under a narrowing filter', () => {
    const { file, silas } = world();
    const { container } = draw(file, silas);

    fireEvent.click(bar(container, 'Used'));
    // Secretly sentimental has nothing in the writing, so its card goes.
    expect(container.querySelectorAll('.creator-card')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: "The moment: Keeps Ada's letters" })).toBeNull();
  });

  it('keeps all four of the shelf’s controls, behind the ⋯', () => {
    const { file, silas } = world();
    draw(file, silas);

    // Absent until asked for: they are set once and read for months.
    expect(screen.queryByLabelText('When this shows')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Settings for Miserly' }));
    expect(screen.getByLabelText('When this shows')).toBeTruthy();
    expect(screen.getByLabelText('How much of them this is')).toBeTruthy();
    expect(screen.getByLabelText('Read as')).toBeTruthy();
    expect(screen.getByLabelText('Pulls against')).toBeTruthy();
  });

  it('has nowhere for an unfiled pile when there is nothing unfiled', () => {
    const { file, silas } = world();
    const first = draw(file, silas);
    expect(first.container.querySelector('[aria-label="Noticed, not filed"]')).toBeNull();

    const caught = addCharacterization(file, {
      characterId: silas as never,
      traitId: null,
      text: 'Wears a coat too thin for the weather',
    }).file;
    cleanup();
    const again = draw(caught, silas);
    expect(again.container.querySelector('[aria-label="Noticed, not filed"]')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'The moment: Wears a coat too thin for the weather' }),
    ).toBeTruthy();
  });
});
