// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { captureItemSchema, createProjectFile, type CaptureItem, type ProjectFile } from '@vcwriter/domain';
import { NoteArchive, PhoneGroups } from '../components/PhoneTransfer';

/**
 * The phone's notes by hand, and the archive (addendum 27 §25, from Ken: *you
 * can select the project and it will sync and transfer those. Once they're
 * transferred, those notes need to go into an archive… And you can also
 * delete it from the actual desktop app*).
 */

const PHONE = '11111111-1111-4111-8111-111111111111';
const note = (rawText: string, overrides: Partial<CaptureItem> = {}): CaptureItem =>
  captureItemSchema.parse({
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    projectId: PHONE,
    source: 'mobile_voice',
    capturedAt: '2026-10-27T10:00:00.000Z',
    rawText,
    category: 'idea',
    createdAt: '2026-10-27T10:00:00.000Z',
    updatedAt: '2026-10-27T10:00:00.000Z',
    ...overrides,
  });

afterEach(() => {
  cleanup();
  delete (window as unknown as { vcwriter?: unknown }).vcwriter;
});

describe('On the phone', () => {
  it('lists the phone’s groups by project and transfers one into the open project', async () => {
    const waiting = [note('A blackout across the city.'), note('The bridge is out.')];
    const resolved: CaptureItem[] = [];
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      listPhoneNotes: vi.fn(async () => ({ ok: true, data: { notes: waiting, projects: [{ id: PHONE, title: 'Blackout (phone)' }] } })),
      resolveCapture: vi.fn(async (capture: CaptureItem) => {
        resolved.push(capture);
        return { ok: true, data: true };
      }),
    };
    let file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    const before = file.researchItems.length;
    render(<PhoneGroups file={file} onUpdate={(mutate) => (file = mutate(file) as ProjectFile)} />);

    expect(await screen.findByText('Blackout (phone)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Transfer to this project' }));
    await waitFor(() => expect(resolved).toHaveLength(2));
    expect(resolved.every((one) => one.status === 'approved')).toBe(true);
    expect(file.researchItems.length - before).toBe(2);
    expect(await screen.findByText(/2 notes from “Blackout \(phone\)” filed in this project/)).toBeTruthy();
  });
});

describe('the archive', () => {
  it('folders the archive by day and project, opens a folder, and deletes a note or the folder after asking', async () => {
    const filed = note('Filed already.', { status: 'approved', reviewedAt: '2026-10-27T11:00:00.000Z', filedInto: 'Blackout' });
    const also = note('Filed too.', { status: 'approved', reviewedAt: '2026-10-27T12:00:00.000Z', filedInto: 'Blackout' });
    const deleteCaptures = vi.fn(async (ids: string[]) => ({ ok: true, data: ids.length }));
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      listArchivedNotes: vi.fn(async () => ({ ok: true, data: [filed, also] })),
      deleteCaptures,
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<NoteArchive file={createProjectFile({ title: 'Blackout', format: 'screenplay' })} />);

    const folder = await screen.findByRole('button', { expanded: false });
    expect(folder.textContent).toMatch(/— Blackout/);
    expect(screen.queryByText('Filed already.')).toBeNull();
    fireEvent.click(folder);
    expect(screen.getByText('Filed already.')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete this archived note' })[0]!);
    await waitFor(() => expect(deleteCaptures).toHaveBeenCalledWith([filed.id]));
    fireEvent.click(screen.getByRole('button', { name: /^Delete the folder/ }));
    await waitFor(() => expect(deleteCaptures).toHaveBeenLastCalledWith([also.id]));
    await waitFor(() => expect(screen.getByText('The archive is empty.')).toBeTruthy());
  });
});
