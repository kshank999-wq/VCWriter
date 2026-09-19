/**
 * The few platform globals the domain leans on that its own library set
 * (no DOM) does not declare: they exist in every place the domain runs —
 * Chromium, Electron's main process and Node 18 and later — and declaring
 * the little of them that is used keeps the DOM library out of a package
 * that must not otherwise reach for a window.
 */

declare function atob(data: string): string;

declare class TextEncoder {
  encode(input?: string): Uint8Array;
}

declare class CompressionStream {
  constructor(format: 'deflate' | 'deflate-raw' | 'gzip');
}

interface ByteReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
}

declare class ReadableStream {
  constructor(source: { start(controller: { enqueue(chunk: Uint8Array): void; close(): void }): void });
  pipeThrough(transform: CompressionStream): { getReader(): ByteReader };
}
