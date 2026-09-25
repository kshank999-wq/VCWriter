/**
 * Getting pdf.js running, in one place (addendum 20 §16a).
 *
 * Two screens read PDFs — the script importer takes the lines off one, and a
 * vendor's barcode is drawn as a picture — and both need the same three
 * things: the library loaded on demand, a worker handed over as a port, and
 * the worker let go afterwards. That was written twice; this is the one copy.
 *
 * **It also carries a polyfill, and that is the point.** pdf.js 6 calls
 * `Map.prototype.getOrInsertComputed`, a proposal method that landed in V8
 * after the Chromium this app ships on — so `getDocument(…).getPage(1)`
 * throws *getOrInsertComputed is not a function* on the writer's machine
 * while the tests pass, because nothing in the suite loads pdf.js. Found by
 * driving the real room: the barcode said *that file could not be read*, and
 * the script importer, which calls the same `getPage`, was failing the same
 * way and had been.
 *
 * The method is small and its behaviour is written down, so the honest fix
 * is to supply it rather than to pin the library back and lose four majors
 * of fixes. It is installed only where it is missing, so a newer runtime
 * uses its own.
 */

/**
 * https://tc39.es/proposal-upsert — get the value, or compute it, insert it
 * and return it. One call, so a Map is read once rather than three times.
 */
const upsert = () => {
  const proto = Map.prototype as unknown as Record<string, unknown>;
  if (typeof proto.getOrInsertComputed !== 'function') {
    proto.getOrInsertComputed = function <K, V>(this: Map<K, V>, key: K, make: (key: K) => V): V {
      if (!this.has(key)) this.set(key, make(key));
      return this.get(key) as V;
    };
  }
  if (typeof proto.getOrInsert !== 'function') {
    proto.getOrInsert = function <K, V>(this: Map<K, V>, key: K, value: V): V {
      if (!this.has(key)) this.set(key, value);
      return this.get(key) as V;
    };
  }
};

type PDFDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;

/**
 * A PDF open and ready to read, with the worker owned by the caller's
 * `done()`. The worker is handed over as a **port** rather than a URL:
 * written this way the bundler emits it beside the app and resolves the path
 * itself, which is what makes it work under the `file://` origin the desktop
 * runs at.
 */
export const openPdfDocument = async (
  bytes: ArrayBuffer,
  options: { disableFontFace?: boolean } = {},
): Promise<{ document: PDFDocumentProxy; done: () => Promise<void> }> => {
  upsert();
  const pdfjs = await import('pdfjs-dist');
  const worker = new Worker(new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url), { type: 'module' });
  (pdfjs.GlobalWorkerOptions as { workerPort: Worker | null }).workerPort = worker;
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: options.disableFontFace ?? false,
    useWorkerFetch: false,
  });
  const document = await task.promise;
  return {
    document,
    done: async () => {
      await task.destroy().catch(() => undefined);
      worker.terminate();
      (pdfjs.GlobalWorkerOptions as { workerPort: Worker | null }).workerPort = null;
    },
  };
};
