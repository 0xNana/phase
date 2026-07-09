"use client";

import type { ReactNode } from "react";

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="confirm-dialog-backdrop" role="presentation">
      <div className="confirm-dialog panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h2 id="confirm-dialog-title">{title}</h2>
        <div className="confirm-dialog-body">{body}</div>
        <div className="confirm-dialog-actions">
          <button className="button-secondary" type="button" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="button-primary" type="button" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
