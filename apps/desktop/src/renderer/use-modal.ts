import { useEffect, useRef } from 'react';

/**
 * Drive a native `<dialog>` from React state: open it as a modal while
 * `open` is true and close it when that turns false. jsdom has no
 * `showModal`, so the attribute is set by hand there; the tests then see
 * the same markup the app shows.
 */
export function useModal(open: boolean) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      if (typeof node.showModal === 'function') node.showModal();
      else node.setAttribute('open', '');
    } else if (!open && node.open) {
      // Same story closing as opening: jsdom has no `close` either, so the
      // attribute comes off by hand and the tests see the app's own markup.
      if (typeof node.close === 'function') node.close();
      else node.removeAttribute('open');
    }
  }, [open]);
  return dialog;
}
