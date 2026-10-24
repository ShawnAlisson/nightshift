"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { register } from "@/actions/auth";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";

export function RegisterForm({ inviteOnly }: { inviteOnly: boolean }) {
  const [state, action, pending] = useActionState(register, undefined);

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
        autoComplete="new-password"
        minLength={8}
        errors={state?.errors?.password}
        required
      />
      {inviteOnly && (
        <FormField
          name="inviteCode"
          label="Invite code"
          autoComplete="off"
          errors={state?.errors?.inviteCode}
          required
        />
      )}
      {state?.message && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
