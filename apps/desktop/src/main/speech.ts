import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { app, ipcMain, net, systemPreferences, utilityProcess, type UtilityProcess, type WebContents } from 'electron';
import { SPEECH_MODEL, speechModelFiles } from '@vcwriter/domain';

/**
 * Dictation heard on this computer (addendum 05, from Ken: *select a box…
 * click dictate, and it will type what you're saying*).
 *
 * The desktop app has no speech service behind the browser's own speech
 * recognition, and the Mac's system dictation sits behind the Fn key, which
 * opens the emoji picker on many keyboards — so the app listens for itself.
 * A small Whisper model (about 80 MB) is fetched once, on request, into the
 * app's own data folder, exactly as the natural voices are; a manifest is
 * written last so a cut-off download is fetched again. Sound never leaves
 * the computer.
 */

export interface SpeechStatus {
  installed: boolean;
  installing: boolean;
}

const folder = (): string => join(app.getPath('userData'), 'speech', SPEECH_MODEL.id);
const manifest = (): string => join(folder(), 'manifest.json');

let installing: Promise<void> | null = null;
let worker: UtilityProcess | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve(text: string): void; reject(error: Error): void }>();

export const speechStatus = (): SpeechStatus => ({ installed: existsSync(manifest()), installing: installing !== null });

/** Weighted by size: the decoder is two thirds, the encoder a third, the tokenizer next to nothing. */
const SHARES: Record<string, number> = {
  [SPEECH_MODEL.encoderFile]: 0.3,
  [SPEECH_MODEL.decoderFile]: 0.67,
  [SPEECH_MODEL.tokenizerFile]: 0.03,
};

const install = async (report: (progress: { fraction: number; file: string }) => void): Promise<void> => {
  let done = 0;
  const files = speechModelFiles();
  for (const file of files) {
    const share = SHARES[file] ?? 0;
    const target = join(folder(), file);
    await mkdir(dirname(target), { recursive: true });
    const response = await net.fetch(`${SPEECH_MODEL.repository}/${file}`);
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
  await writeFile(manifest(), JSON.stringify({ model: SPEECH_MODEL.id, files, installedAt: new Date().toISOString() }));
};

const stopWorker = (): void => {
  worker?.kill();
  worker = null;
  for (const pending of waiting.values()) pending.reject(new Error('Dictation was stopped'));
  waiting.clear();
};

const ensureWorker = (): UtilityProcess => {
  if (worker) return worker;
  const child = utilityProcess.fork(join(__dirname, 'speech-worker.js'), [folder()], { serviceName: 'VC Writer dictation' });
  child.on('message', (message: { id: number; text?: string; error?: string }) => {
    const pending = waiting.get(message.id);
    if (!pending) return;
    waiting.delete(message.id);
    if (typeof message.text === 'string') pending.resolve(message.text);
    else pending.reject(new Error(message.error ?? 'The speech could not be heard'));
  });
  child.on('exit', () => {
    if (worker === child) stopWorker();
  });
  worker = child;
  return child;
};

const transcribe = (samples: Float32Array, fresh: boolean): Promise<string> => {
  if (!speechStatus().installed) return Promise.reject(new Error('Dictation is not installed'));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    ensureWorker().postMessage({ id, samples, fresh });
  });
};

const result = async <T>(work: () => Promise<T> | T): Promise<{ ok: boolean; data?: T; error?: string }> => {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export const registerSpeechHandlers = (): void => {
  ipcMain.handle('speech:status', () => result(() => speechStatus()));

  ipcMain.handle('speech:install', (event) =>
    result(async () => {
      const sender: WebContents = event.sender;
      if (!speechStatus().installed) {
        installing ??= install((progress) => {
          if (!sender.isDestroyed()) sender.send('speech:progress', progress);
        }).finally(() => {
          installing = null;
        });
        await installing;
      }
      return speechStatus();
    }),
  );

  ipcMain.handle('speech:remove', () =>
    result(async () => {
      stopWorker();
      await rm(join(app.getPath('userData'), 'speech'), { recursive: true, force: true });
      return speechStatus();
    }),
  );

  /** On a Mac, the system asks once whether VC Writer may use the microphone. */
  ipcMain.handle('speech:microphone', () =>
    result(async () => (process.platform === 'darwin' ? systemPreferences.askForMediaAccess('microphone') : true)),
  );

  ipcMain.handle('speech:transcribe', (_event, samples: Float32Array, fresh?: boolean) =>
    result(async () => {
      const sound = samples instanceof Float32Array ? samples : Float32Array.from(samples as ArrayLike<number>);
      // Whisper hears thirty seconds at a time; the renderer cuts at pauses
      // well before that, so anything longer is trimmed rather than refused.
      return transcribe(sound.subarray(0, SPEECH_MODEL.sampleRate * 30), fresh === true);
    }),
  );

  app.on('will-quit', stopWorker);
};
