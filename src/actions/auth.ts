"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/models/user";
import { createSession, deleteSession } from "@/lib/session";
import { FormState, loginSchema, registerSchema } from "@/lib/validations/auth";

const BCRYPT_COST = 12;

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const dummyHash = bcrypt.hash("not-a-real-password", BCRYPT_COST);

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const input = { email: field(formData, "email") };
  const parsed = registerSchema.safeParse({ ...input, password: field(formData, "password") });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values: input };
  }

  const { email, password } = parsed.data;
  await connectDB();

  let userId: string;
  try {
    const user = await User.create({
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
    });
    userId = user.id;
  } catch (error) {
    // 11000 = duplicate key on the unique email index.
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return { errors: { email: ["This email is already registered"] }, values: input };
    }
    console.error("register failed", error);
    return { message: "Something went wrong. Please try again.", values: input };
  }

  await createSession(userId);
  redirect("/assistant");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const input = { email: field(formData, "email") };
  const parsed = loginSchema.safeParse({ ...input, password: field(formData, "password") });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values: input };
  }

  const { email, password } = parsed.data;
  await connectDB();

  const user = await User.findOne({ email }).select("+passwordHash");
  const valid = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) {
    return { message: "Invalid email or password", values: input };
  }

  await createSession(user.id);
  redirect("/assistant");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
