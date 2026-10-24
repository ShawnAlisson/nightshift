"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = React.ComponentProps<typeof Input> & {
  name: string;
  label: string;
  errors?: string[];
};

export function FormField({ name, label, errors, type, ...props }: FormFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const errorId = `${name}-error`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={!!errors}
          aria-describedby={errors ? errorId : undefined}
          className={isPassword ? "pr-10" : undefined}
          {...props}
        />
        {isPassword && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            onClick={() => setRevealed((v) => !v)}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
          >
            {revealed ? <EyeOff /> : <Eye />}
          </Button>
        )}
      </div>
      {errors && (
        <p id={errorId} className="text-sm text-destructive">
          {errors[0]}
        </p>
      )}
    </div>
  );
}
