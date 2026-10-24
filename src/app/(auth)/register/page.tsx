import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isInviteOnly } from "@/lib/signup";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Card className="w-full max-w-sm shadow-lg [--card-spacing:--spacing(6)]">
      <Suspense fallback={<RegisterSkeleton />}>
        <RegisterContent />
      </Suspense>
      <CardFooter className="text-sm text-muted-foreground">
        Already registered?&nbsp;
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}

// Reads env at request time so toggling invite-only never needs a rebuild.
async function RegisterContent() {
  await connection();
  const inviteOnly = isInviteOnly();

  return (
    <>
      <CardHeader>
        <CardTitle className="text-xl">Create account</CardTitle>
        <CardDescription>
          {inviteOnly
            ? "Registration is invite only. Enter your invite code to join."
            : "Sign up with your email and a password."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm inviteOnly={inviteOnly} />
      </CardContent>
    </>
  );
}

function RegisterSkeleton() {
  return (
    <CardContent className="grid gap-5" aria-hidden>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-11 w-full" />
    </CardContent>
  );
}
