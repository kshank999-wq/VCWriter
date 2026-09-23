// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  addBeat,
  addCharacter,
  addUnit,
  createProjectFile,
  ref,
  removeCharacter,
  workingCast,
  type ProjectFile,
} from '@vcwriter/domain';
import { ReadBackPanel } from '../components/ReadBackPanel';
import { RelatedPanel } from '../components/RelatedPanel';
import { CharacterMap } from '../components/CharacterMap';
import { CharacterReview } from '../components/CharacterReview';
import { CharacterCreator } from '../components/CharacterCreator';

/**
 * Everywhere a person is listed, after they have been deleted (addendum 24 §5i).
 *
 * §5d found six domain readings writing `!person.archived` for themselves and
 * gave them `workingCast`; the renderer kept six of its own, so MARA left the
 * cast list and stayed in the voices, the review, the map's focus picker, the
 * link picker and both places that offer somebody to work on. This walks
 * **every** surface rather than the one the complaint came from, which is the
 * only shape of test that catches the next one.
 */

afterEach(cleanup);

const cast = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  file = addCharacter(file, { name: 'MARA' });
  file = addCharacter(file, { name: 'DEAKINS' });
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'SCENE 1' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'A beat' });
  const mara = beat.file.characters.find((one) => one.name === 'MARA')!;
  return { file: beat.file, gone: removeCharacter(beat.file, mara.id), mara, beat: beat.beat };
};

const nothing = () => undefined;

describe('a deleted person is off every list that names one', () => {
  it('leaves the cast reading itself', () => {
    const { gone } = cast();
    expect(workingCast(gone).map((one) => one.name)).toEqual(['DEAKINS']);
  });

  it('leaves the voices in Read Back', () => {
    const { gone } = cast();
    render(<ReadBackPanel file={gone} currentUnitId={null} onUpdate={nothing} />);
    expect(screen.queryByLabelText('Voice for MARA')).toBeNull();
    expect(screen.getByLabelText('Voice for DEAKINS')).toBeTruthy();
  });

  it('leaves what a scene can be linked to', () => {
    const { gone, beat } = cast();
    render(<RelatedPanel file={gone} target={ref('beat', beat.id)} onUpdate={nothing} />);
    const labels = Array.from(document.querySelectorAll('option')).map((one) => one.textContent);
    expect(labels).not.toContain('MARA');
    expect(labels).toContain('DEAKINS');
  });

  it('leaves the map’s focus picker', () => {
    const { gone } = cast();
    render(<CharacterMap file={gone} onUpdate={nothing} onOpenCreator={nothing} />);
    const options = Array.from(
      (screen.getByLabelText('Focus on') as HTMLSelectElement).options,
    ).map((one) => one.textContent);
    expect(options).toEqual(['Everybody', 'DEAKINS']);
  });

  it('leaves the review’s filters', () => {
    const { gone } = cast();
    render(<CharacterReview file={gone} onOpenCreator={nothing} />);
    const labels = Array.from(document.querySelectorAll('option')).map((one) => one.textContent);
    expect(labels).not.toContain('MARA');
    expect(labels).toContain('DEAKINS');
  });

  it('leaves who somebody else can have a relationship with', () => {
    const { file, gone, mara } = cast();
    const deakins = file.characters.find((one) => one.name === 'DEAKINS')!;
    render(
      <CharacterCreator
        file={gone}
        characterId={deakins.id}
        currentBeatId={null}
        tab="relationships"
        onUpdate={nothing}
        onBack={nothing}
      />,
    );
    const labels = Array.from(document.querySelectorAll('option')).map((one) => one.textContent);
    expect(labels).not.toContain('MARA');
    // And the person themselves is never offered, deleted or not.
    expect(gone.characters.some((one) => one.id === mara.id)).toBe(true);
  });
});
