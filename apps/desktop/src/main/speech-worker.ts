import { createSpeechEngine, type SpeechEngine } from './speech-engine';

/**
 * The utility process dictation is heard in (addendum 05 §dictation). The
 * main process forks it with the model folder as its argument and sends one
 * stretch of speech per message — 16 kHz mono samples; it answers with the
 * words, or the error, in the order the stretches arrive. What was said in
 * the stretches before is kept as Whisper's prompt until a request marked
 * `fresh` — the start of another go at dictating.
 */
interface Request {
  id: number;
  samples: Float32Array;
  fresh: boolean;
}

const port = process.parentPort;
const dir = process.argv[2] ?? '';
let engine: Promise<SpeechEngine> | null = null;
let queue: Promise<void> = Promise.resolve();
let previous: number[] = [];

port.on('message', (event: { data: Request }) => {
  const request = event.data;
  queue = queue.then(async () => {
    try {
      engine ??= createSpeechEngine(dir);
      if (request.fresh) previous = [];
      const heard = await (await engine).transcribe(request.samples, previous);
      previous = [...previous, ...heard.tokens].slice(-200);
      port.postMessage({ id: request.id, text: heard.text });
    } catch (error) {
      engine = null;
      port.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) });
    }
  });
});
