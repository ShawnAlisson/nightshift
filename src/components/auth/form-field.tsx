import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = React.ComponentProps<typeof Input> & {
  name: string;
  label: string;
  errors?: string[];
};

export function FormField({ name, label, errors, ...props }: FormFieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={!!errors}
        aria-describedby={errors ? errorId : undefined}
        {...props}
      />
      {errors && (
        <p id={errorId} className="text-sm text-destructive">
          {errors[0]}
        </p>
      )}
    </div>
  );
}
