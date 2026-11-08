import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { app, ipcMain, net, utilityProcess, type UtilityProcess, type WebContents } from 'electron';
import { NATURAL_MODEL, naturalModelFiles } from '@vcwriter/domain';

/**
 * Natural voices in the main process (addendum 45): fetching the model on
 * request, removing it, and speaking a line through the utility process.
 *
 * Nothing is fetched until the writer asks. The files go to the app's own
 * data folder, one folder per model version, and the folder only counts as
 * installed once every file has arrived — a manifest is written last — so a
 * download cut off half way is fetched again rather than half-used.
 */

export interface NaturalVoicesStatus {
  installed: boolean;
  installing: boolean;
}

export interface NaturalVoicesProgress {
  /** 0–1 across the whole download. */
  fraction: number;
  file: string;
}

const folder = (): string => join(app.getPath('userData'), 'natural-voices', NATURAL_MODEL.id);
const manifest = (): string => join(folder(), 'manifest.json');

let installing: Promise<void> | null = null;
let worker: UtilityProcess | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve(samples: Float32Array): void; reject(error: Error): void }>();

export const naturalVoicesStatus = (): NaturalVoicesStatus => ({
  installed: existsSync(manifest()),
  installing: installing !== null,
});

/**
 * The model's files are about 100 MB, nearly all of it the model itself, so
 * progress is weighted by bytes where the server says how many, and the small
 * style files count for little.
 */
const install = async (report: (progress: NaturalVoicesProgress) => void): Promise<void> => {
  const files = naturalModelFiles();
  const modelShare = 0.9;
  const otherShare = (1 - modelShare) / (files.length - 1);
  let done = 0;
  for (const file of files) {
    const share = file === NATURAL_MODEL.modelFile ? modelShare : otherShare;
    const target = join(folder(), file);
    await mkdir(dirname(target), { recursive: true });
    const response = await net.fetch(`${NATURAL_MODEL.repository}/${file}`);
    if (!response.ok || !response.body) throw new Error(`Could not fetch ${file} (${response.status})`);
    const length = Number(response.headers.get('content-length') ?? 0);
    let received = 0;
    const body = Readable.fromWeb(response.body as never);
    body.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (length > 0) report({ fraction: done + share * Math.min(received / length, 1), file });
    });
    await pipeline(body, createWriteStream(`${target}.part`));
    await rename(`${target}.part`, target);
    done += share;
    report({ fraction: done, file });
  }
  await writeFile(manifest(), JSON.stringify({ model: NATURAL_MODEL.id, files, installedAt: new Date().toISOString() }));
};

const stopWorker = (): void => {
  worker?.kill();
  worker = null;
  for (const pending of waiting.values()) pending.reject(new Error('Natural voices were stopped'));
  waiting.clear();
};

const ensureWorker = (): UtilityProcess => {
  if (worker) return worker;
  const child = utilityProcess.fork(join(__dirname, 'natural-voices-worker.js'), [folder()], {
    serviceName: 'VC Writer natural voices',
  });
  child.on('message', (message: { id: number; samples?: Float32Array; error?: string }) => {
    const pending = waiting.get(message.id);
    if (!pending) return;
    waiting.delete(message.id);
    if (message.samples) pending.resolve(message.samples);
    else pending.reject(new Error(message.error ?? 'The voice could not be generated'));
  });
  child.on('exit', () => {
    if (worker === child) stopWorker();
  });
  worker = child;
  return child;
};

export const speakNatural = (text: string, voice: string, speed: number): Promise<Float32Array> => {
  if (!naturalVoicesStatus().installed) return Promise.reject(new Error('Natural voices are not installed'));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    ensureWorker().postMessage({ id, text, voice, speed: Math.min(Math.max(speed, 0.5), 2) });
  });
};

const result = async <T>(work: () => Promise<T> | T): Promise<{ ok: boolean; data?: T; error?: string }> => {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export const registerNaturalVoiceHandlers = (): void => {
  ipcMain.handle('naturalVoices:status', () => result(() => naturalVoicesStatus()));

  ipcMain.handle('naturalVoices:install', (event) =>
    result(async () => {
      const sender: WebContents = event.sender;
      if (!naturalVoicesStatus().installed) {
        installing ??= install((progress) => {
          if (!sender.isDestroyed()) sender.send('naturalVoices:progress', progress);
        }).finally(() => {
          installing = null;
        });
        await installing;
      }
      return naturalVoicesStatus();
    }),
  );

  ipcMain.handle('naturalVoices:remove', () =>
    result(async () => {
      stopWorker();
      await rm(join(app.getPath('userData'), 'natural-voices'), { recursive: true, force: true });
      return naturalVoicesStatus();
    }),
  );

  ipcMain.handle('naturalVoices:speak', (_event, input: { text: string; voice: string; speed: number }) =>
    result(async () => {
      const samples = await speakNatural(String(input.text), String(input.voice), Number(input.speed) || 1);
      return { samples, sampleRate: NATURAL_MODEL.sampleRate };
    }),
  );

  app.on('will-quit', stopWorker);
};

