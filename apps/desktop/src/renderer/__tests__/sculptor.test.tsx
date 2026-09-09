// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
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

  it('takes its height from the manuscript under it, not from a stored size', () => {
    let file = script();
    const made = addStructurePoint(file, { title: 'One' });
    file = made.file;
    render(<Canvas start={file} />);

    const band = screen.getByLabelText('ACT I');
    // The point came with the scene it opens, but nothing is written in it
    // yet — so the band is at its floor rather than at a stored size.
    expect(band.style.minHeight).toBe('64px');
    expect(within(band).getAllByRole('button', { name: /Untitled scene/ })).toHaveLength(1);

    // The opening, which has the project's own scene in it, is at the floor
    // too: an empty region is a place on the canvas, not a hairline.
    expect(screen.getByLabelText('Opening').style.minHeight).toBe('64px');
  });

  it('says how much is in each region', () => {
    const made = addStructurePoint(script(), { title: 'One' });
    render(<Canvas start={made.file} />);
    expect(within(screen.getByLabelText('ACT I')).getByText(/1 scene · 0.0 pages/)).toBeDefined();
  });

  it('removes a point without taking its scene with it', () => {
    const made = addStructurePoint(script(), { title: 'One' });
    render(<Canvas start={made.file} />);
    expect(screen.getByTestId('spine').textContent).toBe('Opening / ACT I');

    fireEvent.click(screen.getByRole('button', { name: 'Remove ACT I' }));
    // The shape is gone; the scene it opened is still in the story, and both
    // scenes are now in the opening because that is where the story puts them.
    expect(screen.getByTestId('spine').textContent).toBe('Opening');
    expect(within(screen.getByLabelText('Opening')).getAllByRole('button', { name: /scene/i })).toHaveLength(2);
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
