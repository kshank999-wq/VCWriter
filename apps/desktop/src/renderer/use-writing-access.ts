import { useCallback, useEffect, useState } from 'react';
import { writingStanding, type DeskStanding, type WritingStanding } from '@vcwriter/domain';

/**
 * Whether this copy may be written in (addendum 32 §8, from Ken: *make the
 * lapse read-only on the desktop*).
 *
 * **One hook per window, because the standing is the machine's.** A popped-out
 * room asks for itself rather than asking the workspace — addendum 29 §2's rule
 * from the other end: a room may not write the *file*, the workspace owning the
 * path, while whether anybody may write at all is nobody's to own. It matters
 * that a satellite knows: a writer who typed a paragraph into a room and
 * watched the hub refuse it would see their words vanish, which is worse than
 * being told.
 *
 * What it reads is the **record** the host keeps, through the domain's one
 * reading. The host answers from that record rather than from the network, so
 * this never blocks on vc-writer.com and a machine that cannot ask carries on
 * writing.
 */
export interface WritingAccess extends WritingStanding {
  /** Ask vc-writer.com again — what the notice's own button does. */
  recheck(): void;
  checking: boolean;
}

/** How often an open window asks the host again. */
const ASK_EVERY_MS = 60 * 60 * 1000;

export const useWritingAccess = (): WritingAccess => {
  const [standing, setStanding] = useState<DeskStanding | null>(null);
  const [checking, setChecking] = useState(false);

  const ask = useCallback(async (recheck: boolean) => {
    const answer = await window.vcwriter?.licenseStanding?.(recheck);
    // A host with no such method, or one that could not answer, is a machine
    // that has heard nothing — which is the writable state. The absence is
    // never read as a lapse.
    setStanding(answer?.ok ? (answer.data ?? null) : null);
  }, []);

  useEffect(() => {
    void ask(false);
    const timer = window.setInterval(() => void ask(false), ASK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [ask]);

  const recheck = useCallback(() => {
    setChecking(true);
    void ask(true).finally(() => setChecking(false));
  }, [ask]);

  // Read every render rather than held in state: the grace ends on a date, so a
  // standing that is a warning today is a refusal next week with nothing told
  // to — the same reason no status in this program is stored.
  return { ...writingStanding(standing, new Date()), recheck, checking };
};
