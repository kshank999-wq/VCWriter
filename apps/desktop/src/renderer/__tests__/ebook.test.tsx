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
    expect(saved[0]?.files.map((one) => one.name)).toEqual(['the-lighthouse.epub', 'the-lighthouse-export-report.txt', 'metadata.json']);
    await screen.findByText(/Written to \/books/);
    expect(screen.getByText(/Upload the EPUB to each store/)).toBeTruthy();
  });
});
