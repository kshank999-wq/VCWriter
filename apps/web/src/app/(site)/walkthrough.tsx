'use client';

import { useEffect, useRef, useState } from 'react';
import type { Walkthrough } from '@/lib/walkthroughs';

/**
 * The workflow, a box at a time (addendum 35 §14). A button opens it; each
 * step is one picture and a line or two; Next and Back, the arrow keys, or a
 * dot to jump. Escape or the × closes it.
 */
export function WalkthroughButton({ walkthrough, className = 'button' }: { walkthrough: Walkthrough; className?: string }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const steps = walkthrough.steps;
  const step = steps[at]!;

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setAt((n) => Math.min(n + 1, steps.length - 1));
      if (event.key === 'ArrowLeft') setAt((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [open, steps.length]);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setAt(0);
          setOpen(true);
        }}
      >
        {walkthrough.label}
      </button>
      <dialog
        ref={dialog}
        className="walkthrough"
        aria-label={walkthrough.title}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // A click on the dimmed page outside the box closes it.
          if (event.target === dialog.current) setOpen(false);
        }}
      >
        <header className="walkthrough-head">
          <p className="eyebrow">{walkthrough.title}</p>
          <button type="button" className="walkthrough-close" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>
        <figure className="walkthrough-shot">
          <img src={`/${step.shot}.jpg`} width={2880} height={1800} alt={step.alt} />
        </figure>
        <div className="walkthrough-words">
          <p className="walkthrough-count">
            Step {at + 1} of {steps.length}
          </p>
          <h2>{step.title}</h2>
          <p>{step.body}</p>
        </div>
        <footer className="walkthrough-foot">
          <button type="button" className="button secondary" disabled={at === 0} onClick={() => setAt(at - 1)}>
            Back
          </button>
          <span className="walkthrough-dots" role="tablist" aria-label="Steps">
            {steps.map((one, index) => (
              <button
                key={one.title}
                type="button"
                role="tab"
                aria-selected={index === at}
                aria-label={`Step ${index + 1}: ${one.title}`}
                className={index === at ? 'walkthrough-dot on' : 'walkthrough-dot'}
                onClick={() => setAt(index)}
              />
            ))}
          </span>
          {at < steps.length - 1 ? (
            <button type="button" className="button" onClick={() => setAt(at + 1)}>
              Next
            </button>
          ) : (
            <a href="/download" className="button">
              Buy &amp; download
            </a>
          )}
        </footer>
      </dialog>
    </>
  );
}
