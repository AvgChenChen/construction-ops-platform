"use client";

import { useActionState, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { ActionState } from "@/app/actions";
import { DialogContext } from "./dialog-context";
import { SubmitButton } from "./forms";
import { XIcon } from "./icons";

/**
 * Modal built on the native <dialog> element: focus is trapped and Escape closes it
 * without extra libraries. Focus returns to the trigger on close.
 */
function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" }[size];
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      className={`m-auto w-[calc(100%-2rem)] ${width} rounded-lg border border-line bg-raised p-0 text-ink shadow-overlay backdrop:bg-ink/40`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div>
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="btn-ghost btn-sm -mr-2 px-2" aria-label="Close dialog">
          <XIcon />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-6 py-6">{open ? children : null}</div>
    </dialog>
  );
}

/** A button that opens a dialog containing a form. The form closes the dialog on success. */
export function FormDialog({
  trigger,
  triggerClassName = "btn-primary",
  title,
  description,
  size,
  children,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ctx = useMemo(() => ({ close }), [close]);
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      <DialogContext.Provider value={ctx}>
        <Modal open={open} onClose={close} title={title} description={description} size={size}>
          {children}
        </Modal>
      </DialogContext.Provider>
    </>
  );
}

/** A destructive or significant action that asks for confirmation in a dialog first. */
export function ConfirmButton({
  action,
  label,
  title,
  description,
  confirmLabel,
  tone = "danger",
  triggerClassName = "btn-secondary btn-sm",
}: {
  action: () => Promise<ActionState>;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(async () => action(), {});
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="sm">
        <p className="text-sm text-ink-muted">{description}</p>
        {state.error ? (
          <p role="alert" className="mt-4 rounded-md bg-danger-soft px-4 py-2 text-sm text-danger-ink">
            {state.error}
          </p>
        ) : null}
        <form action={formAction} className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <SubmitButton
            label={confirmLabel}
            pending={isPending}
            className={tone === "danger" ? "btn-danger" : "btn-primary"}
          />
        </form>
      </Modal>
    </>
  );
}
