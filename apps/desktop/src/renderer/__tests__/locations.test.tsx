// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addDescription,
  addLocation,
  addUnit,
  createProjectFile,
  sceneHeadingOf,
  setSceneHeading,
  timesUsed,
  unitsInStoryOrder,
  useLocationInScene,
  type ProjectFile,
} from '@vcwriter/domain';
import { LocationsPanel } from '../components/LocationsPanel';

/**
 * The location library through the interface (addendum 14 §3).
 *
 * The rules are tested in the domain. What these cover is what a writer meets:
 * that the scenes listed are read from their headings, that a place already in
 * the script can be adopted rather than retyped, and that removing a record
 * says what it does and does not take.
 */

afterEach(cleanup);

const script = (scenes: number) => {
  let file: ProjectFile = createProjectFile({ title: 'The House', format: 'screenplay' });
  const trackId = file.tracks[0]!.id;
  for (let at = 0; at < scenes; at += 1) {
    const scene = addUnit(file, { trackId, title: `Scene ${at + 1}` });
    file = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' }).file;
  }
  return { file, ids: unitsInStoryOrder(file).map((unit) => unit.id) };
};

function Panel({ start, onFile }: { start: ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return <LocationsPanel file={file} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

describe('the library', () => {
  it('names a place, and says it is not in the script yet', () => {
    let seen: ProjectFile | null = null;
    const { file } = script(2);
    render(<Panel start={file} onFile={(one) => (seen = one)} />);
    fireEvent.change(screen.getByLabelText('New location'), { target: { value: 'Miller House' } });
    fireEvent.submit(screen.getByLabelText('New location').closest('form') as HTMLFormElement);

    expect((seen as unknown as ProjectFile).locations[0]!.name).toBe('MILLER HOUSE');
    // A fact about the script, not a grade about the writer.
    expect(screen.getByText('not used')).toBeTruthy();
  });

  it('lists the scenes that use it, read from their headings', () => {
    const { file, ids } = script(3);
    const made = addLocation(file, { name: 'Miller House' });
    let current = useLocationInScene(made.file, ids[0]!, made.location.id);
    current = useLocationInScene(current, ids[2]!, made.location.id);

    render(<Panel start={current} />);
    expect(screen.getByText(/Where it is used \(2\)/)).toBeTruthy();
    expect(timesUsed(current, made.location.id)).toBe(2);
  });

  it('offers a place the script already names, so it need not be retyped', () => {
    let seen: ProjectFile | null = null;
    const { file, ids } = script(2);
    const current = setSceneHeading(file, ids[0]!, { setting: 'INT.', place: 'THE BOAT', time: 'DAY' });
    render(<Panel start={current} onFile={(one) => (seen = one)} />);

    expect(screen.getByText('Already in the script')).toBeTruthy();
    fireEvent.click(screen.getByText('Make a record'));
    expect((seen as unknown as ProjectFile).locations.map((one) => one.name)).toEqual(['THE BOAT']);
  });

  it('keeps several prepared descriptions rather than one paragraph', () => {
    let seen: ProjectFile | null = null;
    const { file } = script(1);
    const made = addLocation(file, { name: 'Miller House' });
    render(<Panel start={made.file} onFile={(one) => (seen = one)} />);

    fireEvent.click(screen.getByText('+ Another description'));
    fireEvent.click(screen.getByText('+ Another description'));
    expect((seen as unknown as ProjectFile).locations[0]!.descriptions).toHaveLength(2);
  });

  it('says what removing it takes, and what it does not', () => {
    const { file, ids } = script(1);
    const made = addLocation(file, { name: 'Miller House' });
    const current = useLocationInScene(made.file, ids[0]!, made.location.id);
    render(<Panel start={current} />);

    fireEvent.click(screen.getByText('Remove this location'));
    // The scenes keep their headings; only the record goes.
    expect(screen.getByText(/Their headings keep the name/)).toBeTruthy();
  });

  it('says the defaults are defaults', () => {
    const { file } = script(1);
    render(<Panel start={addLocation(file, { name: 'Miller House' }).file} />);
    expect(screen.getByText(/Defaults for a heading, not facts about the place/)).toBeTruthy();
  });
});

describe('renaming', () => {
  it('carries the new name into the scenes that use it', () => {
    let seen: ProjectFile | null = null;
    const { file, ids } = script(1);
    const made = addLocation(file, { name: 'Miller House' });
    const current = useLocationInScene(made.file, ids[0]!, made.location.id);
    render(<Panel start={current} onFile={(one) => (seen = one)} />);

    fireEvent.change(screen.getByLabelText('Location name'), { target: { value: 'The Boat' } });
    const after = seen as unknown as ProjectFile;
    expect(sceneHeadingOf(after, ids[0]!)!.place).toBe('THE BOAT');
  });
});

describe('descriptions', () => {
  it('shows each one by name', () => {
    const { file } = script(1);
    let current = addLocation(file, { name: 'Miller House' }).file;
    const id = current.locations[0]!.id;
    current = addDescription(current, id, { title: 'Initial reveal', body: 'One.' });
    current = addDescription(current, id, { title: 'After the fire', body: 'Two.' });

    render(<Panel start={current} />);
    const list = within(document.querySelector('.locations-descriptions') as HTMLElement);
    expect(list.getByDisplayValue('Initial reveal')).toBeTruthy();
    expect(list.getByDisplayValue('After the fire')).toBeTruthy();
    // Nothing here inserts one: that is the scene's act.
    expect(screen.getByText(/Nothing is inserted just because the place is used/)).toBeTruthy();
  });
});
