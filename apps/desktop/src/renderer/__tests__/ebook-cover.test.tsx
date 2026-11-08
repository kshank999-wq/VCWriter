// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addMarker, createProjectFile, ebookOf, setBookSettings, bookSettingsOf, type ProjectFile } from '@vcwriter/domain';
import { EbookExportDialog } from '../components/EbookExportDialog';

/**
 * A cover from the computer (addendum 23 §14, from Ken: *we need to be able
 * to add a cover picture, and it needs to resize it properly so it fills the
 * screen*).
 */
vi.mock('../read-picture', () => ({
  PICTURE_ACCEPT: 'image/*',
  pictureRefusal: () => null,
  readPicture: async () => ({ data: 'data:image/png;base64,iVBORw0KGgo=', width: 1600, height: 2560 }),
}));

afterEach(cleanup);

describe('the eBook cover', () => {
  it('takes a picture from the computer into the library and makes it the cover', async () => {
    let file: ProjectFile = createProjectFile({ title: 'The Lighthouse', format: 'novel', author: 'K. Shank' });
    file = addMarker(file, { unitId: file.units[0]!.id, title: 'One', kind: 'chapter' }).file;
    (window as unknown as { vcwriter: unknown }).vcwriter = {};
    const onUpdate = (mutate: (current: ProjectFile) => ProjectFile) => {
      file = mutate(file);
      rerender(<EbookExportDialog open file={file} onClose={() => {}} onUpdate={onUpdate} />);
    };
    const { rerender } = render(<EbookExportDialog open file={file} onClose={() => {}} onUpdate={onUpdate} />);
    const picture = new File(['x'], 'cover.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose a cover picture'), { target: { files: [picture] } });
    await waitFor(() => expect(bookSettingsOf(file).ebook.coverAssetId).toBeTruthy());
    expect(file.assets.find((asset) => asset.id === bookSettingsOf(file).ebook.coverAssetId)?.name).toBe('cover.png');
    expect(screen.getByText(/This one is 1600 × 2560\./)).toBeTruthy();
  });

  it('centres the cover on its screen, whole, like any page of art', () => {
    let file: ProjectFile = createProjectFile({ title: 'The Lighthouse', format: 'novel', author: 'K. Shank' });
    file = { ...file, assets: [{ id: '55555555-5555-4555-8555-555555555555', projectId: file.project.id, kind: 'image', name: 'c.png', data: 'data:image/png;base64,iVBORw0KGgo=', width: 1600, height: 2560, altText: '', createdAt: file.savedAt, updatedAt: file.savedAt } as never] };
    file = setBookSettings(file, { ebook: { ...bookSettingsOf(file).ebook, coverAssetId: '55555555-5555-4555-8555-555555555555' } as never });
    const pkg = ebookOf(file);
    const cover = pkg.entries.find((entry) => entry.path === 'OEBPS/text/000-cover.xhtml');
    expect(String(cover?.data)).toContain('<body class="art">');
    expect(String(cover?.data)).toContain('<div class="art-page"><img class="cover"');
  });
});
