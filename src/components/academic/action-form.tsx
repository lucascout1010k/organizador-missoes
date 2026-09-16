"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";

import {
  INITIAL_ACTION_STATE,
  type ActionState,
} from "@/lib/academic/types";

type AcademicAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  className = "form-grid",
  resetOnSuccess = false,
  submitLabel = "Salvar",
  version,
}: {
  action: AcademicAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  submitLabel?: string;
  version?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_ACTION_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.success) formRef.current?.reset();
  }, [resetOnSuccess, state.success]);

  return (
    <form action={formAction} className={className} ref={formRef}>
      <fieldset className="contents" disabled={isPending} key={version}>
        {children}
        <div className="form-footer">
          <div aria-live="polite" className="form-feedback">
            {state.error ? <p className="form-error">{state.error}</p> : null}
            {state.success ? <p className="form-success">{state.success}</p> : null}
          </div>
          <button aria-busy={isPending} className="button button-primary" type="submit">
            {isPending ? "Salvando…" : submitLabel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
