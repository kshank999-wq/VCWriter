// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { castByCategory, episodes, type ProjectFile } from '@vcwriter/domain';
import { ImportDialog } from '../components/ImportDialog';
import { MENUS } from '../menus';
import { buildDocx, wordParagraph } from './zip-fixture';

/**
 * The import dialog (addendum 02 §18): what it shows before it makes
 * anything, and what it makes when told to.
 */

afterEach(cleanup);

const FDX = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="5">
<Content>
<Paragraph Type="Scene Heading"><Text>INT. LIGHTHOUSE - STAIRS - NIGHT</Text></Paragraph>
<Paragraph Type="Action"><Text>She climbs.</Text></Paragraph>
${Array.from(
  { length: 6 },
  () =>
    '<Paragraph Type="Character"><Text>MAEVE</Text></Paragraph><Paragraph Type="Dialogue"><Text>Again.</Text></Paragraph>',
).join('\n')}
<Paragraph Type="Scene Heading"><Text>EXT. LIGHTHOUSE - DAWN</Text></Paragraph>
<Paragraph Type="Character"><Text>THE KEEPER</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>It did. Twice.</Text></Paragraph>
</Content>
<TitlePage><Content>
<Paragraph><Text>THE LIGHTHOUSE</Text></Paragraph>
<Paragraph><Text>by K. Shank</Text></Paragraph>
</Content></TitlePage>
</FinalDraft>`;

/** jsdom's File has no `text()` or `arrayBuffer()`, so give the picker one that has. */
const fileNamed = (name: string, body: string | ArrayBuffer): File => {
  const made = new File([body], name);
  Object.defineProperty(made, 'text', { value: () => Promise.resolve(typeof body === 'string' ? body : '') });
  Object.defineProperty(made, 'arrayBuffer', {
    value: () => Promise.resolve(typeof body === 'string' ? new TextEncoder().encode(body).buffer : body),
  });
  return made;
};

const chooseMany = (files: File[]) => {
  const picker = screen.getByLabelText('Script file') as HTMLInputElement;
  Object.defineProperty(picker, 'files', { value: files, configurable: true });
  fireEvent.change(picker);
};

const choose = (name: string, body: string | ArrayBuffer) => chooseMany([fileNamed(name, body)]);

/** A second script, for a series brought in a file at a time. */
const WRECK = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="5">
<Content>
<Paragraph Type="Scene Heading"><Text>EXT. HARBOUR - DAY</Text></Paragraph>
<Paragraph Type="Character"><Text>DR HALE</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>She was here before us.</Text></Paragraph>
</Content>
<TitlePage><Content><Paragraph><Text>THE WRECK</Text></Paragraph></Content></TitlePage>
</FinalDraft>`;

/** A novel typed in Word: a title, chapter headings, a paragraph set in its own face. */
const NOVEL = () =>
  buildDocx([
    wordParagraph('The Lighthouse', { style: 'Title' }),
    wordParagraph('by K. Shank', { align: 'center' }),
    wordParagraph('Chapter One: The Road', { style: 'Heading1' }),
    wordParagraph('The kettle would not boil.'),
    wordParagraph('Or on the road.', { face: 'Garamond', size: 14 }),
    wordParagraph('Chapter Two', { style: 'Heading1' }),
    wordParagraph('The road went north.'),
  ]);

/** A screenplay typed in Word: sluglines at the margin, cues centred, speeches an inch in. */
const SCREENPLAY = () =>
  buildDocx([
    wordParagraph('INT. LIGHTHOUSE - STAIRS - NIGHT'),
    wordParagraph('She climbs.'),
    ...Array.from({ length: 6 }, () => [wordParagraph('MAEVE', { align: 'center' }), wordParagraph('Again.', { indent: 1 })]).flat(),
    wordParagraph('EXT. LIGHTHOUSE - DAWN'),
    wordParagraph('THE KEEPER', { align: 'center' }),
    wordParagraph('It did. Twice.', { indent: 1 }),
  ]);

describe('importing a script', () => {
  it('shows what it found before it makes anything of it', async () => {
    render(<ImportDialog open onClose={() => {}} onImported={() => {}} />);
    // Nothing to import until a file is chosen.
    expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(true);

    choose('lighthouse.fdx', FDX);
    await screen.findByText('Who is in it');

    expect(screen.getByText('THE LIGHTHOUSE — K. Shank')).toBeTruthy();
    expect(screen.getByText('MAEVE')).toBeTruthy();
    expect(screen.getByText('THE KEEPER')).toBeTruthy();
    expect(screen.getByText('LIGHTHOUSE - STAIRS')).toBeTruthy();
    const figures = [...document.querySelectorAll('.report-figure')].map((node) => node.textContent);
    expect(figures[0]).toContain('2');
    expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('makes a project broken into scenes with the cast filed', async () => {
    const made: ProjectFile[] = [];
    render(<ImportDialog open onClose={() => {}} onImported={(file) => made.push(file)} />);
    choose('lighthouse.fdx', FDX);
    await screen.findByText('Who is in it');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(made).toHaveLength(1));

    const file = made[0]!;
    expect(file.project.title).toBe('THE LIGHTHOUSE');
    expect(file.project.author).toBe('K. Shank');
    expect(file.units.map((unit) => unit.title)).toEqual([
      'INT. LIGHTHOUSE - STAIRS - NIGHT',
      'EXT. LIGHTHOUSE - DAWN',
    ]);
    expect(file.beats).toHaveLength(2);

    const groups = castByCategory(file);
    expect(groups.find((group) => group.name === 'Main characters')?.characters.map((p) => p.name)).toEqual(['MAEVE']);
    expect(groups.find((group) => group.name === 'Minor characters')?.characters.map((p) => p.name)).toEqual([
      'THE KEEPER',
    ]);
    expect(file.researchItems.map((item) => item.title)).toContain('LIGHTHOUSE - STAIRS');
  });

  it('says so plainly when the file is none of the kinds it reads', async () => {
    render(<ImportDialog open onClose={() => {}} onImported={() => {}} />);
    choose('notes.txt', 'just some notes');
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toMatch(/not a Final Draft document, a Word document or a PDF/);
  });

  /**
   * A Word document (addendum 21): read by its headings for a book, by its
   * indents for a script, and the choice between them is the format.
   */
  it('reads a Word document as a novel, chapter by heading, with the face and size kept', async () => {
    const made: ProjectFile[] = [];
    render(<ImportDialog open onClose={() => {}} onImported={(file) => made.push(file)} />);
    choose('lighthouse.docx', NOVEL());
    await screen.findByLabelText('Format');

    // A book is offered only for a Word document, and choosing it reads the
    // document again, by its headings this time.
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'novel' } });
    await screen.findByText('The Lighthouse — K. Shank');
    const figures = [...document.querySelectorAll('.report-figure')].map((node) => node.textContent);
    expect(figures[0]).toBe('2Chapters');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(made).toHaveLength(1));
    const file = made[0]!;
    expect(file.project.format).toBe('novel');
    expect(file.units.map((unit) => unit.title)).toEqual(['Chapter One: The Road', 'Chapter Two']);
    expect(file.markers.map((marker) => marker.title)).toEqual(['The Road', '']);
    // A beat per paragraph (addendum 21 §10): the chapter's two paragraphs are two beats.
    const chapter = file.beats.filter((beat) => beat.unitId === file.units[0]!.id);
    expect(chapter.map((beat) => beat.manuscript.elements.map((element) => element.type))).toEqual([['paragraph'], ['paragraph']]);
    expect(chapter[1]?.manuscript.elements[0]?.attributes).toEqual({ face: 'Garamond', size: 14 });
  });

  it('reads a Word screenplay by where its paragraphs sit', async () => {
    const made: ProjectFile[] = [];
    render(<ImportDialog open onClose={() => {}} onImported={(file) => made.push(file)} />);
    choose('lighthouse.docx', SCREENPLAY());
    await screen.findByText('Who is in it');
    expect(screen.getByText('MAEVE')).toBeTruthy();
    expect(screen.getByText('THE KEEPER')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(made).toHaveLength(1));
    expect(made[0]!.units.map((unit) => unit.title)).toEqual(['INT. LIGHTHOUSE - STAIRS - NIGHT', 'EXT. LIGHTHOUSE - DAWN']);
    expect(made[0]!.beats[0]!.manuscript.elements.map((element) => element.type).slice(0, 4)).toEqual([
      'scene_heading',
      'action',
      'character',
      'dialogue',
    ]);
  });

  it('says so when a Word document is not one', async () => {
    render(<ImportDialog open onClose={() => {}} onImported={() => {}} />);
    choose('broken.docx', '<html><body>not a document</body></html>');
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toMatch(/not a Word document/);
  });

  it('says so when the file claims to be Final Draft and is not', async () => {
    render(<ImportDialog open onClose={() => {}} onImported={() => {}} />);
    choose('broken.fdx', '<html><body>not a script</body></html>');
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toMatch(/not a Final Draft document/);
  });

  /**
   * Several files at once (addendum 22 §4a): on a series the first makes
   * the project and each after it is the next episode, in the order listed.
   */
  it('brings a series in a file at a time, each episode on a page of its own, in the order listed', async () => {
    const made: ProjectFile[] = [];
    render(<ImportDialog open onClose={() => {}} onImported={(file) => made.push(file)} />);
    chooseMany([fileNamed('lighthouse.fdx', FDX), fileNamed('wreck.fdx', WRECK), fileNamed('notes.txt', 'x')]);
    await screen.findByText('Who is in it');
    // A screenplay is one document: the rest are said to be left out.
    expect(screen.getByRole('note').textContent).toMatch(/One more file was chosen and will be left out/);
    expect(screen.getByText(/notes.txt: That is not a Final Draft document/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'series' } });
    const order = await screen.findByLabelText('Files in order');
    expect([...order.querySelectorAll('.import-order-title')].map((node) => node.textContent)).toEqual(['1. THE LIGHTHOUSE', '2. THE WRECK']);
    // The arrows put them in the order wanted; the first is what is shown.
    fireEvent.click(screen.getByRole('button', { name: 'Move THE WRECK up' }));
    expect([...order.querySelectorAll('.import-order-title')].map((node) => node.textContent)).toEqual(['1. THE WRECK', '2. THE LIGHTHOUSE']);
    await waitFor(() => expect(document.querySelector('.import-found .muted.small')?.textContent).toBe('THE WRECK'));
    fireEvent.click(screen.getByRole('button', { name: 'Move THE WRECK down' }));

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(made).toHaveLength(1));
    const file = made[0]!;
    expect(file.project.format).toBe('series');
    expect(file.project.title).toBe('THE LIGHTHOUSE');
    expect(episodes(file).map((episode) => [episode.label, episode.title])).toEqual([
      ['EPISODE 1', 'THE LIGHTHOUSE'],
      ['EPISODE 2', 'THE WRECK'],
    ]);
    expect(episodes(file)[1]?.units.map((unit) => unit.title)).toEqual(['EXT. HARBOUR - DAY']);
    expect(file.characters.map((person) => person.name)).toContain('DR HALE');
  });

  it('leaves a file out when asked, and imports one file as it always did', async () => {
    const made: ProjectFile[] = [];
    render(<ImportDialog open onClose={() => {}} onImported={(file) => made.push(file)} />);
    chooseMany([fileNamed('lighthouse.fdx', FDX), fileNamed('wreck.fdx', WRECK)]);
    await screen.findByText('Who is in it');
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'series' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Leave out THE WRECK' }));
    expect(screen.queryByLabelText('Files in order')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(made).toHaveLength(1));
    expect(episodes(made[0]!).map((episode) => episode.title)).toEqual(['THE LIGHTHOUSE']);
  });

  it('is on the File menu', () => {
    const commands = MENUS.flatMap((menu) => menu.items.filter(Boolean).map((item) => item!.command));
    expect(commands).toContain('file.import');
  });
});
