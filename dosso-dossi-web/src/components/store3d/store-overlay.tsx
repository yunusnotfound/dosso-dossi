"use client";

import { useEffect, useRef, type ReactNode } from "react";

type StoreOverlayProps = {
  children: ReactNode;
  className: string;
  label: string;
  onClose: () => void;
};

function focusableElements(dialog: HTMLDialogElement) {
  return [
    ...dialog.querySelectorAll<HTMLElement>(
      "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]",
    ),
  ].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.closest("[inert]") &&
      element.getClientRects().length > 0,
  );
}

/** Native modal semantics keep the background store inert during an overlay. */
export function StoreOverlay({
  children,
  className,
  label,
  onClose,
}: StoreOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeCallback = useRef(onClose);
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    closeCallback.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    (focusableElements(dialog)[0] ?? dialog).focus({ preventScroll: true });

    return () => {
      dialog.close();
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={className}
      aria-label={label}
      aria-modal="true"
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        closeCallback.current();
      }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        backdropPointerDown.current =
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom);
      }}
      onClick={(event) => {
        if (
          backdropPointerDown.current &&
          event.target === event.currentTarget
        ) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            closeCallback.current();
        }
        backdropPointerDown.current = false;
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== "Tab") return;
        const focusable = focusableElements(event.currentTarget);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          event.preventDefault();
          event.currentTarget.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === event.currentTarget)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onKeyUp={(event) => event.stopPropagation()}
    >
      {children}
    </dialog>
  );
}
