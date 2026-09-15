// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addGraphic,
  addUnit,
  aidFor,
  createProjectFile,
  importFiles,
  newId,
  placeFigure,
  removeGraphic,
  updateBeat,
  suggestAid,
  writeAid,
  type BeatId,
  type ProjectFile,
  type ResearchCategoryId,
} from '@vcwriter/domain';
import { BeatBody } from '../components/BeatBody';
import { GraphicsPanel } from '../components/GraphicsPanel';
import { ImportNotesPanel } from '../components/ImportNotesPanel';
import { LearningAidsPanel } from '../components/LearningAidsPanel';
import { ResearchBody } from '../components/ResearchWindow';

/**
 * Instructional mode through the interface (addendum 16 §9, §10, §4).
 *
 * The rules are tested in the domain; these cover what a writer meets. Three of
 * them are the module's own decisions made visible, and they are the ones worth
 * having a test for:
 *
 *  - a picture nobody has placed says so **as a fact and never a warning**;
 *  - the machine's suggestion is in **its own box**, and accepting it offers
 *    the old wording back;
 *  - an import **names every file it could not read**.
 */

afterEach(cleanup);

/** A one-chapter instructional book with a section in it. */
const book = (): { file: ProjectFile; beatId: BeatId } => {
  const file = createProjectFile({ title: 'Teaching Optics', format: 'instructional' });
  const chapter = addUnit(file, { laneId: file.lanes[0]!.id, title: 'Refraction' });
  const made = addBeat(chapter.file, { unitId: chapter.unit.id, title: 'Snell’s law' });
  return { file: made.file, beatId: made.beat.id };
};

/** A one-pixel PNG, so nothing here depends on a real decoder. */
const DOT = 'data:image/png;base64,iVBORw0KGgo=';

function Graphics({ start, onFile }: { start: ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return <GraphicsPanel file={file} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

function Aids({ start, beatId, onFile }: { start: ProjectFile; beatId: BeatId; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return (
    <LearningAidsPanel file={file} beatId={beatId} onUpdate={(mutate) => setFile((current) => mutate(current))} />
  );
}

function Importer({ start, onFile }: { start: ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return <ImportNotesPanel file={file} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

describe('the graphics library', () => {
  it('says a picture is not in the book yet, as a fact rather than a fault', () => {
    const { file } = book();
    render(<Graphics start={addGraphic(file, { name: 'prism.png', data: DOT }).file} />);

    expect(screen.getByText('not used yet')).toBeTruthy();
    // And nothing anywhere calls it a problem.
    expect(screen.queryByText('no description')).toBeNull();
  });

  it('flags a picture that is in the book with nothing said about it', () => {
    const { file, beatId } = book();
    const made = addGraphic(file, { name: 'prism.png', data: DOT });
    const current = placeFigure(made.file, { beatId, assetId: made.asset.id });

    render(<Graphics start={current} />);
    expect(screen.getByText('no description')).toBeTruthy();
    expect(screen.queryByText('not used yet')).toBeNull();
  });

  it('lists where a picture ended up, numbered in reading order', () => {
    const { file, beatId } = book();
    const made = addGraphic(file, { name: 'prism.png', data: DOT, altText: 'A prism.' });
    const current = placeFigure(made.file, { beatId, assetId: made.asset.id, caption: 'The split beam' });

    render(<Graphics start={current} />);
    expect(screen.getByText(/Where it is used \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Figure 1/)).toBeTruthy();
    expect(screen.getByText('The split beam')).toBeTruthy();
  });

  it('says what removing a picture leaves behind before it removes it', () => {
    const { file, beatId } = book();
    const made = addGraphic(file, { name: 'prism.png', data: DOT });
    const current = placeFigure(made.file, { beatId, assetId: made.asset.id });

    render(<Graphics start={current} />);
    fireEvent.click(screen.getByText('Remove this graphic'));
    // §3: the words around a figure referred to it, so nothing cascades.
    expect(screen.getByText(/reads as missing. The writing around them is untouched/)).toBeTruthy();
  });
});

describe('the learning aids', () => {
  it('offers all three kinds, and calls none of them missing', () => {
    const { file, beatId } = book();
    render(<Aids start={file} beatId={beatId} />);

    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.getByText('What you learned')).toBeTruthy();
    expect(screen.getByText('Review questions')).toBeTruthy();
    // §10 says these are optional, so an empty one states a fact.
    expect(screen.getAllByText('Nothing written yet.').length).toBeGreaterThan(0);
  });

  it('keeps the machine’s words out of the author’s box', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    let current = writeAid(made.file, made.aid.id, { text: 'Light bends.' });
    current = suggestAid(current, made.aid.id, { text: 'Light changes speed.', questions: [] });

    render(<Aids start={current} beatId={beatId} />);
    // The author's, in the field that prints.
    expect((screen.getByLabelText('Summary — your words') as HTMLTextAreaElement).value).toBe('Light bends.');
    // The machine's, in a box of its own.
    const offer = within(document.querySelector('.aid-offer') as HTMLElement);
    expect(offer.getByText('Light changes speed.')).toBeTruthy();
    // And what pressing it costs, said rather than discovered.
    expect(screen.getByText('Replaces what you wrote. You can put it back.')).toBeTruthy();
  });

  it('hands the old wording back after accepting, and puts it back on request', () => {
    let seen: ProjectFile | null = null;
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    let current = writeAid(made.file, made.aid.id, { text: 'Light bends.' });
    current = suggestAid(current, made.aid.id, { text: 'Light changes speed.', questions: [] });

    render(<Aids start={current} beatId={beatId} onFile={(one) => (seen = one)} />);
    fireEvent.click(screen.getByText('Use this'));
    expect((seen as unknown as ProjectFile).learningAids[0]!.text).toBe('Light changes speed.');

    fireEvent.click(screen.getByText('Put it back'));
    expect((seen as unknown as ProjectFile).learningAids[0]!.text).toBe('Light bends.');
  });

  it('keeps going in the book a separate decision from the words', () => {
    let seen: ProjectFile | null = null;
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    const current = writeAid(made.file, made.aid.id, { text: 'Light bends.' });

    render(<Aids start={current} beatId={beatId} onFile={(one) => (seen = one)} />);
    const checks = screen.getAllByText('In the book');
    fireEvent.click(checks[0]!.previousElementSibling as HTMLInputElement);
    expect((seen as unknown as ProjectFile).learningAids[0]!.approved).toBe(true);
  });

  it('will not put an empty aid in the book', () => {
    const { file, beatId } = book();
    render(<Aids start={file} beatId={beatId} />);
    const first = screen.getAllByText('In the book')[0]!.previousElementSibling as HTMLInputElement;
    expect(first.disabled).toBe(true);
  });

  it('offers nothing to generate where no generator is configured', () => {
    const { file, beatId } = book();
    render(<Aids start={file} beatId={beatId} />);
    expect(screen.queryByText('Suggest one')).toBeNull();
  });
});

describe('the importer', () => {
  it('names every file it could not read', () => {
    const { file } = book();
    const notes = file.researchCategories.find((one) => one.systemKey === 'notes')!.id as ResearchCategoryId;
    const done = importFiles(
      file,
      [
        { name: 'lecture.md', text: '# One\nFirst.\n\n# Two\nSecond.' },
        { name: 'slides.pptx' },
        { name: 'blank.txt', text: '   ' },
      ],
      { notesCategoryId: notes },
    );

    render(<Importer start={done.file} />);
    // The successes are counted; the three that need a look are named.
    expect(screen.getByText('slides.pptx')).toBeTruthy();
    expect(screen.getByText('blank.txt')).toBeTruthy();
    expect(screen.queryByText('lecture.md')).toBeNull();
  });

  it('says what splitting does before anybody drops anything', () => {
    const { file } = book();
    render(<Importer start={file} />);
    expect(screen.getByText(/Markdown is split on its headings/)).toBeTruthy();
    // The inbox is a real shelf, so it is a choice rather than a behaviour.
    expect(screen.getByText('Hold them in Imported until I classify them')).toBeTruthy();
  });
});

/**
 * The menu *is* the taxonomy (§3, and Ken's §15 that the two research systems
 * stay distinct). Every one of these was wrong on the screen before it was
 * looked at: a professor was being offered plot lanes, a character mind map,
 * and research *used in the script*.
 */
describe('the research menu on a book', () => {
  const research = (file: ProjectFile) =>
    render(
      <ResearchBody file={file} currentBeatId={null} onClose={() => undefined} onUpdate={() => undefined} />,
    );

  it('offers the importer and the graphics library', () => {
    research(book().file);
    expect(screen.getByText('Import')).toBeTruthy();
    expect(screen.getByText('Graphics')).toBeTruthy();
  });

  it('offers no narrative machinery at all', () => {
    research(book().file);
    for (const gone of ['Plots', 'Setups & payoffs', 'Locations', 'Character map', 'Character review']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    // Kept: a work of nonfiction has themes, threads and a phone.
    expect(screen.getByText('Themes & motifs')).toBeTruthy();
    expect(screen.getByText('Links')).toBeTruthy();
  });

  it('names the manuscript from the noun table rather than saying "script"', () => {
    research(book().file);
    expect(screen.getByText('Used in the book')).toBeTruthy();
    cleanup();

    research(createProjectFile({ title: 'A Film', format: 'screenplay' }));
    expect(screen.getByText('Used in the script')).toBeTruthy();
  });

  it('leaves a screenplay’s menu exactly as it was', () => {
    research(createProjectFile({ title: 'A Film', format: 'screenplay' }));
    for (const kept of ['Plots', 'Setups & payoffs', 'Locations', 'Character map', 'Character review']) {
      // getAll, because a screenplay also seeds a *folder* called Locations.
      expect(screen.getAllByText(kept).length).toBeGreaterThan(0);
    }
    // And is offered neither of the instructional screens.
    expect(screen.queryByText('Graphics')).toBeNull();
  });
});

/**
 * A figure in the writing (§3, §9).
 *
 * This is the half the screenshot caught missing: the domain could place a
 * figure and the manuscript drew it as a stray caption with no picture, and
 * nothing anywhere could place one in the first place.
 */
describe('a figure in the manuscript', () => {
  function Writing({ start, beatId, onFile }: { start: ProjectFile; beatId: BeatId; onFile?(f: ProjectFile): void }) {
    const [file, setFile] = useState(start);
    onFile?.(file);
    const beat = file.beats.find((one) => one.id === beatId)!;
    return <BeatBody file={file} beat={beat} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
  }

  /** A section with one paragraph in it, and a picture waiting in the library. */
  const withPicture = () => {
    const { file, beatId } = book();
    const written = updateBeat(file, beatId, {
      manuscript: {
        elements: [
          { id: newId(), type: 'paragraph', text: 'A ray bends at the surface.', characterId: null, attributes: {} },
        ],
      },
    });
    const made = addGraphic(written, { name: 'prism.svg', data: DOT, caption: 'The split beam' });
    return { file: made.file, beatId, assetId: made.asset.id };
  };

  it('draws the picture, its number and its caption where the author put it', () => {
    const made = withPicture();
    const current = placeFigure(made.file, { beatId: made.beatId, assetId: made.assetId, caption: 'The split beam' });

    render(<Writing start={current} beatId={made.beatId} />);
    expect(screen.getByText('Figure 1')).toBeTruthy();
    expect((screen.getByLabelText('Figure 1 caption') as HTMLInputElement).value).toBe('The split beam');
    expect(document.querySelector('.figure-element img')).toBeTruthy();
  });

  it('keeps the figure standing when its picture leaves the library, and says so', () => {
    const made = withPicture();
    let current = placeFigure(made.file, { beatId: made.beatId, assetId: made.assetId });
    current = removeGraphic(current, made.assetId);

    render(<Writing start={current} beatId={made.beatId} />);
    // §12: deleting a picture is not a cascade through somebody's writing.
    expect(screen.getByText(/no longer in the library/)).toBeTruthy();
    expect(document.querySelector('.figure-element.missing')).toBeTruthy();
  });

  it('offers to put one in, on a book with pictures and nowhere else', () => {
    const made = withPicture();
    render(<Writing start={made.file} beatId={made.beatId} />);
    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    expect(screen.getByText('Put a figure here…')).toBeTruthy();
    cleanup();

    // An empty library is not an offer: there is nothing to put.
    const bare = book();
    const written = updateBeat(bare.file, bare.beatId, {
      manuscript: {
        elements: [{ id: newId(), type: 'paragraph', text: 'A ray bends.', characterId: null, attributes: {} }],
      },
    });
    render(<Writing start={written} beatId={bare.beatId} />);
    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    expect(screen.queryByText('Put a figure here…')).toBeNull();
  });

  it('puts it in after the line that was clicked, with the picture’s caption to start', () => {
    let seen: ProjectFile | null = null;
    const made = withPicture();
    render(<Writing start={made.file} beatId={made.beatId} onFile={(one) => (seen = one)} />);

    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    fireEvent.click(screen.getByText('Put a figure here…'));
    // The caption arrives as the picture's, and is the placement's from here on.
    expect((screen.getByLabelText('Caption') as HTMLInputElement).value).toBe('The split beam');
    fireEvent.click(screen.getByText('Put it in'));

    const after = (seen as unknown as ProjectFile).beats.find((one) => one.id === made.beatId)!;
    expect(after.manuscript.elements.map((one) => one.type)).toEqual(['paragraph', 'figure']);
  });
});
