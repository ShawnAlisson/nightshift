import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Nightshift</h1>
      <div className="flex gap-3">
        <Link href="/login" className={buttonVariants()}>
          Sign in
        </Link>
        <Link href="/register" className={buttonVariants({ variant: "outline" })}>
          Create account
        </Link>
      </div>
    </main>
  );
}
