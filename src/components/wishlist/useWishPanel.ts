import { createSignal } from "solid-js";

export interface WishPanel {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  attach: (dialog: HTMLDialogElement) => void;
  handleClose: () => void;
}

/**
 * The mobile add-wish dialog's state. The dialog element is the single source
 * of truth for whether it is open; the signal mirrors it for rendering.
 */
export function useWishPanel(): WishPanel {
  const [isOpen, setIsOpen] = createSignal(false);
  let dialog: HTMLDialogElement | undefined;

  return {
    isOpen,
    open: () => {
      if (!dialog?.open) dialog?.showModal();
      setIsOpen(true);
    },
    close: () => {
      dialog?.close();
      setIsOpen(false);
    },
    attach: (element) => {
      dialog = element;
    },
    handleClose: () => setIsOpen(false),
  };
}
