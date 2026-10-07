import { useState } from 'react';
import { BUILD_MOVED_ON } from '../late-module';

/**
 * This page has outlived its deployment, said once at the top
 * (addendum 33 §9a).
 *
 * The shape is `WritingNotice`'s and for its reason: one bar for every message
 * in this window, so only what it *means* differs. **The button is the act** —
 * a notice whose way out is a sentence telling somebody to reload has left the
 * work with them, which is what this exists to stop.
 *
 * Reloading needs nothing done first: the project has flushed on `beforeunload`
 * since it was written, so the last few seconds of writing reach the disk
 * before the page goes.
 *
 * **It may be dismissed**, which is the lapse bar's own rule — this is news
 * rather than a refusal, nothing here stops working, and news a writer has
 * read is news they should be able to put away. Dismissing is about this
 * sitting and is remembered nowhere.
 */
export function StaleBuildNotice({ movedOn }: { movedOn: boolean }) {
  const [put, setPut] = useState(false);
  if (!movedOn || put) return null;

  return (
    <p className="notice banner" role="status">
      <span>{BUILD_MOVED_ON}</span>
      <span className="notice-acts">
        <button type="button" className="ghost" onClick={() => window.location.reload()}>
          Reload
        </button>
        <button type="button" className="ghost" onClick={() => setPut(true)}>
          Dismiss
        </button>
      </span>
    </p>
  );
}
