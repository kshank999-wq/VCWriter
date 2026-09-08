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
      node.close();
    }
  }, [open]);
  return dialog;
}
