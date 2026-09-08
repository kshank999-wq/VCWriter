// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { castByCategory, type ProjectFile } from '@vcwriter/domain';
import { ImportDialog } from '../components/ImportDialog';
import { MENUS } from '../menus';

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

/** jsdom's File has no `text()`, so give the picker one that has. */
const fileNamed = (name: string, body: string): File => {
  const made = new File([body], name);
  Object.defineProperty(made, 'text', { value: () => Promise.resolve(body) });
  return made;
};

const choose = (name: string, body: string) => {
  const picker = screen.getByLabelText('Script file') as HTMLInputElement;
  Object.defineProperty(picker, 'files', { value: [fileNamed(name, body)], configurable: true });
  fireEvent.change(picker);
};

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

  it('says so plainly when the file is neither kind', async () => {
    render(<ImportDialog open onClose={() => {}} onImported={() => {}} />);
    choose('notes.txt', 'just some notes');
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toMatch(/neither a Final Draft document nor a PDF/);
  });

  it('says so when the file claims to be Final Draft and is not', async () => {
    render(<ImportDialog open onClose={() => {}} onImported={() => {}} />);
    choose('broken.fdx', '<html><body>not a script</body></html>');
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toMatch(/not a Final Draft document/);
  });

  it('is on the File menu', () => {
    const commands = MENUS.flatMap((menu) => menu.items.filter(Boolean).map((item) => item!.command));
    expect(commands).toContain('file.import');
  });
});
