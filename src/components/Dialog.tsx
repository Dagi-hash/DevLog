"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

/**
 * Accessible modal built on the native <dialog>: focus trapping, Escape to
 * close and the backdrop come from the browser. Renders as a bottom sheet on phones.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  /** When set, the dialog body is a form and Enter submits it. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first focusable element (the close button). Prefer the
      // field marked data-autofocus on pointer devices; on touch, focus the dialog
      // itself so the on-screen keyboard doesn't cover the sheet uninvited.
      const target = dialog.querySelector<HTMLElement>("[data-autofocus]");
      if (target && window.matchMedia?.("(pointer: fine)").matches) target.focus();
      else dialog.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Escape fires "cancel": route it through onClose so React state stays in charge.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, []);

  const body = (
    <>
      <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <h2 id={titleId} className="text-heading font-semibold tracking-[-0.01em] text-fg">
            {title}
          </h2>
          {description && (
            <div id={descriptionId} className="mt-1.5 text-body text-fg-2">
              {description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-2 -mr-2.5 grid size-11 shrink-0 place-items-center rounded-sm text-fg-3 transition-colors hover:bg-hover hover:text-fg"
        >
          <X className="size-[18px]" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
      <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6 [&>button]:h-12 sm:[&>button]:h-10">
        {footer}
      </div>
    </>
  );

  return (
    <dialog
      ref={ref}
      className="app-dialog focus-visible:outline-none"
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        // Click on the backdrop (outside the panel) closes.
        if (event.target === ref.current) onClose();
      }}
    >
      {open &&
        (onSubmit ? (
          <form
            noValidate
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(event);
            }}
          >
            {body}
          </form>
        ) : (
          body
        ))}
    </dialog>
  );
}
