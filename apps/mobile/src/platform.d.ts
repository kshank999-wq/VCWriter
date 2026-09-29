/**
 * The few globals this app leans on, declared rather than pulled in whole.
 *
 * `packages/domain/src/platform.d.ts` does the same thing for the same reason:
 * adding `"dom"` to `lib` would hand a React Native app the whole browser to
 * autocomplete against, most of which is not there — and a type that promises
 * something the device does not have is worse than no type at all.
 */
declare function btoa(data: string): string;

interface Crypto {
  randomUUID?(): string;
}
declare const crypto: Crypto | undefined;
