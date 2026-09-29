import { useCallback, useEffect, useState } from 'react';
import type { CaptureItem } from '@vcwriter/domain';

/**
 * What the phone has sent and nobody has placed (addendum 09 §15).
 *
 * **One reading of the queue, for every room that shows it.** Research has had
 * it since stage 1; the Outliner and the Sculptor need it now, because Ken's
 * ask is to drag a note into a *place* in a plan and the only way that is one
 * gesture is for the notes to be where the plan is. Three components each
 * loading it would be three answers to *what is still waiting* — which is
 * addendum 24 §5j's rule pointed at a fetch rather than at a filter.
 *
 * It is **loaded when the room opens** rather than when a section is chosen,
 * which is the sync Ken asked for: *or it needs to automatically sync when you
 * load the app*. `reload` is the same act with a button on it, for the case
 * where a note was dictated while the room was already open.
 *
 * No bridge means no phone, which is an **empty queue rather than an error** —
 * the tests and any build without the cloud run this, and a writer should not
 * have to read a failure about a thing they are not using.
 */

export interface PhoneNotes {
  notes: CaptureItem[];
  loading: boolean;
  error: string | null;
  /** Ask again. */
  reload(): Promise<void>;
  /**
   * Write back what was done with a note and take it off the list.
   *
   * **The project change is made by the caller with the domain functions**;
   * this only records the outcome, which is `resolveCapture`'s own division of
   * labour on the desktop. Returns the reason it could not be recorded, or
   * null — the note is dropped from the list either way, the project having
   * already changed, and saying so is better than showing it as still waiting.
   */
  resolve(capture: CaptureItem): Promise<string | null>;
  /** Say what went wrong, where the caller's own act is what failed. */
  setError(message: string | null): void;
}

export const usePhoneNotes = (projectId: string): PhoneNotes => {
  const [notes, setNotes] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (typeof window.vcwriter?.listCaptures !== 'function') return;
    setLoading(true);
    setError(null);
    const result = await window.vcwriter.listCaptures(projectId);
    setLoading(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The phone’s notes could not be read');
      return;
    }
    setNotes(result.data);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const resolve = useCallback(async (capture: CaptureItem): Promise<string | null> => {
    setNotes((current) => current.filter((one) => one.id !== capture.id));
    if (typeof window.vcwriter?.resolveCapture !== 'function') return null;
    const written = await window.vcwriter.resolveCapture(capture);
    return written.ok ? null : (written.error ?? 'The phone’s copy could not be marked done');
  }, []);

  return { notes, loading, error, reload, resolve, setError };
};
