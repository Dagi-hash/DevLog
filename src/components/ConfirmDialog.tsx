"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "./Dialog";
import { Button, InlineAlert } from "./ui";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  /** Should name the action explicitly, e.g. "Delete entry". */
  confirmLabel: string;
  /** Return an error message to keep the dialog open, or nothing on success. */
  onConfirm: () => string | void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button onClick={close} data-autofocus>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const result = onConfirm();
              if (typeof result === "string") setError(result);
              else close();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-body leading-relaxed text-fg-2">
        <div>{description}</div>
        {error && <InlineAlert>{error}</InlineAlert>}
      </div>
    </Dialog>
  );
}
