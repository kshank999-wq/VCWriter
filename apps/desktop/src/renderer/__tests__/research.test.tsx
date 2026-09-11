// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { addResearchCategory, addResearchItem, createProjectFile, type ProjectFile } from '@vcwriter/domain';
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
        away={['script']}
        onBringBack={() => undefined}
        account={{ configured: false, signedIn: false, email: null }}
        syncing={false}
        onSync={() => undefined}
        saveState="saved"
        onSaveNow={() => undefined}
        onCloseProject={() => undefined}
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
    fireEvent.click(side.getByLabelText('Remove New folder'));
    expect(side.queryByText('New folder')).toBeNull();
    // Mike's note is untouched by any of it.
    expect(screen.getByText('Wears his father’s coat')).toBeDefined();
  });

  it('keeps the plots and the setups in the same menu', () => {
    render(<Harness initial={withNotes()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Plots/ }));
    expect(screen.getByLabelText('Kind of Main Plot')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^Setups & payoffs/ }));
    expect(screen.getByRole('heading', { name: /setups/i })).toBeDefined();
  });
});
