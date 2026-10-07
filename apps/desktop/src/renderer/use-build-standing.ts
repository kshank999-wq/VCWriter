import { useEffect, useRef, useState } from 'react';
import { buildMovedOn } from './late-module';

/**
 * Whether this page has outlived the deployment it was opened against
 * (addendum 33 §9a).
 *
 * The browser preview is served from vc-writer.com, where every file is named
 * by a hash of its contents, so a deployment replaces all of them. A tab left
 * open across one goes on working from what it already holds — until it asks
 * for something it has not got, which is a part of the program fetched late,
 * and then it fails in the writer's hands with a chunk name. `late` says what
 * happened; this says it **first**, which is the only version of the fix that
 * is not an instruction.
 *
 * **It measures rather than guesses.** The page asks for its own entry script,
 * which is the one file it is certain the deployment it came from had, and a
 * flat refusal is the answer: no build id, no version endpoint, nothing stored
 * and nothing on the server to keep in step.
 *
 * **It asks when the window is returned to**, because that is the moment a
 * writer is about to act — which is exactly the moment the notice is worth
 * having, and the one moment a request costs nothing anybody notices. A timer
 * would ask while they type.
 *
 * It says nothing where there is no deployment to have moved on: the desktop
 * loads its renderer off the disk, and a file that is on the machine is on the
 * machine.
 */

/** However often the window is returned to, it is asked at most this often. */
const ASK_AT_MOST_EVERY_MS = 60_000;

/** The module script the page was loaded with — the file that proves the build. */
const entryScript = (): string | null =>
  document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? null;

export const useBuildStanding = (): boolean => {
  const [movedOn, setMovedOn] = useState(false);
  const settled = useRef(false);
  const asked = useRef(0);

  useEffect(() => {
    if (!/^https?:$/.test(window.location.protocol)) return undefined;
    const src = entryScript();
    if (src === null) return undefined;

    let alive = true;
    const ask = () => {
      if (settled.current || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - asked.current < ASK_AT_MOST_EVERY_MS) return;
      asked.current = now;
      // `no-store` so the question reaches the server: the file is served
      // immutable, which is the whole reason the browser still has it.
      void fetch(src, { method: 'HEAD', cache: 'no-store' })
        .then((response) => {
          if (!alive || !buildMovedOn(response.status)) return;
          settled.current = true;
          setMovedOn(true);
        })
        // Offline, blocked, or a server having a bad minute. None of that is
        // evidence that anybody deployed anything.
        .catch(() => undefined);
    };

    window.addEventListener('focus', ask);
    document.addEventListener('visibilitychange', ask);
    return () => {
      alive = false;
      window.removeEventListener('focus', ask);
      document.removeEventListener('visibilitychange', ask);
    };
  }, []);

  return movedOn;
};
