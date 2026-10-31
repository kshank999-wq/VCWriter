import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createProjectFile } from '@vcwriter/domain';

/**
 * Save dialogs open beside the project (from Ken: *each project, when it
 * saves, I want it to be associated with that location… so you don't
 * accidentally save it in another file that you open*).
 */
const handlers = new Map<string, (...args: unknown[]) => unknown>();
const saveDialog = vi.fn(async (..._args: unknown[]) => ({ canceled: true, filePath: undefined }));
let documents = '';

vi.mock('electron', () => ({
  app: { getPath: () => documents, getVersion: () => '0.0.0', isPackaged: false, addRecentDocument: () => undefined },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: { showSaveDialog: (...args: unknown[]) => saveDialog(...args), showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
  shell: { openExternal: async () => undefined, trashItem: async () => undefined },
  Menu: { buildFromTemplate: () => ({ popup: () => undefined }), setApplicationMenu: () => undefined },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: { isEncryptionAvailable: () => false },
  net: {},
  session: { defaultSession: {} },
}));

const optionsOf = (call: unknown[]): { defaultPath?: string } => (call.length > 1 ? call[1] : call[0]) as { defaultPath?: string };

describe('save dialogs open beside the project in hand', () => {
  beforeAll(async () => {
    documents = await mkdtemp(join(tmpdir(), 'vcw-docs-'));
    const { registerIpcHandlers } = await import('../ipc');
    registerIpcHandlers(() => null);
  });

  it('opens Save As and exports in the folder of the project each window has open', async () => {
    const create = handlers.get('project:create')!;
    const one = (await create({ sender: { id: 1 } }, { title: 'Spirits', format: 'screenplay' })) as { ok: true; data: { path: string } };
    expect(one.ok).toBe(true);

    // A second window has a project somewhere else entirely.
    const elsewhere = join(documents, 'Elsewhere', 'Deep');
    await mkdir(elsewhere, { recursive: true });
    const save = handlers.get('project:save')!;
    const other = join(elsewhere, 'Other.vcw');
    await save({ sender: { id: 2 } }, { path: other, file: createProjectFile({ title: 'Other', format: 'novel' }) });

    const saveAs = handlers.get('project:saveAs')!;
    await saveAs({ sender: { id: 1 } }, { kind: 'as', file: createProjectFile({ title: 'Spirits', format: 'screenplay' }) });
    expect(dirname(optionsOf(saveDialog.mock.calls.at(-1)!).defaultPath!)).toBe(dirname(one.data.path));

    await saveAs({ sender: { id: 2 } }, { kind: 'copy', file: createProjectFile({ title: 'Other', format: 'novel' }) });
    expect(dirname(optionsOf(saveDialog.mock.calls.at(-1)!).defaultPath!)).toBe(elsewhere);

    const saveFile = handlers.get('project:saveFile')!;
    await saveFile({ sender: { id: 2 } }, { name: 'Other.docx', bytes: new Uint8Array(), mediaType: 'x', kind: { name: 'Word document', extension: 'docx' } });
    expect(optionsOf(saveDialog.mock.calls.at(-1)!).defaultPath).toBe(join(elsewhere, 'Other.docx'));
  });
});
