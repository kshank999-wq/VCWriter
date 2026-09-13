// @vitest-environment jsdom
import { useState } from 'react';
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
import { CharacterMap } from '../components/CharacterMap';

/**
 * The character map reading the script (addendum 08 §12, stage 12).
 *
 * The map used to open empty on a finished screenplay, because it drew only
 * what somebody had written down. What these hold is the line it must not
 * cross: the manuscript says **how often** two people share a scene, and the
 * writer says **what that is**.
 */

afterEach(cleanup);

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  return (
    <CharacterMap
      file={file}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      onOpenCreator={() => undefined}
    />
  );
}

const cue = (text: string) => ({
  id: crypto.randomUUID() as ManuscriptElementId,
  type: 'character' as const,
  text,
  characterId: null,
  attributes: {},
});

/** Two people, speaking in one scene together and nothing written down. */
const spoken = () => {
  let file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  for (const name of ['MARA', 'DEAKINS']) file = addCharacter(file, { name });

  const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. DINER - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
  return updateBeat(beat.file, beat.beat.id, {
    manuscript: { elements: [cue('MARA'), cue('DEAKINS')] },
  });
};

describe('the map reading the script', () => {
  it('draws a line nobody wrote down, and says only how many scenes it is', () => {
    const { container } = render(<Harness initial={spoken()} />);

    const drawn = container.querySelectorAll('.charmap-edge.unnamed');
    expect(drawn).toHaveLength(1);
    expect(screen.getByText('1 scene')).toBeDefined();
  });

  it('can be turned off, and the map empties back out', () => {
    const { container } = render(<Harness initial={spoken()} />);
    fireEvent.click(screen.getByText('Lines from the script'));
    expect(container.querySelectorAll('.charmap-edge')).toHaveLength(0);
  });

  it('lets the writer name what the script only counted', () => {
    const { container } = render(<Harness initial={spoken()} />);
    fireEvent.click(container.querySelector('.charmap-edge')!);

    // Both directions are offered empty, because the two may disagree.
    expect(screen.getAllByText('Say so')).toHaveLength(2);

    // The pair's two sides are ordered by id, not by who was named first, so
    // the control is reached through its own label rather than by position.
    const hers = screen.getByLabelText('What MARA is to DEAKINS');
    fireEvent.change(hers, { target: { value: 'rival' } });
    fireEvent.click(hers.parentElement!.querySelector('button')!);

    // The line is named now, so it is no longer the script's own.
    expect(container.querySelectorAll('.charmap-edge.unnamed')).toHaveLength(0);
    // And it wears her reading of him. (Asked of the drawing itself: the word
    // is also in the panel and in every kind menu on the screen.)
    expect(container.querySelector('.charmap-edge')?.textContent).toContain('Rival');
    // …and the count leaves the drawing, since the reading is what the line is
    // about now. It stays in the panel, because it is still true.
    expect(container.querySelector('.charmap-count')).toBeNull();
  });

  it('keeps the count in the panel once it is named, because it is still true', () => {
    const { container } = render(<Harness initial={spoken()} />);
    fireEvent.click(container.querySelector('.charmap-edge')!);
    fireEvent.click(screen.getAllByText('Say so')[0]!);

    expect(screen.getByText(/They speak in/)).toBeDefined();
  });
});
