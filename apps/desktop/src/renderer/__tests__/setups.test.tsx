// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addSetupPayoff,
  addSetupPoint,
  addUnit,
  createProjectFile,
  recordPayoff,
  ref,
  type BeatId,
  type ManuscriptElementId,
  type ProjectFile,
} from '@vcwriter/domain';
import { BeatBody } from '../components/BeatBody';
import { SetupsPanel } from '../components/SetupsPanel';

/**
 * Setups & payoffs through the interface.
 *
 * The rule is tested in the domain. What these cover is what a writer meets:
 * that the light and the count are on the list without opening anything, that
 * a point which falls after the payoff says so rather than quietly vanishing,
 * and that a passage can be made a setup or the payoff from the writing.
 */

afterEach(cleanup);

const para = (text: string) => ({
  id: crypto.randomUUID() as ManuscriptElementId,
  type: 'action' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A script of four scenes with a line in each. */
const script = () => {
  let file: ProjectFile = createProjectFile({ title: 'The Gun', format: 'screenplay' });
  const trackId = file.tracks[0]!.id;
  const beatIds: BeatId[] = [];
  for (const line of ['She opens the drawer.', 'He asks about it.', 'She fires it.', 'Nobody moves.']) {
    const scene = addUnit(file, { trackId, title: line });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
    file = { ...beat.file };
    file = {
      ...file,
      beats: file.beats.map((one) =>
        one.id === beat.beat.id ? { ...one, manuscript: { elements: [para(line)] } } : one,
      ),
    };
    beatIds.push(beat.beat.id);
  }
  return { file, beatIds };
};

function Panel({ start, onFile }: { start: ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return <SetupsPanel file={file} currentBeatId={null} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

describe('the light, without opening anything', () => {
  it('is red with a count beside it, and turns green at three', () => {
    const { file, beatIds } = script();
    let start = addSetupPayoff(file, { title: 'The gun', description: '' });
    const id = start.setupsPayoffs[0]!.id;
    start = recordPayoff(start, { setupPayoffId: id, description: 'It fires', location: ref('beat', beatIds[3]!) });
    for (const at of [0, 1]) {
      start = addSetupPoint(start, {
        setupPayoffId: id,
        description: `setup ${at}`,
        location: ref('beat', beatIds[at]!),
        strength: 'written',
      });
    }

    render(<Panel start={start} />);
    // On the list, without opening the record.
    expect(within(document.querySelector('.setups-list') as HTMLElement).getByText('2 / 3')).toBeTruthy();
    expect(document.querySelector('.setup-light.green')).toBeNull();

    // The third one, before the payoff.
    cleanup();
    const third = addSetupPoint(start, {
      setupPayoffId: id,
      description: 'setup 2',
      location: ref('beat', beatIds[2]!),
      strength: 'written',
    });
    render(<Panel start={third} />);
    expect(within(document.querySelector('.setups-list') as HTMLElement).getByText('3 / 3')).toBeTruthy();
    expect(document.querySelector('.setup-light.green')).toBeTruthy();
  });

  it('says why a point after the payoff does not count, rather than dropping it', () => {
    const { file, beatIds } = script();
    let start = addSetupPayoff(file, { title: 'The gun', description: '' });
    const id = start.setupsPayoffs[0]!.id;
    start = recordPayoff(start, { setupPayoffId: id, description: 'It fires', location: ref('beat', beatIds[1]!) });
    start = addSetupPoint(start, {
      setupPayoffId: id,
      description: 'the late one',
      location: ref('beat', beatIds[3]!),
      strength: 'written',
    });

    render(<Panel start={start} />);
    // Listed, with its place and its reason — a point that silently stopped
    // counting is worse than one that says why.
    expect(screen.getByText(/Falls after the payoff/)).toBeTruthy();
    expect(screen.getByDisplayValue('the late one')).toBeTruthy();
  });
});

function Writing({
  start,
  beatId,
  onFile,
}: {
  start: ProjectFile;
  beatId: BeatId;
  onFile?(file: ProjectFile): void;
}) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  const beat = file.beats.find((one) => one.id === beatId)!;
  return <BeatBody file={file} beat={beat} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

describe('planting one from the writing', () => {
  it('offers it on the right-click and makes a record and a point in one act', () => {
    let seen: ProjectFile | null = null;
    const { file, beatIds } = script();
    render(<Writing start={file} beatId={beatIds[0]!} onFile={(one) => (seen = one)} />);

    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    fireEvent.click(screen.getByText('Make this a setup or a payoff…'));

    fireEvent.change(screen.getByLabelText('Payoff'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('New payoff'), { target: { value: 'The gun in the drawer' } });
    fireEvent.change(screen.getByLabelText('What this point does'), { target: { value: 'She opens it' } });
    fireEvent.click(screen.getByText('Plant it'));

    const made = (seen as unknown as ProjectFile).setupsPayoffs;
    expect(made).toHaveLength(1);
    expect(made[0]!.title).toBe('The gun in the drawer');
    expect(made[0]!.setups).toHaveLength(1);
    expect(made[0]!.setups[0]!.description).toBe('She opens it');
    // The page's words are kept as the excerpt; the writer's words are the
    // description.
    expect(made[0]!.setups[0]!.excerpt).toBe('She opens the drawer.');
    expect(made[0]!.payoff).toBeNull();
  });

  it('files the payoff instead when the payoff is chosen', () => {
    let seen: ProjectFile | null = null;
    const { file, beatIds } = script();
    render(
      <Writing
        start={addSetupPayoff(file, { title: 'The gun', description: '' })}
        beatId={beatIds[0]!}
        onFile={(one) => (seen = one)}
      />,
    );

    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    fireEvent.click(screen.getByText('Make this a setup or a payoff…'));
    fireEvent.click(screen.getByText('The payoff'));
    fireEvent.click(screen.getByText('Pay it off'));

    const made = (seen as unknown as ProjectFile).setupsPayoffs[0]!;
    expect(made.payoff?.location).not.toBeNull();
    expect(made.setups).toHaveLength(0);
  });

  it('will not file one with no payoff to file it against', () => {
    const { file, beatIds } = script();
    render(<Writing start={file} beatId={beatIds[0]!} />);
    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    fireEvent.click(screen.getByText('Make this a setup or a payoff…'));

    // No records yet, so the only choice is to name one — and until it is
    // named there is nothing to plant into.
    expect((screen.getByText('Plant it') as HTMLButtonElement).disabled).toBe(true);
  });
});
