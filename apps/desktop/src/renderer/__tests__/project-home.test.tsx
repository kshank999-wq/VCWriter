// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addUnit,
  createProjectFile,
  setPoster,
  setProjectDetails,
  updateBeat,
  type ProjectFile,
} from '@vcwriter/domain';
import { ProjectHomePanel } from '../components/ProjectHomePanel';
import { VIEWS } from '../components/PageBar';

/**
 * The project home through the interface (master spec §4, addendum 17).
 *
 * The seven fields had no surface at all, so the first thing worth testing is
 * simply that each one can now be typed into and comes back. After that, the
 * two rules: the figures are **counted rather than scored**, and the status is
 * **the writer's and reads nothing**.
 */

afterEach(cleanup);

const DOT = 'data:image/png;base64,iVBORw0KGgo=';

/** A screenplay with two scenes, without the seeded starter. */
const project = (format: 'screenplay' | 'instructional' = 'screenplay') => {
  let file = createProjectFile({ title: 'The Brass Key', format });
  const starters = new Set(file.units.map((one) => one.id as string));
  const trackId = file.tracks[0]!.id;
  const beatIds: string[] = [];
  for (const title of ['One', 'Two']) {
    const unit = addUnit(file, { trackId, title });
    const beat = addBeat(unit.file, { unitId: unit.unit.id, title: `Beat ${title}` });
    file = beat.file;
    beatIds.push(beat.beat.id as string);
  }
  file = {
    ...file,
    units: file.units.filter((one) => !starters.has(one.id as string)),
    beats: file.beats.filter((one) => !starters.has(one.unitId as string)),
  };
  return { file, beatIds };
};

function Home({
  start,
  onFile,
  onGoToBeat,
}: {
  start: ProjectFile;
  onFile?(file: ProjectFile): void;
  onGoToBeat?(id: never): void;
}) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return (
    <ProjectHomePanel
      file={file}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      {...(onGoToBeat ? { onGoToBeat } : {})}
    />
  );
}

describe('the way in', () => {
  it('is a page of its own, and is not the one the application opens on', () => {
    expect(VIEWS.map((one) => one.id)).toContain('home');
    // A writer opening a file wants the writing, not a dashboard about it.
    expect(VIEWS[0]!.id).toBe('home');
    expect(VIEWS.find((one) => one.id === 'write')).toBeTruthy();
  });
});

describe('the fields that had nowhere to be typed', () => {
  it('writes every one of §4’s fields', () => {
    let seen: ProjectFile | null = null;
    const { file } = project();
    render(<Home start={file} onFile={(one) => (seen = one)} />);

    for (const [label, value] of [
      ['Author', 'K. Shank'],
      ['Genre', 'Thriller'],
      ['Logline', 'A locksmith is asked to open a door she installed.'],
      ['Elevator pitch', 'A thriller about what we make for other people.'],
      ['Synopsis', 'Mara fits a lock. Years later somebody wants it opened.'],
      ['Project notes', 'Working title only.'],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }

    const after = (seen as unknown as ProjectFile).project;
    expect(after.author).toBe('K. Shank');
    expect(after.genre).toBe('Thriller');
    expect(after.logline).toContain('locksmith');
    expect(after.elevatorPitch).toContain('thriller');
    expect(after.synopsis).toContain('Mara');
    expect(after.notes).toBe('Working title only.');
  });

  it('keeps the other fields when one is edited', () => {
    let seen: ProjectFile | null = null;
    const { file } = project();
    const told = setProjectDetails(file, { logline: 'A line.', synopsis: 'A synopsis.' });
    render(<Home start={told} onFile={(one) => (seen = one)} />);

    fireEvent.change(screen.getByLabelText('Genre'), { target: { value: 'Thriller' } });
    const after = (seen as unknown as ProjectFile).project;
    expect(after.logline).toBe('A line.');
    expect(after.synopsis).toBe('A synopsis.');
  });

  it('offers a status, and says plainly that nothing reads it', () => {
    let seen: ProjectFile | null = null;
    const { file } = project();
    render(<Home start={file} onFile={(one) => (seen = one)} />);

    fireEvent.change(screen.getByLabelText('Project status'), { target: { value: 'revising' } });
    expect((seen as unknown as ProjectFile).project.status).toBe('revising');
    expect(screen.getByText(/Nothing in the application reads the status/)).toBeTruthy();
  });
});

describe('the poster', () => {
  it('offers one, and forgetting it says the picture stays', () => {
    let seen: ProjectFile | null = null;
    const { file } = project();
    const made = setPoster(file, { name: 'key-art.png', data: DOT });
    render(<Home start={made.file} onFile={(one) => (seen = one)} />);

    expect(screen.getByAltText('Key art for The Brass Key')).toBeTruthy();
    fireEvent.click(screen.getByText('Remove'));

    const after = seen as unknown as ProjectFile;
    expect(after.project.posterAssetId).toBeNull();
    // Two different acts: the picture is still in the document (§4).
    expect(after.assets).toHaveLength(1);
  });

  it('asks for one where there is none', () => {
    const { file } = project();
    render(<Home start={file} />);
    expect(screen.getByText('Drop key art here')).toBeTruthy();
    expect(screen.getByText('Choose a picture…')).toBeTruthy();
  });
});

describe('what the document says about itself', () => {
  it('states the figures rather than scoring them', () => {
    const { file, beatIds } = project();
    const written = updateBeat(file, beatIds[0]! as never, { status: 'written' });
    render(<Home start={written} />);

    expect(screen.getByText('1 of 2 written')).toBeTruthy();
    // No percentage and no bar creeping toward a goal nobody set.
    expect(screen.queryByText(/50%/)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('names the parts for the format', () => {
    const { file } = project('instructional');
    render(<Home start={file} />);
    expect(screen.getByText('Sections')).toBeTruthy();
    expect(screen.getByText('Subsections')).toBeTruthy();
    expect(screen.queryByText('Scenes')).toBeNull();
  });

  it('points at where the writing last happened, and goes back to it', () => {
    const goTo = vi.fn();
    const { file, beatIds } = project();
    const after = updateBeat(file, beatIds[1]! as never, { title: 'The last one touched' });
    render(<Home start={after} onGoToBeat={goTo as never} />);

    expect(screen.getByText('Scene 2 · Two')).toBeTruthy();
    fireEvent.click(screen.getByText('Go back to it'));
    expect(goTo).toHaveBeenCalledWith(beatIds[1]);
  });

  it('says so honestly when nothing has been written', () => {
    const bare = { ...createProjectFile({ title: 'Nothing', format: 'screenplay' }), beats: [] };
    render(<Home start={bare} />);
    expect(screen.getByText(/This says where the writing last happened/)).toBeTruthy();
  });

  it('names what the one-sheet is still missing, as a fact', () => {
    const { file } = project();
    render(<Home start={file} />);
    // Stated, so nobody sends a sheet and finds out afterwards it was blank.
    expect(screen.getByText(/The sheet prints without them/)).toBeTruthy();
  });

  it('says nothing about gaps once they are filled', () => {
    const { file } = project();
    const told = setProjectDetails(file, {
      author: 'K. Shank',
      logline: 'A line.',
      elevatorPitch: 'A pitch.',
      synopsis: 'A synopsis.',
      genre: 'Thriller',
    });
    const made = setPoster(told, { name: 'art.png', data: DOT });
    render(<Home start={made.file} />);
    expect(screen.queryByText(/The sheet prints without/)).toBeNull();
  });

  it('says nothing is waiting rather than showing two noughts', () => {
    const { file } = project();
    render(<Home start={file} />);
    expect(screen.getByText('Nothing is waiting.')).toBeTruthy();
  });
});
