// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { BeatWriter } from '../components/BeatWriter';
import { Inspector } from '../components/Inspector';
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
  const chapter = addUnit(file, { trackId: file.tracks[0]!.id, title: 'Refraction' });
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
    const current = placeFigure(made.file, { beatId, assetId: made.asset.id }).file;

    render(<Graphics start={current} />);
    expect(screen.getByText('no description')).toBeTruthy();
    expect(screen.queryByText('not used yet')).toBeNull();
  });

  it('lists where a picture ended up, numbered in reading order', () => {
    const { file, beatId } = book();
    const made = addGraphic(file, { name: 'prism.png', data: DOT, altText: 'A prism.' });
    const current = placeFigure(made.file, { beatId, assetId: made.asset.id, caption: 'The split beam' }).file;

    render(<Graphics start={current} />);
    expect(screen.getByText(/Where it is used \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Figure 1/)).toBeTruthy();
    expect(screen.getByText('The split beam')).toBeTruthy();
  });

  it('says what removing a picture leaves behind before it removes it', () => {
    const { file, beatId } = book();
    const made = addGraphic(file, { name: 'prism.png', data: DOT });
    const current = placeFigure(made.file, { beatId, assetId: made.asset.id }).file;

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

  it('offers nothing to generate where the host has no bridge at all', async () => {
    delete (window as unknown as { vcwriter?: unknown }).vcwriter;
    const { file, beatId } = book();
    render(<Aids start={file} beatId={beatId} />);
    await waitFor(() => expect(screen.queryByText('Suggest one')).toBeNull());
  });
});

/**
 * The suggestion, end to end through the bridge (§10).
 *
 * The rule worth a test is the one the interface could still break after the
 * domain kept it: what comes back from a model is recorded with `suggestAid`,
 * which **cannot reach the author's text** — so the wiring is checked by
 * writing a paragraph, asking for a suggestion, and finding the paragraph
 * still there.
 */
describe('asking for a suggestion', () => {
  const bridge = (over: Partial<Record<string, unknown>> = {}) => {
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      learningAidStatus: async () => ({ ok: true, data: { available: true, reason: null } }),
      suggestLearningAid: async () => ({ ok: true, data: { text: 'Light bends at a boundary.', questions: [] } }),
      ...over,
    };
  };

  /** A section with words in it, so there is something to read. */
  const written = () => {
    const { file, beatId } = book();
    return {
      beatId,
      file: updateBeat(file, beatId, {
        manuscript: {
          elements: [
            { id: newId(), type: 'paragraph', text: 'A ray bends at the surface.', characterId: null, attributes: {} },
          ],
        },
      }),
    };
  };

  it('is not offered where the account cannot have one, and says why once', async () => {
    bridge({
      learningAidStatus: async () => ({
        ok: true,
        data: { available: false, reason: 'Sign in to have a suggestion written' },
      }),
    });
    const made = written();
    render(<Aids start={made.file} beatId={made.beatId} />);

    await waitFor(() => expect(screen.getByText('Sign in to have a suggestion written')).toBeTruthy());
    expect(screen.queryByText('Suggest one')).toBeNull();
    // Once at the foot, not three times beside three absent buttons.
    expect(screen.getAllByText('Sign in to have a suggestion written')).toHaveLength(1);
  });

  it('puts what comes back in the suggestion field and never in the author’s', async () => {
    let seen: ProjectFile | null = null;
    bridge();
    const made = written();
    const aid = aidFor(made.file, made.beatId, 'summary');
    const current = writeAid(aid.file, aid.aid.id, { text: 'What the author wrote.' });

    render(<Aids start={current} beatId={made.beatId} onFile={(one) => (seen = one)} />);
    await waitFor(() => expect(screen.getAllByText('Suggest another').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Suggest another')[0]!);

    await waitFor(() => {
      const after = (seen as unknown as ProjectFile).learningAids.find((one) => one.kind === 'summary')!;
      expect(after.suggestion).toBe('Light bends at a boundary.');
      // The whole of §10's hardest rule, checked where it could still break.
      expect(after.text).toBe('What the author wrote.');
    });
  });

  it('sends the section’s own words and nothing else about the book', async () => {
    const asked = vi.fn(async (_input: Record<string, unknown>) => ({
      ok: true,
      data: { text: 'A summary.', questions: [] },
    }));
    bridge({ suggestLearningAid: asked });
    const made = written();

    render(<Aids start={made.file} beatId={made.beatId} />);
    await waitFor(() => expect(screen.getAllByText('Suggest one').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Suggest one')[0]!);

    await waitFor(() => expect(asked).toHaveBeenCalled());
    expect(asked.mock.calls[0]![0]).toEqual({
      kind: 'summary',
      sectionText: 'A ray bends at the surface.',
      sectionTitle: 'Snell’s law',
    });
  });

  it('says it is reading while it reads, so nobody presses twice', async () => {
    let release: (value: unknown) => void = () => undefined;
    bridge({ suggestLearningAid: () => new Promise((resolve) => { release = resolve; }) });
    const made = written();

    render(<Aids start={made.file} beatId={made.beatId} />);
    await waitFor(() => expect(screen.getAllByText('Suggest one').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Suggest one')[0]!);

    await waitFor(() => expect(screen.getByText('Reading the section…')).toBeTruthy());
    expect((screen.getByText('Reading the section…') as HTMLButtonElement).disabled).toBe(true);
    release({ ok: true, data: { text: 'A summary.', questions: [] } });
    await waitFor(() => expect(screen.queryByText('Reading the section…')).toBeNull());
  });

  it('says what went wrong rather than failing quietly', async () => {
    bridge({ suggestLearningAid: async () => ({ ok: false, error: 'The reading ran long and was cut off.' }) });
    const made = written();

    render(<Aids start={made.file} beatId={made.beatId} />);
    await waitFor(() => expect(screen.getAllByText('Suggest one').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Suggest one')[0]!);

    await waitFor(() => expect(screen.getByText('The reading ran long and was cut off.')).toBeTruthy());
  });

  it('will not ask for one on a section with nothing written in it', async () => {
    bridge();
    const { file, beatId } = book();
    render(<Aids start={file} beatId={beatId} />);

    await waitFor(() => expect(screen.getAllByText('Suggest one').length).toBeGreaterThan(0));
    // The button is there and refuses, because the reason is about this
    // section rather than about the account.
    expect((screen.getAllByText('Suggest one')[0]! as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Write the section first.')).toBeTruthy();
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
 * looked at: a professor was being offered plot tracks, a character mind map,
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

  it('offers the graphics library on a novel too, and the importer only on a book', () => {
    research(createProjectFile({ title: 'A Novel', format: 'novel' }));
    expect(screen.getByText('Graphics')).toBeTruthy();
    expect(screen.queryByText('Import')).toBeNull();
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
    const current = placeFigure(made.file, { beatId: made.beatId, assetId: made.assetId, caption: 'The split beam' }).file;

    render(<Writing start={current} beatId={made.beatId} />);
    expect(screen.getByText('Figure 1')).toBeTruthy();
    expect((screen.getByLabelText('Figure 1 caption') as HTMLInputElement).value).toBe('The split beam');
    expect(document.querySelector('.figure-element img')).toBeTruthy();
  });

  it('keeps the figure standing when its picture leaves the library, and says so', () => {
    const made = withPicture();
    let current = placeFigure(made.file, { beatId: made.beatId, assetId: made.assetId }).file;
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

/**
 * §14, the rule Ken's own spec states: *a writer in Book Mode must never be
 * forced to work around Scene, Beat or Script.*
 *
 * Stage 1 built `nounsFor` for exactly this and pointed only the workspace
 * shell at it; seventeen components still said "Scene" and "Beat" in visible
 * text, and five of them held their own private copy of *chapter or scene?*.
 *
 * These are the surfaces a book author meets every day. The assertion that
 * matters is the **negative** one — that the word is not there — because a
 * missed label is exactly what this rule is about.
 */
describe('the words a book author is shown', () => {
  const written = () => {
    const made = book();
    return {
      beatId: made.beatId,
      file: updateBeat(made.file, made.beatId, {
        manuscript: {
          elements: [{ id: newId(), type: 'paragraph', text: 'A ray bends.', characterId: null, attributes: {} }],
        },
      }),
    };
  };

  it('never says Beat in the writing screen’s own chrome', () => {
    const made = written();
    const beat = made.file.beats.find((one) => one.id === made.beatId)!;
    render(<BeatWriter file={made.file} beat={beat} onUpdate={() => undefined} />);

    expect(screen.getByLabelText('Subsection name')).toBeTruthy();
    expect(screen.getByText('Subsection name')).toBeTruthy();
    expect(screen.queryByLabelText('Beat name')).toBeNull();
    // And the manuscript is a Book rather than a script.
    expect(screen.getByText('In book')).toBeTruthy();
    expect(screen.queryByText('In script')).toBeNull();
  });

  it('never says Beat in the Inspector', () => {
    const made = written();
    render(
      <Inspector file={made.file} selectedBeatId={made.beatId} onUpdate={() => undefined} />,
    );
    expect(screen.getByLabelText('Subsection colour')).toBeTruthy();
    expect(screen.queryByLabelText('Beat colour')).toBeNull();
  });

  it('keeps a screenplay saying exactly what it always said', () => {
    // The sweep must not have renamed anything for the format it was built for.
    let film = createProjectFile({ title: 'A Film', format: 'screenplay' });
    const unit = addUnit(film, { trackId: film.tracks[0]!.id, title: 'One' });
    const beat = addBeat(unit.file, { unitId: unit.unit.id, title: 'a beat' });
    film = beat.file;

    render(<BeatWriter file={film} beat={beat.beat} onUpdate={() => undefined} />);
    expect(screen.getByLabelText('Beat name')).toBeTruthy();
    expect(screen.getByText('In script')).toBeTruthy();
  });
});
