import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-4">
        <Logo href="/assistant" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
              <LogOut />
              <span className="max-sm:sr-only">Sign out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
