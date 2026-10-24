import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Profile />
      </Suspense>
    </main>
  );
}

async function Profile() {
  const user = await getCurrentUser();

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="text-muted-foreground">{user.email}</p>
      </div>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </>
  );
}
