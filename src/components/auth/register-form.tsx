"use client";

import { useActionState } from "react";
import { register } from "@/actions/auth";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <form action={action} className="grid gap-4">
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state?.values?.email}
        errors={state?.errors?.email}
        required
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        errors={state?.errors?.password}
        required
      />
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
