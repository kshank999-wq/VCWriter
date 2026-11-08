import { createNaturalEngine, type NaturalEngine } from './natural-voices-engine';

/**
 * The utility process the natural voices run in (addendum 45). The main
 * process forks it with the install folder as its argument and sends one
 * message per line to speak; it answers with the samples, or the error.
 * Requests are answered in the order they arrive.
 */
interface Request {
  id: number;
  text: string;
  voice: string;
  speed: number;
}

const port = process.parentPort;
const dir = process.argv[2] ?? '';
let engine: Promise<NaturalEngine> | null = null;
let queue: Promise<void> = Promise.resolve();

port.on('message', (event: { data: Request }) => {
  const request = event.data;
  queue = queue.then(async () => {
    try {
      engine ??= createNaturalEngine(dir);
      const samples = await (await engine).synthesize(request.text, request.voice, request.speed);
      port.postMessage({ id: request.id, samples });
    } catch (error) {
      engine = null;
      port.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) });
    }
  });
});
