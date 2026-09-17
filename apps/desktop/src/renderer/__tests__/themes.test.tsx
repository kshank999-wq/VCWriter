// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addMotif,
  addTheme,
  addUnit,
  createProjectFile,
  tagPassage,
  updateBeat,
  type BeatId,
  type ManuscriptElementId,
  type ProjectFile,
} from '@vcwriter/domain';
import { BeatBody } from '../components/BeatBody';
import { ThemesPanel } from '../components/ThemesPanel';

/**
 * Themes & motifs through the interface (addendum 12).
 *
 * The readings are tested in the domain. What these cover is the one thing the
 * spec insists on and an interface can quietly lose: **theme and motif stay two
 * separate choices**, with their own lists and their own fields — and that a
 * passage which has been cut says so on the screen rather than disappearing.
 */

afterEach(cleanup);

const para = (text: string) => ({
  id: crypto.randomUUID() as ManuscriptElementId,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const book = (lines: string[]) => {
  let file: ProjectFile = createProjectFile({ title: 'The Bell', format: 'novel' });
  const trackId = file.tracks[0]!.id;
  const beatIds: BeatId[] = [];
  const elementIds: ManuscriptElementId[] = [];
  for (const line of lines) {
    const scene = addUnit(file, { trackId, title: line.slice(0, 16) });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
    const element = para(line);
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [element] } });
    beatIds.push(beat.beat.id);
    elementIds.push(element.id);
  }
  return { file, beatIds, elementIds };
};

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

describe('tagging from the writing', () => {
  it('offers theme and motif as separate choices, never one picker', () => {
    const { file, beatIds } = book(['The bell rang.']);
    render(<Writing start={file} beatId={beatIds[0]!} />);
    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    fireEvent.click(screen.getByText('Tag a theme or a motif…'));

    expect(screen.getByRole('radio', { name: 'A theme' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'A motif' })).toBeTruthy();
    // Opens on a theme, and asks nothing a theme does not have.
    expect(screen.getByLabelText('Theme')).toBeTruthy();
    expect(screen.queryByLabelText('Motif type')).toBeNull();
  });

  it('asks a motif what kind of thing it is, and a theme nothing of the sort', () => {
    const { file, beatIds } = book(['The bell rang.']);
    render(<Writing start={file} beatId={beatIds[0]!} />);
    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    fireEvent.click(screen.getByText('Tag a theme or a motif…'));
    fireEvent.click(screen.getByRole('radio', { name: 'A motif' }));

    // The field that makes a motif a different kind rather than a flag.
    expect(screen.getByLabelText('Motif type')).toBeTruthy();
    expect(screen.getByLabelText('New motif')).toBeTruthy();
  });

  it('makes the motif and the occurrence in one act, keeping the page’s words', () => {
    let seen: ProjectFile | null = null;
    const { file, beatIds } = book(['The bell rang once, in 1911.']);
    render(<Writing start={file} beatId={beatIds[0]!} onFile={(one) => (seen = one)} />);
    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    fireEvent.click(screen.getByText('Tag a theme or a motif…'));
    fireEvent.click(screen.getByRole('radio', { name: 'A motif' }));
    fireEvent.change(screen.getByLabelText('New motif'), { target: { value: 'the bell' } });
    fireEvent.change(screen.getByLabelText('Motif type'), { target: { value: 'sound' } });
    fireEvent.change(screen.getByLabelText('What this moment does'), { target: { value: 'The first time' } });
    fireEvent.click(screen.getByText('Tag it'));

    const made = seen as unknown as ProjectFile;
    expect(made.motifs).toHaveLength(1);
    expect(made.motifs[0]!.motifType).toBe('sound');
    // No theme was made: the kinds do not leak into each other.
    expect(made.themes).toHaveLength(0);
    expect(made.usageLinks).toHaveLength(1);
    expect(made.usageLinks[0]!.ownerKind).toBe('motif');
    expect(made.usageLinks[0]!.quote).toBe('The bell rang once, in 1911.');
    expect(made.usageLinks[0]!.note).toBe('The first time');
  });
});

function Panel({ start, onFile }: { start: ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return <ThemesPanel file={file} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

/** A book with one theme and one motif, each tagged. */
const tagged = () => {
  const { file, beatIds, elementIds } = book(['The bell rang.', 'Nobody came.']);
  let current = file;
  const theme = addTheme(current, { name: 'What a town owes its dead', arcNotes: 'Refused, then paid' });
  current = theme.file;
  const motif = addMotif(current, { name: 'the bell', motifType: 'sound' });
  current = motif.file;
  current = tagPassage(current, { kind: 'theme', ownerId: theme.theme.id as string, beatId: beatIds[1]! }).file;
  // Anchored to the paragraph, which is what the right-click does — so cutting
  // the line orphans the occurrence while leaving the beat standing.
  for (const at of [0, 1]) {
    current = tagPassage(current, {
      kind: 'motif',
      ownerId: motif.motif.id as string,
      beatId: beatIds[at]!,
      elementId: elementIds[at]!,
      quote: 'The bell rang.',
    }).file;
  }
  return { file: current, beatIds };
};

describe('the screen', () => {
  it('is two tabs with their own lists, not one list with a filter', () => {
    render(<Panel start={tagged().file} />);
    expect(screen.getByRole('tab', { name: 'Themes (1)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Motifs (1)' })).toBeTruthy();

    const list = within(document.querySelector('.thematics-list') as HTMLElement);
    expect(list.getByText('What a town owes its dead')).toBeTruthy();
    expect(list.queryByText('the bell')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Motifs (1)' }));
    expect(list.getByText('the bell')).toBeTruthy();
    expect(list.queryByText('What a town owes its dead')).toBeNull();
  });

  it('shows each kind its own field and never the other’s', () => {
    render(<Panel start={tagged().file} />);
    // A theme's intended arc.
    expect(screen.getByLabelText('Intended arc')).toBeTruthy();
    expect(screen.queryByLabelText('Motif type')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Motifs (1)' }));
    expect(screen.getByLabelText('Motif type')).toBeTruthy();
    expect(screen.queryByLabelText('Intended arc')).toBeNull();
  });

  it('lists the occurrences in story order, with a count that is a fact', () => {
    render(<Panel start={tagged().file} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Motifs (1)' }));

    const places = screen.getAllByText(/Scene \d+ · Beat 1/);
    expect(places).toHaveLength(2);
    expect(screen.getByText(/Where it appears \(2\)/i)).toBeTruthy();
    // No target, no grade — §12 forbids prescriptive scoring.
    expect(screen.queryByText(/of 3/)).toBeNull();
  });

  it('keeps an occurrence whose passage was cut and says it has gone', () => {
    const { file, beatIds } = tagged();
    // Cut the writing the first sighting was on.
    const cut = updateBeat(file, beatIds[0]!, { manuscript: { elements: [] } });
    render(<Panel start={cut} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Motifs (1)' }));

    expect(screen.getByText(/has gone/)).toBeTruthy();
    expect(document.querySelector('.thematic-occurrences li.gone')).toBeTruthy();
    // Counted as lost rather than dropped.
    expect(screen.getAllByText(/1 lost/).length).toBeGreaterThan(0);
  });

  it('asks before removing, and says what goes with it', () => {
    let seen: ProjectFile | null = null;
    render(<Panel start={tagged().file} onFile={(one) => (seen = one)} />);
    fireEvent.click(screen.getByText('Remove this theme and its taggings'));

    expect(screen.getByText(/The writing is untouched/)).toBeTruthy();
    fireEvent.click(screen.getByText('Remove it'));

    const after = seen as unknown as ProjectFile;
    expect(after.themes).toHaveLength(0);
    expect(after.usageLinks.filter((one) => one.ownerKind === 'theme')).toHaveLength(0);
    // The motif's occurrences are untouched.
    expect(after.usageLinks.filter((one) => one.ownerKind === 'motif')).toHaveLength(2);
  });
});
