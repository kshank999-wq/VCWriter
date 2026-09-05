/// <reference types="vite/client" />

import type { VcWriterApi } from '../preload/index';

declare global {
  interface Window {
    /** Exposed by the preload script; see src/preload/index.ts. */
    vcwriter: VcWriterApi;
  }
}

export {};
