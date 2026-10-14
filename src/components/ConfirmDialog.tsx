"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "./Dialog";
import { Button, InlineAlert } from "./ui";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
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
          <Button onClick={close}>Cancel</Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
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
      <div className="space-y-3 text-[14.5px] leading-relaxed text-fg-2">
        <div>{description}</div>
        {error && <InlineAlert>{error}</InlineAlert>}
      </div>
    </Dialog>
  );
}
