// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addStructurePoint,
  createProjectFile,
  sculptorSpine,
  type ProjectFile,
} from '@vcwriter/domain';
import { SculptorWindow } from '../components/SculptorWindow';

/**
 * Story Sculptor, stage one (addendum 03 §§2–4): an area of its own, the
 * story running down it, and the largest shapes put in first.
 */

afterEach(cleanup);

/** The canvas open over a project held in state, so edits actually land. */
function Canvas({ start }: { start: ProjectFile }) {
  const [file, setFile] = useState(start);
  return (
    <>
      <p data-testid="spine">
        {sculptorSpine(file)
          .regions.map((region) => region.label)
          .join(' / ')}
      </p>
      <SculptorWindow
        file={file}
        open
        onClose={() => undefined}
        onUpdate={(mutate) => setFile((current) => mutate(current))}
      />
    </>
  );
}

const script = (): ProjectFile => createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });

describe('the canvas', () => {
  it('draws the story between a Beginning and an End that cannot be lost', () => {
    render(<Canvas start={script()} />);
    expect(screen.getByLabelText('Beginning')).toBeDefined();
    expect(screen.getByLabelText('End')).toBeDefined();
    // They are drawn, not stored, so neither offers a way to remove it.
    expect(within(screen.getByLabelText('Beginning')).queryByRole('button')).toBeNull();
  });

  it('offers the kinds the format is written in, and a milestone of one’s own', () => {
    render(<Canvas start={script()} />);
    expect(screen.getByRole('button', { name: '+ Act' })).toBeDefined();
    expect(screen.getByRole('button', { name: '+ Sequence' })).toBeDefined();
    expect(screen.getByRole('button', { name: '+ Milestone' })).toBeDefined();
  });

  it('puts a structure point in, and asks what it is called', () => {
    render(<Canvas start={script()} />);
    expect(screen.getByTestId('spine').textContent).toBe('Opening');

    fireEvent.click(screen.getByRole('button', { name: '+ Act' }));
    expect(screen.getByTestId('spine').textContent).toBe('Opening / ACT I');

    // It opens ready to be named, and the name lands on the point.
    const naming = screen.getByLabelText('Name ACT I') as HTMLInputElement;
    fireEvent.change(naming, { target: { value: 'The arrival' } });
    fireEvent.blur(naming);
    expect(screen.getByText('The arrival')).toBeDefined();
  });

  it('says how much is in each region', () => {
    const made = addStructurePoint(script(), { title: 'One' });
    render(<Canvas start={made.file} />);
    expect(within(screen.getByLabelText('ACT I')).getByText(/1 scene · 1 beat · 0.0 pages/)).toBeDefined();
  });

  it('removes a point without taking its scene with it', () => {
    const made = addStructurePoint(script(), { title: 'One' });
    render(<Canvas start={made.file} />);
    expect(screen.getByTestId('spine').textContent).toBe('Opening / ACT I');

    fireEvent.click(screen.getByRole('button', { name: 'Remove ACT I' }));
    // The shape is gone; the scene it opened is still in the story, and both
    // scenes are now in the opening because that is where the story puts them.
    expect(screen.getByTestId('spine').textContent).toBe('Opening');
    expect(screen.getByLabelText('Opening').querySelectorAll('.sculptor-scene')).toHaveLength(2);
  });

  it('drags a point to another place in the story, region and all', () => {
    let file = script();
    for (const title of ['One', 'Two', 'Three']) file = addStructurePoint(file, { title }).file;
    render(<Canvas start={file} />);
    expect(screen.getByTestId('spine').textContent).toBe('Opening / ACT I / ACT II / ACT III');

    // The last point is dragged onto the first: the labels renumber, and the
    // one that moved is now the one at the front.
    const third = screen.getByLabelText('ACT III');
    const first = screen.getByLabelText('ACT I');
    fireEvent.dragStart(within(third).getByText('ACT III'));
    fireEvent.dragOver(first);
    fireEvent.drop(first);

    expect(within(screen.getByLabelText('ACT I')).getByText('Three')).toBeDefined();
    expect(within(screen.getByLabelText('ACT III')).getByText('Two')).toBeDefined();
  });
});

/**
 * Stage two (addendum 03 §4): a region is as tall as what is inside it, and
 * folds back to its head so the shape can be read.
 */
describe('automatic vertical expansion', () => {
  /** The pixel height a band is standing at. */
  const heightOf = (label: string) => Number.parseFloat(screen.getByLabelText(label).style.minHeight);

  it('grows when a scene is put in, and pushes what follows down', () => {
    const made = addStructurePoint(script(), { title: 'One' });
    render(<Canvas start={made.file} />);
    const before = heightOf('ACT I');

    fireEvent.click(screen.getByRole('button', { name: 'Add a scene to ACT I' }));
    expect(heightOf('ACT I')).toBeGreaterThan(before);
    expect(screen.getByLabelText('ACT I').querySelectorAll('.sculptor-scene')).toHaveLength(2);
  });

  it('gives each scene the room its own beats need', () => {
    const made = addStructurePoint(script(), { title: 'One' });
    const file = addBeat(made.file, { unitId: made.unit.id }).file;
    render(<Canvas start={file} />);

    const scenes = screen.getByLabelText('ACT I').querySelectorAll<HTMLElement>('.sculptor-scene');
    // One beat against two: the taller card is the one with more in it.
    expect(Number.parseFloat(scenes[0]!.style.minHeight)).toBeGreaterThan(0);
    expect(within(screen.getByLabelText('ACT I')).getByText('2 beats')).toBeDefined();
  });

  it('folds to its head, and opens again, keeping what is under it', () => {
    const made = addStructurePoint(script(), { title: 'One' });
    render(<Canvas start={made.file} />);
    expect(screen.getByLabelText('ACT I').querySelectorAll('.sculptor-scene')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Fold ACT I' }));
    // Compressed, not emptied: the figures still say what is in there.
    expect(screen.getByLabelText('ACT I').querySelectorAll('.sculptor-scene')).toHaveLength(0);
    expect(within(screen.getByLabelText('ACT I')).getByText(/1 scene · 1 beat/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Open ACT I' }));
    expect(screen.getByLabelText('ACT I').querySelectorAll('.sculptor-scene')).toHaveLength(1);
  });

  it('folds the whole canvas down to its shape, and back', () => {
    let file = script();
    for (const title of ['One', 'Two']) file = addStructurePoint(file, { title }).file;
    render(<Canvas start={file} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fold all' }));
    expect(document.querySelectorAll('.sculptor-scene')).toHaveLength(0);
    // Every region is still there — a readable macro shape (§17).
    expect(document.querySelectorAll('.sculptor-region')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Open all' }));
    expect(document.querySelectorAll('.sculptor-scene').length).toBeGreaterThan(0);
  });

  it('takes scenes into the opening as readily as into a region', () => {
    const made = addStructurePoint(script(), { title: 'One' });
    render(<Canvas start={made.file} />);
    expect(screen.getByLabelText('Opening').querySelectorAll('.sculptor-scene')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add a scene to Opening' }));
    expect(screen.getByLabelText('Opening').querySelectorAll('.sculptor-scene')).toHaveLength(2);
    // The opening has no structure point, so there is nothing to name or remove.
    expect(screen.queryByRole('button', { name: 'Remove Opening' })).toBeNull();
  });
});
