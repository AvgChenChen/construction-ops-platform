"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import type { ActionState } from "@/app/actions";
import { useDialog } from "./dialog-context";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({
  label,
  pendingLabel,
  pending,
  className = "btn-primary",
}: {
  label: string;
  pendingLabel?: string;
  pending: boolean;
  className?: string;
}) {
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span
            className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          {pendingLabel ?? "Saving…"}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function humanize(field: string) {
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function FormErrors({ state }: { state: ActionState }) {
  const entries = Object.entries(state.fieldErrors ?? {}).filter(([, v]) => v && v.length > 0);
  if (!state.error && entries.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-danger-ink/20 bg-danger-soft px-4 py-2 text-sm text-danger-ink"
    >
      {state.error ? <p className="font-medium">{state.error}</p> : null}
      {entries.length > 0 ? (
        <ul className="mt-1 list-disc pl-5">
          {entries.map(([field, messages]) => (
            <li key={field}>
              <span className="font-medium">{humanize(field)}:</span> {messages.join(", ")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * A form backed by a server action: pending state, server-side validation errors,
 * success message, optional reset, and closing its dialog on success.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  resetOnSuccess = true,
  className = "space-y-4",
  submitClassName,
  footer,
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  resetOnSuccess?: boolean;
  className?: string;
  submitClassName?: string;
  footer?: ReactNode;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const dialog = useDialog();

  useEffect(() => {
    if (!state.ok) return;
    if (resetOnSuccess) formRef.current?.reset();
    dialog?.close();
  }, [state, resetOnSuccess, dialog]);

  // React 19 clears uncontrolled fields after a form action, which would wipe the user's
  // input when validation fails. Submitting through startTransition avoids that; the plain
  // `action` attribute still works without JavaScript.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={className} noValidate>
      {children}
      <FormErrors state={state} />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} pending={isPending} className={submitClassName} />
        {footer}
        {state.ok && state.message && !dialog ? (
          <span role="status" className="text-sm text-success-ink">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** A single button that runs a server action. Errors show inline next to it. */
export function ActionButton({
  action,
  label,
  pendingLabel,
  className = "btn-secondary btn-sm",
}: {
  action: () => Promise<ActionState>;
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [state, formAction, isPending] = useActionState(async () => action(), {});
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <SubmitButton label={label} pendingLabel={pendingLabel ?? label} pending={isPending} className={className} />
      {state.error ? (
        <span role="alert" className="text-xs text-danger-ink">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
