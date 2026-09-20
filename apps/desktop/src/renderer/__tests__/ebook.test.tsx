// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  addMarker,
  createProjectFile,
  ebookOf,
  epubBytes,
  setBookSettings,
  updateBeat,
  type ProjectFile,
} from '@vcwriter/domain';
import { unzip } from '../unzip';
import { EbookExportDialog } from '../components/EbookExportDialog';

/**
 * The eBook on the desktop (addendum 23): the package read back through the
 * zip reader, every file of it parsed as XML, and the dialog that fronts it.
 */

afterEach(cleanup);

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lighthouse', format: 'novel', author: 'K. Shank' });
  const unit = file.units[0]!;
  file = addMarker(file, { unitId: unit.id, kind: 'chapter', title: 'The Road' }).file;
  const beat = file.beats[0]!;
  file = updateBeat(file, beat.id, {
    manuscript: {
      elements: [
        { id: 'e1' as never, type: 'paragraph', text: 'The kettle *would not* boil.', characterId: null, attributes: {} },
        { id: 'e2' as never, type: 'scene_break', text: '', characterId: null, attributes: {} },
        { id: 'e3' as never, type: 'paragraph', text: 'Rain & "wind" <after>.', characterId: null, attributes: {} },
      ],
    },
  });
  return file;
};

describe('the package as a file', () => {
  it('reads back through the zip reader with the mimetype first, and every part is well-formed XML', async () => {
    const pkg = ebookOf(novel(), { modified: '2026-09-19T10:00:00Z' });
    const bytes = await epubBytes(pkg);
    const entries = unzip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(entries[0]?.name).toBe('mimetype');
    expect(new TextDecoder().decode(await entries[0]!.read())).toBe('application/epub+zip');
    expect(entries.map((entry) => entry.name)).toEqual(pkg.entries.map((entry) => entry.path));

    const decoder = new TextDecoder();
    for (const entry of entries) {
      if (!/\.(xhtml|opf|ncx|xml)$/.test(entry.name)) continue;
      const text = decoder.decode(await entry.read());
      const parsed = new DOMParser().parseFromString(text, 'application/xml');
      const failure = parsed.getElementsByTagName('parsererror')[0];
      expect(failure ? `${entry.name}: ${failure.textContent}` : entry.name).toBe(entry.name);
    }
    // The words came through, escaped and unescaped again.
    const chapter = entries.find((entry) => entry.name.endsWith('-chapter.xhtml'))!;
    const parsed = new DOMParser().parseFromString(decoder.decode(await chapter.read()), 'application/xml');
    expect(parsed.getElementsByTagName('p')[2]?.textContent).toBe('Rain & "wind" <after>.');
    expect(parsed.getElementsByTagName('em')[0]?.textContent).toBe('would not');
  });
});

describe('the export dialog', () => {
  it('shows the preflight, holds the button on an error, and writes the files when clear', async () => {
    let file = novel();
    const saved: { folderName: string; files: { name: string }[] }[] = [];
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      saveExport: async (input: { folderName: string; files: { name: string }[] }) => {
        saved.push(input);
        return { ok: true, data: { folder: '/books/The Lighthouse - eBook Export', paths: input.files.map((one) => one.name) } };
      },
    };
    const onUpdate = (mutate: (current: ProjectFile) => ProjectFile) => {
      file = mutate(file);
      rerender(<EbookExportDialog open file={file} onClose={() => {}} onUpdate={onUpdate} />);
    };
    const { rerender } = render(<EbookExportDialog open file={file} onClose={() => {}} onUpdate={onUpdate} />);

    // Universal: a warning about the cover, nothing blocking.
    expect(screen.getByText(/0 errors, 1 warning/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Write the eBook' }) as HTMLButtonElement).disabled).toBe(false);

    // Apple wants the cover inside the book: an error, and the button holds.
    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'apple' } });
    expect(screen.getByText('Apple Books needs the cover inside the book, and no cover is chosen.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Write the eBook' }) as HTMLButtonElement).disabled).toBe(true);
    expect(setBookSettings(file, {}).settings.book).toMatchObject({ ebook: { target: 'apple' } });

    // A field is saved as it is typed.
    fireEvent.change(screen.getByLabelText('eBook ISBN'), { target: { value: '978-1-4028-9462-6' } });
    expect((setBookSettings(file, {}).settings.book as { ebook: { isbn: string } }).ebook.isbn).toBe('978-1-4028-9462-6');

    // Back to universal and write.
    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'universal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Write the eBook' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.folderName).toBe('The Lighthouse - eBook Export');
    expect(saved[0]?.files.map((one) => one.name)).toEqual(['the-lighthouse.epub', 'export-report.html', 'metadata.json']);
    // The packaged bytes were read back and passed.
    await screen.findByText(/Checked after packaging/);
    await screen.findByText(/Written to \/books/);
    expect(screen.getByText(/Upload the EPUB to each store/)).toBeTruthy();
  });

  it('takes a description for a picture, marks a figure decorative, and offers the fixed layout only once the book is laid', () => {
    let file = novel();
    const asset = {
      id: '22222222-2222-4222-8222-222222222222',
      projectId: file.project.id,
      kind: 'image' as const,
      name: 'harbour.png',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      width: 1200,
      height: 800,
      seconds: 0,
      caption: '',
      altText: '',
      createdAt: file.savedAt,
      updatedAt: file.savedAt,
    };
    file = { ...file, assets: [asset as never] };
    const beat = file.beats[0]!;
    file = updateBeat(file, beat.id, {
      manuscript: { elements: [...beat.manuscript.elements, { id: 'fig' as never, type: 'figure', text: 'The harbour', characterId: null, attributes: { assetId: asset.id } }] },
    });
    (window as unknown as { vcwriter: unknown }).vcwriter = {};
    const onUpdate = (mutate: (current: ProjectFile) => ProjectFile) => {
      file = mutate(file);
      rerender(<EbookExportDialog open file={file} onClose={() => {}} onUpdate={onUpdate} />);
    };
    const { rerender } = render(<EbookExportDialog open file={file} onClose={() => {}} onUpdate={onUpdate} />);

    // Owed a description: said above the list and as a warning.
    expect(screen.getByText(/1 picture needs a description/)).toBeTruthy();
    expect(screen.getByText('"harbour.png" has no description for a reader who cannot see it.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Description of harbour.png'), { target: { value: 'Boats at the harbour wall' } });
    expect(file.assets[0]?.altText).toBe('Boats at the harbour wall');
    expect(screen.getByText(/Every picture is described/)).toBeTruthy();
    expect(screen.queryByText(/has no description/)).toBeNull();

    // Decorative instead: the description is not asked for, and the attribute is on the figure.
    fireEvent.change(screen.getByLabelText('Description of harbour.png'), { target: { value: '' } });
    expect(screen.getByText(/1 picture needs a description/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/^Decorative: The harbour/));
    expect(file.beats[0]?.manuscript.elements.find((element) => element.id === ('fig' as never))?.attributes).toMatchObject({ decorative: true });
    expect(screen.getByText(/Every picture is described/)).toBeTruthy();

    // Fixed layout waits for the room to lay the pages.
    expect((screen.getByLabelText('Fixed layout') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Reflowable') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Available once the room has laid the pages/)).toBeTruthy();

    // The preview tab shows the package's own file in a frame the size of a device.
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    const frame = screen.getByTitle('Kindle 6.8″ preview') as HTMLIFrameElement;
    expect(frame.getAttribute('srcdoc')).toContain('column-width: 412px');
    // It opens on the first section, the half title; the chapter is a turn away.
    expect(frame.getAttribute('srcdoc')).toContain('<h1 class="book-title">The Lighthouse</h1>');
    const sections = screen.getByLabelText('Preview section') as HTMLSelectElement;
    fireEvent.change(sections, { target: { value: String([...sections.options].findIndex((option) => option.text === 'The Road')) } });
    expect((screen.getByTitle('Kindle 6.8″ preview') as HTMLIFrameElement).getAttribute('srcdoc')).toContain('The kettle');
    fireEvent.change(screen.getByLabelText('Preview device'), { target: { value: 'phone' } });
    expect((screen.getByTitle('Phone 6.1″ preview') as HTMLIFrameElement).getAttribute('width')).toBe('390');
  });
});
