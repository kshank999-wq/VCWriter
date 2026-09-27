// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  addBeat,
  addCharacter,
  addCharacterization,
  addTrait,
  addUnit,
  createProjectFile,
  type ProjectFile,
} from '@vcwriter/domain';
import { CharacterCreator, type CreatorTab } from '../components/CharacterCreator';

/**
 * The module says **moment** (addendum 25 §8).
 *
 * The handoff's own decision, and the right one: *a moment in the interface, a
 * `CharacterizationItem` in the data*, because the word a writer uses and the
 * word the schema uses answer different questions. What makes it worth a test
 * rather than a rename is addendum 16 §6c's lesson — seventeen components
 * still said *Scene* after the noun table existed, each one having written the
 * word itself. So this walks the whole rendered screen, attributes included,
 * and asserts the older words are nowhere on it.
 */

afterEach(cleanup);

const nothing = () => undefined;

const world = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Ledger', format: 'novel' });
  file = addCharacter(file, { name: 'Silas Crane' });
  const silas = file.characters[file.characters.length - 1]!.id;
  const unit = addUnit(file, { trackId: file.tracks[0]!.id, title: 'The Counting House' });
  file = addBeat(unit.file, { unitId: unit.unit.id, title: 'The coal bill' }).file;

  const trait = addTrait(file, { characterId: silas, name: 'Miserly' });
  return addCharacterization(trait.file, {
    characterId: silas,
    traitId: trait.trait!.id,
    text: "Argues over a ha'penny",
  }).file;
};

/** Everything a writer can read on the screen, attributes and all. */
const wordsOn = (): string => {
  const root = document.body;
  const seen: string[] = [root.textContent ?? ''];
  for (const node of Array.from(root.querySelectorAll('*'))) {
    for (const attribute of Array.from(node.attributes)) {
      // `class` is not read by anybody and is allowed its own vocabulary —
      // `.creator-item` is a name for a box, not a word about the work.
      if (attribute.name === 'class') continue;
      seen.push(attribute.value);
    }
  }
  return seen.join(' ').toLowerCase();
};

const TABS: CreatorTab[] = ['overview', 'traits', 'arc', 'relationships'];

describe('the module says moment', () => {
  for (const tab of TABS) {
    it(`says neither "characterization" nor "way to show" on ${tab}`, () => {
      const file = world();
      const silas = file.characters[file.characters.length - 1]!;
      render(
        <CharacterCreator
          file={file}
          characterId={silas.id}
          currentBeatId={null}
          tab={tab}
          onTab={nothing}
          onUpdate={nothing}
          onBack={nothing}
        />,
      );
      const words = wordsOn();
      expect(words).not.toContain('characterization');
      expect(words).not.toContain('way to show');
      expect(words).not.toContain('ways to show');
      expect(words).not.toContain('way it shows');
    });
  }

  it('names the tab as the handoff does', () => {
    const file = world();
    const silas = file.characters[file.characters.length - 1]!;
    render(
      <CharacterCreator
        file={file}
        characterId={silas.id}
        currentBeatId={null}
        tab="traits"
        onTab={nothing}
        onUpdate={nothing}
        onBack={nothing}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Traits & Moments' })).toBeTruthy();
  });

  it('calls the box a moment where one is written', () => {
    const file = world();
    const silas = file.characters[file.characters.length - 1]!;
    render(
      <CharacterCreator
        file={file}
        characterId={silas.id}
        currentBeatId={null}
        tab="traits"
        onTab={nothing}
        onUpdate={nothing}
        onBack={nothing}
      />,
    );
    // The shelf opens on the first trait, so the row's own box is on screen.
    expect(screen.getAllByLabelText('The moment').length).toBeGreaterThan(0);
  });
});
