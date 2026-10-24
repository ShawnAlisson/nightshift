import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUserId } from "@/lib/session";

// The page itself stays static; only these links wait for the session cookie.

export function HeaderAuthLink() {
  return (
    <Suspense fallback={<Skeleton className="h-9 w-24" />}>
      <HeaderLink />
    </Suspense>
  );
}

export function HeroActions() {
  return (
    <Suspense fallback={<Skeleton className="h-11 w-56" />}>
      <HeroButtons />
    </Suspense>
  );
}

async function HeaderLink() {
  const signedIn = !!(await getSessionUserId());

  return (
    <Link
      href={signedIn ? "/assistant" : "/login"}
      className={buttonVariants({ variant: signedIn ? "default" : "ghost" })}
    >
      {signedIn ? "Open assistant" : "Sign in"}
    </Link>
  );
}

async function HeroButtons() {
  const signedIn = !!(await getSessionUserId());

  if (signedIn) {
    return (
      <Link href="/assistant" className={buttonVariants({ size: "lg" })}>
        Open assistant
      </Link>
    );
  }

  return (
    <>
      <Link href="/assistant" className={buttonVariants({ size: "lg" })}>
        Get started
      </Link>
      <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
        Sign in
      </Link>
    </>
  );
}
