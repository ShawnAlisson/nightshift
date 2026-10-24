"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { login } from "@/actions/auth";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="grid gap-5">
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
        autoComplete="current-password"
        errors={state?.errors?.password}
        required
      />
      {state?.message && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
