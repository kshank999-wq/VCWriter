import { useState } from 'react';
import type { WritingAccess } from '../use-writing-access';

/**
 * What a lapsed subscription means here, said once at the top (addendum 32 §8,
 * from Ken: *make the lapse read-only on the desktop*).
 *
 * **One component for the warning and the refusal**, because they are one
 * sentence from the domain in two states, and a second banner would be a second
 * answer to *why can I not type*. The shape is the notice bar every other
 * message here wears and only what it means differs, so the refusal is a
 * modifier rather than a bar of its own. Absent while the subscription is paid
 * — a bar counting down a bill nobody has cancelled is the program nagging
 * while somebody works.
 *
 * **A warning may be dismissed and a refusal may not.** During the week before
 * read-only bites this is news, and news a writer has read is news they should
 * be able to put away; afterwards it is the explanation of a program that will
 * not take a keystroke, which is the one notice they have to be able to find at
 * any moment. Dismissing is about this sitting and is remembered nowhere.
 */
export function WritingNotice({ access }: { access: WritingAccess }) {
  const [put, setPut] = useState(false);
  if (!access.notice) return null;
  if (access.warning && put) return null;

  return (
    <p
      className={`notice banner writing-notice${access.writable ? '' : ' lapsed'}`}
      role={access.writable ? 'status' : 'alert'}
    >
      <span>{access.notice}</span>
      {/* The way out, beside the reason: a refusal a writer cannot act on from
          where they are told about it is one they go hunting to fix. The link
          opens in their own browser, the host sending every `_blank` to the
          real one (addendum 30 §2a) identically in both builds. */}
      <span className="notice-acts">
        <button
          type="button"
          className="ghost"
          onClick={() => window.open('https://vc-writer.com/account', '_blank', 'noreferrer')}
        >
          Renew
        </button>
        <button type="button" className="ghost" disabled={access.checking} onClick={access.recheck}>
          {access.checking ? 'Checking…' : 'Check again'}
        </button>
        {access.warning ? (
          <button type="button" className="ghost" onClick={() => setPut(true)}>
            Dismiss
          </button>
        ) : null}
      </span>
    </p>
  );
}
