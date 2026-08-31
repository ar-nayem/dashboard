"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, type ChangePasswordState } from "@/app/settings/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Changing…" : "Change password"}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formAction(formData);
        // Cleared on every submit, success or failure: leaving the current
        // password sitting in the field after a wrong-password error is the
        // one thing a password field should never do.
        formRef.current?.reset();
      }}
      className="card mt-3 flex max-w-sm flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="currentPassword" className="field-label">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className="field-label">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className="input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="field-label">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className="input"
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="text-sm text-success">
          {state.success}
        </p>
      )}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
