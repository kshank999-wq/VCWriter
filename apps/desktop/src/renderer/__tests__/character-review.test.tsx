// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addCharacter,
  addUnit,
  createProjectFile,
  updateBeat,
  type ManuscriptElementId,
  type ProjectFile,
} from '@vcwriter/domain';
import { CharacterReview } from '../components/CharacterReview';

/**
 * The review reading the script (addendum 08 §18, stage 13).
 *
 * The review used to open on *In story order*, which on a project with a
 * finished script and no Creator records said **nothing matches that** — true,
 * and useless. What these hold is that it now opens on something real, and that
 * what it says about the manuscript is countable rather than an opinion.
 */

afterEach(cleanup);

const cue = (text: string) => ({
  id: crypto.randomUUID() as ManuscriptElementId,
  type: 'character' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A script where Mara speaks, disappears for two scenes, and comes back. */
const screenplay = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  for (const name of ['MARA', 'DEAKINS', 'SAL']) file = addCharacter(file, { name });

  [['MARA', 'DEAKINS'], ['DEAKINS'], ['DEAKINS'], ['MARA'], ['MAEVE']].forEach((cues, index) => {
    const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: `SCENE ${index + 1}` });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'A beat' });
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: cues.map(cue) } });
  });
  return file;
};

describe('the review reading the script', () => {
  it('opens on the script, which is the reading with something in it', () => {
    render(<CharacterReview file={screenplay()} onOpenCreator={() => undefined} />);
    expect(screen.getByRole('button', { name: 'In the script' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('says the scenes and the speeches, with nothing written down', () => {
    render(<CharacterReview file={screenplay()} onOpenCreator={() => undefined} />);
    expect(screen.getByText('3 scenes · 3 speeches')).toBeDefined();
    expect(screen.getByText('2 scenes · 2 speeches')).toBeDefined();
  });

  it('names the stretch somebody is away as the scene it follows', () => {
    render(<CharacterReview file={screenplay()} onOpenCreator={() => undefined} />);
    expect(screen.getByText(/away for 2 scenes after/)).toBeDefined();
  });

  it('lists a cue nobody in the cast is behind, and where it starts', () => {
    render(<CharacterReview file={screenplay()} onOpenCreator={() => undefined} />);
    expect(screen.getByText('Speaking, but not in the cast')).toBeDefined();
    expect(screen.getByText('MAEVE')).toBeDefined();
  });

  it('says who is in the cast and has no lines, rather than quietly omitting them', () => {
    render(<CharacterReview file={screenplay()} onOpenCreator={() => undefined} />);
    expect(screen.getByText('In the cast, not yet speaking')).toBeDefined();
    expect(screen.getByRole('button', { name: 'SAL' })).toBeDefined();
  });

  it('opens somebody in the Creator from their row', () => {
    let opened: string | null = null;
    render(
      <CharacterReview file={screenplay()} onOpenCreator={(id) => (opened = id as string)} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'MARA' }));
    expect(opened).not.toBeNull();
  });

  it('says so plainly when nobody has spoken yet', () => {
    const empty = createProjectFile({ title: 'Nothing', format: 'screenplay' });
    render(<CharacterReview file={empty} onOpenCreator={() => undefined} />);
    expect(screen.getByText('Nobody speaks in the script yet.')).toBeDefined();
  });
});
