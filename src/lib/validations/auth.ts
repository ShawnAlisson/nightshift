import { z } from "zod";

// bcrypt only hashes the first 72 bytes, so reject anything longer instead of silently truncating.
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((value) => Buffer.byteLength(value) <= 72, "Password is too long");

const email = z.email("Enter a valid email address").trim().toLowerCase().max(254);

export const registerSchema = z.object({
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(72),
});

export type FormState =
  | {
      errors?: Record<string, string[] | undefined>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;
