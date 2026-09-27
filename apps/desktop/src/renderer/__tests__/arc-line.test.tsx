// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addArcPoint,
  addCharacter,
  addTheme,
  beginArc,
  createProjectFile,
  updateArc,
  type ProjectFile,
} from '@vcwriter/domain';
import { CharacterCreator } from '../components/CharacterCreator';

/**
 * The arc as a line (addendum 25 §4e, Ken's *timeline view*).
 *
 * The domain has its own tests for the reading; these are about the gesture,
 * which is the half a domain test cannot see: **the line between two boxes is
 * the act**, and the two ends say why nothing links from them.
 */

afterEach(cleanup);

const world = (): { file: ProjectFile; silas: string } => {
  let file = createProjectFile({ title: 'The Ledger', format: 'screenplay' });
  file = addCharacter(file, { name: 'SILAS' });
  const silas = file.characters[file.characters.length - 1]!.id;
  const begun = beginArc(file, silas);
  file = updateArc(begun.file, begun.arc!.id, { beginning: 'Keeps score.', ending: 'Counts faster.' });
  file = addArcPoint(file, { arcId: begun.arc!.id, text: 'She refuses the coal' }).file;
  file = addArcPoint(file, { arcId: begun.arc!.id, text: 'She is offered it back' }).file;
  file = addTheme(file, { name: 'Miserliness' }).file;
  return { file, silas: silas as string };
};

/** The Creator on the Arc tab. The acts are the domain's and tested there. */
function Harness({ initial }: { initial: ProjectFile }) {
  return (
    <CharacterCreator
      file={initial}
      characterId={initial.characters[0]!.id}
      currentBeatId={null}
      tab="arc"
      onTab={() => undefined}
      onUpdate={() => undefined}
      onBack={() => undefined}
    />
  );
}

describe('the arc as a line', () => {
  it('draws the two ends and the moments between, in the writer’s order', () => {
    const { file } = world();
    const { container } = render(<Harness initial={file} />);
    const stops = Array.from(container.querySelectorAll('.arc-stop')).map((one) =>
      (one.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(stops[0]).toContain('Begins');
    expect(stops[0]).toContain('Keeps score.');
    expect(stops.at(-1)).toContain('Becomes');
    expect(stops.at(-1)).toContain('Counts faster.');
    expect(stops.some((one) => one.includes('She refuses the coal'))).toBe(true);
    // A gap for every join, which is what a moment goes into.
    expect(container.querySelectorAll('.arc-gap-line')).toHaveLength(stops.length - 1);
  });

  it('opens a field on the line where it was double-clicked', () => {
    const { file } = world();
    const { container } = render(<Harness initial={file} />);
    const gaps = container.querySelectorAll('.arc-gap-line');
    fireEvent.doubleClick(gaps[1]!);
    expect(screen.getByLabelText('What happens here')).toBeTruthy();
    // Escape puts it away without making anything.
    fireEvent.keyDown(screen.getByLabelText('What happens here'), { key: 'Escape' });
    expect(screen.queryByLabelText('What happens here')).toBeNull();
  });

  it('says why the two ends carry no link, and offers the three kinds on a moment', () => {
    const { file } = world();
    const { container } = render(<Harness initial={file} />);

    fireEvent.click(container.querySelector('.arc-stop.beginning')!);
    expect(screen.getByText(/nothing links from here/)).toBeTruthy();
    expect(screen.queryByLabelText('Link it to')).toBeNull();

    fireEvent.click(container.querySelector('.arc-stop.point')!);
    const kinds = Array.from(
      (screen.getByLabelText('Link it to') as HTMLSelectElement).querySelectorAll('option'),
    ).map((one) => one.textContent);
    expect(kinds).toEqual(['In the script', 'A theme', 'A motif']);
  });
});
