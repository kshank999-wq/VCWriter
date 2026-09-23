// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addCharacter,
  addResearchCategory,
  addResearchItem,
  addTrack,
  addUnit,
  castByCategory,
  createProjectFile,
  graveyard,
  tracksInOrder,
  type ProjectFile,
} from '@vcwriter/domain';
import { ResearchWindow } from '../components/ResearchWindow';
import { TitleBar } from '../components/TitleBar';

/**
 * The research window (addendum 02 §7): folders down the side, what is in
 * the folder in the middle, the thing itself on the right.
 */

afterEach(cleanup);

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  return (
    <ResearchWindow
      file={file}
      open
      currentBeatId={null}
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

/** Ideas holds a note; Characters holds a Mike folder with one of his own. */
const withNotes = () => {
  let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
  const characters = file.researchCategories.find((category) => category.systemKey === 'characters')!;
  file = addResearchItem(file, { categoryId: ideas.id, title: 'A revolver in the drawer' });
  const mike = addResearchCategory(file, { name: 'Mike', parentId: characters.id });
  file = addResearchItem(mike.file, { categoryId: mike.category.id, title: 'Wears his father’s coat' });
  return file;
};

describe('the research window', () => {
  it('is opened from the title bar, so it survives the Script leaving', () => {
    const onOpenResearch = vi.fn();
    render(
      <TitleBar
        file={createProjectFile({ title: 'T', format: 'screenplay' })}
        pages={1}
        beatCount={1}
        wordCount={0}
        writing
        focusMode={false}
        onFocus={() => undefined}
        onOpenResearch={onOpenResearch}
        onOpenSculptor={() => undefined}
        onOpenOutliner={() => undefined}
        away={['script']}
        onBringBack={() => undefined}
        account={{ configured: false, signedIn: false, email: null }}
        syncing={false}
        onSync={() => undefined}
        saveState="saved"
        onPreferences={() => undefined}
      />,
    );
    // The Script is in a window of its own, and Research is still right here.
    fireEvent.click(screen.getByText('Research'));
    expect(onOpenResearch).toHaveBeenCalled();
    // The categories are not a strip of tabs anywhere.
    expect(screen.queryByRole('tab', { name: /^Ideas/ })).toBeNull();
  });

  it('shows the folders as a tree, with what is under each of them', () => {
    const { container } = render(<Harness initial={withNotes()} />);
    const side = within(screen.getByLabelText('Research folders'));

    expect(side.getByText('Characters')).toBeDefined();
    expect(side.getByText('Mike')).toBeDefined();
    // Mike is nested under Characters, so he is drawn further in.
    const rows = Array.from(container.querySelectorAll('.research-side .folder-row')) as HTMLElement[];
    const characters = rows.find((row) => row.textContent?.includes('Characters'))!;
    const mike = rows.find((row) => row.textContent?.includes('Mike'))!;
    expect(parseInt(mike.style.paddingLeft)).toBeGreaterThan(parseInt(characters.style.paddingLeft));
  });

  it('opens a folder on one click and renames it on two', () => {
    render(<Harness initial={withNotes()} />);
    const side = within(screen.getByLabelText('Research folders'));

    // One click opens it: the middle column is now Mike's.
    fireEvent.click(side.getByText('Mike'));
    expect(screen.getByLabelText('Notes')).toBeDefined();
    expect(within(screen.getByLabelText('Notes')).getByText('Wears his father’s coat')).toBeDefined();
    // …and does not put the name into an edit box on the way.
    expect(side.queryByLabelText('Folder name')).toBeNull();

    fireEvent.doubleClick(side.getByText('Mike'));
    fireEvent.change(side.getByLabelText('Folder name'), { target: { value: 'Mike Hanlon' } });
    fireEvent.keyDown(side.getByLabelText('Folder name'), { key: 'Enter' });
    expect(side.getByText('Mike Hanlon')).toBeDefined();
  });

  it('shows a folder with everything under it, and opens a note on the right', () => {
    render(<Harness initial={withNotes()} />);
    fireEvent.click(within(screen.getByLabelText('Research folders')).getByText('Characters'));

    // Mike's note is in Characters because it is in a folder under it.
    fireEvent.click(within(screen.getByLabelText('Notes')).getByText('Wears his father’s coat'));
    const detail = within(screen.getByLabelText('Detail'));
    expect((detail.getByLabelText('Title') as HTMLInputElement).value).toBe('Wears his father’s coat');
    expect((detail.getByLabelText('Folder') as HTMLSelectElement).selectedOptions[0]!.text).toContain('Mike');
  });

  it('moves a note to used and back, with the record surviving both', () => {
    render(<Harness initial={withNotes()} />);
    const notes = () => within(screen.getByLabelText('Notes'));
    fireEvent.click(notes().getByText('A revolver in the drawer'));
    fireEvent.click(screen.getByRole('button', { name: /mark used/i }));

    // It leaves the working inventory and turns up under what has been used.
    fireEvent.click(screen.getByRole('button', { name: /Not yet used/ }));
    expect(notes().queryByText('A revolver in the drawer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Used in the script/ }));
    expect(notes().getByText('A revolver in the drawer')).toBeDefined();

    fireEvent.click(notes().getByText('A revolver in the drawer'));
    fireEvent.click(screen.getByRole('button', { name: /back to not used/i }));
    fireEvent.click(screen.getByRole('button', { name: /Not yet used/ }));
    expect(notes().getByText('A revolver in the drawer')).toBeDefined();
  });

  it('searches across everything, whatever folder it is in', () => {
    render(<Harness initial={withNotes()} />);
    fireEvent.change(screen.getByLabelText('Search research'), { target: { value: 'coat' } });
    expect(screen.getByText('Wears his father’s coat')).toBeDefined();
    expect(screen.queryByText('A revolver in the drawer')).toBeNull();
  });

  it('makes a folder inside the one in hand, and removing it keeps what was filed there', () => {
    render(<Harness initial={withNotes()} />);
    const side = within(screen.getByLabelText('Research folders'));
    fireEvent.click(side.getByText('Mike'));
    fireEvent.click(screen.getByText('+ Folder'));

    expect(side.getByText('New folder')).toBeDefined();
    // It asks now, and says where what is in it goes (addendum 24 §5g).
    fireEvent.click(side.getByLabelText('Remove New folder'));
    expect(screen.getByText(/The folder goes\. Nothing is in it\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(side.queryByText('New folder')).toBeNull();
    // Mike's note is untouched by any of it.
    expect(screen.getByText('Wears his father’s coat')).toBeDefined();
  });

  /**
   * From Ken: *I need a delete for research notes and folders too*. The note's
   * delete was §5a's, in the detail beside *Put away*; it is on the card now
   * (addendum 24 §5g), which is where a writer looking at the note they want
   * rid of is looking.
   */
  it('deletes a note from its own card, and Put away stays in the detail', () => {
    let seen: ProjectFile | null = null;
    function Watched() {
      const [file, setFile] = useState(withNotes());
      seen = file;
      return (
        <ResearchWindow
          file={file}
          open
          currentBeatId={null}
          onClose={() => undefined}
          onUpdate={(mutate) => setFile((current) => mutate(current))}
        />
      );
    }
    render(<Watched />);
    const notes = () => within(screen.getByLabelText('Notes'));
    fireEvent.click(notes().getByText('A revolver in the drawer'));
    // One act, on the card; archiving is still the detail's.
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(within(screen.getByLabelText('Detail')).getByRole('button', { name: /put away/i })).toBeDefined();

    fireEvent.click(screen.getByLabelText('Delete A revolver in the drawer'));
    expect(screen.getByText(/goes to the graveyard/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const after = seen as unknown as ProjectFile;
    expect(notes().queryByText('A revolver in the drawer')).toBeNull();
    expect(graveyard(after).map((row) => row.word)).toEqual(['Note']);
  });

  /**
   * From Ken: *I need a delete for plots and threads too*. A plot is a track,
   * which is structure rather than a research record, so it never goes to the
   * graveyard — and the promise the room keeps everywhere else is kept here by
   * **moving the scenes rather than cutting them** (addendum 24 §5e).
   */
  it('deletes a plot from its row, keeping every scene on it', () => {
    let seen: ProjectFile | null = null;
    function Watched() {
      let start = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
      const made = addTrack(start, { name: 'Subplot', kind: 'subplot' });
      start = made.file;
      const scene = addUnit(start, { trackId: made.track.id, title: 'Her mother calls' });
      start = scene.file;
      const [file, setFile] = useState(start);
      seen = file;
      return (
        <ResearchWindow
          file={file}
          open
          currentBeatId={null}
          onClose={() => undefined}
          onUpdate={(mutate) => setFile((current) => mutate(current))}
        />
      );
    }
    render(<Watched />);
    fireEvent.click(screen.getByRole('button', { name: /^Plots/ }));

    fireEvent.click(screen.getByLabelText('Delete Subplot'));
    // One sentence: what is on it, and where those scenes would go.
    expect(screen.getByText(/1 scene is on it\. They can move to Main Plot/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Move them and delete the plot' }));
    const after = seen as unknown as ProjectFile;
    expect(tracksInOrder(after).map((track) => track.name)).toEqual(['Main Plot']);
    // Not a word cut: the scene is on the remaining plot.
    expect(after.units.map((unit) => unit.title)).toContain('Her mother calls');
  });

  it('will not offer to delete the only plot, there being nowhere for scenes to live', () => {
    render(<Harness initial={withNotes()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Plots/ }));
    expect(screen.queryByLabelText('Delete Main Plot')).toBeNull();
  });

  it('keeps the plots and the setups in the same menu', () => {
    render(<Harness initial={withNotes()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Plots/ }));
    expect(screen.getByLabelText('Kind of Main Plot')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^Setups & payoffs/ }));
    expect(screen.getByRole('heading', { name: /setups/i })).toBeDefined();
  });
});

/**
 * Getting into the Character Creator (addendum 08 §5).
 *
 * The module was built and then could not be found: it lived behind a small
 * button on a row inside one folder, and any click in the side menu threw it
 * away. Both of those are what these tests are about.
 */
describe('the cast in the side menu', () => {
  const withCast = () => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = addCharacter(file, { name: 'MARA' });
    file = addCharacter(file, { name: 'DEAKINS' });
    return file;
  };

  it('lists the cast, so the Creator is one click rather than a hunt', () => {
    render(<Harness initial={withCast()} />);
    const side = within(screen.getByLabelText('Research folders'));

    fireEvent.click(side.getByRole('button', { name: /^MARA/ }));
    expect(screen.getByRole('navigation', { name: 'Character' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Character name: MARA' })).toBeDefined();
  });

  it('stays with that character: leaving and coming back is the same person, on the same tab', () => {
    render(<Harness initial={withCast()} />);
    const side = within(screen.getByLabelText('Research folders'));

    fireEvent.click(side.getByRole('button', { name: /^MARA/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Arc' }));
    expect(screen.getByRole('button', { name: 'Arc' }).getAttribute('aria-current')).toBe('page');

    // Off to look at something else, which is the move that used to lose her.
    fireEvent.click(side.getByRole('button', { name: /^Plots/ }));
    expect(screen.queryByRole('navigation', { name: 'Character' })).toBeNull();

    fireEvent.click(side.getByRole('button', { name: /^MARA/ }));
    expect(screen.getByRole('button', { name: 'Character name: MARA' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Arc' }).getAttribute('aria-current')).toBe('page');
  });

  it('gives each of them their own place, rather than one Creator that follows the last click', () => {
    render(<Harness initial={withCast()} />);
    const side = within(screen.getByLabelText('Research folders'));

    fireEvent.click(side.getByRole('button', { name: /^MARA/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Relationships' }));
    fireEvent.click(side.getByRole('button', { name: /^DEAKINS/ }));

    // Deakins opens where he was left, which is the beginning — not on her tab.
    expect(screen.getByRole('button', { name: 'Character name: DEAKINS' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe('page');

    fireEvent.click(side.getByRole('button', { name: /^MARA/ }));
    expect(screen.getByRole('button', { name: 'Relationships' }).getAttribute('aria-current')).toBe('page');
  });

  /**
   * From Ken: *I need a delete for characters and locations too*. The menu is
   * where a writer meets the cast, so it is where somebody added by accident
   * is got rid of — and it asks first, in the graveyard's own words.
   */
  it('deletes somebody from their row in the menu, after asking, and they wait in the graveyard', () => {
    let seen: ProjectFile | null = null;
    function Watched() {
      const [file, setFile] = useState(withCast());
      seen = file;
      return (
        <ResearchWindow
          file={file}
          open
          currentBeatId={null}
          onClose={() => undefined}
          onUpdate={(mutate) => setFile((current) => mutate(current))}
        />
      );
    }
    render(<Watched />);
    const side = within(screen.getByLabelText('Research folders'));

    fireEvent.click(side.getByRole('button', { name: 'Delete MARA' }));
    expect(screen.getByText(/goes to the graveyard/)).toBeTruthy();

    // Nothing has gone while the question is on the screen.
    expect(castByCategory(seen as unknown as ProjectFile).flatMap((group) => group.characters)).toHaveLength(2);

    fireEvent.click(side.getByRole('button', { name: 'Delete' }));
    const after = seen as unknown as ProjectFile;
    expect(castByCategory(after).flatMap((group) => group.characters).map((one) => one.name)).toEqual(['DEAKINS']);
    expect(graveyard(after).map((row) => row.name)).toEqual(['MARA']);
    // Off the menu, and waiting where it can be put back.
    expect(side.queryByRole('button', { name: /^MARA/ })).toBeNull();
  });

  it('opens somebody from a right-click on their row in the cast', () => {
    render(<Harness initial={withCast()} />);
    const side = within(screen.getByLabelText('Research folders'));
    fireEvent.click(side.getByRole('button', { name: /^Characters/ }));

    const row = screen.getByLabelText('Heading for MARA').closest('li')!;
    fireEvent.contextMenu(row);
    expect(screen.getByRole('navigation', { name: 'Character' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Character name: MARA' })).toBeDefined();
  });
});
