import { Bookmark, Layers, ShieldCheck } from "lucide-react";
import { HeaderAuthLink, HeroActions } from "@/components/landing/auth-actions";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const FEATURES = [
  {
    icon: Layers,
    title: "Every top model",
    description: "Switch between Anthropic, OpenAI, Gemini and OpenRouter in the middle of a conversation.",
  },
  {
    icon: Bookmark,
    title: "Conversations that stay",
    description: "Pick up where you left off. Every chat is saved to your account and ready when you return.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    description: "Your chats are tied to your account and are never visible to anyone else.",
  },
];

export default function Home() {
  return (
    <div className="bg-glow flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <HeaderAuthLink />
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4">
        <section className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-6 py-20 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Your personal assistant, <span className="text-gradient">on every model</span>
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            Ask, draft and think things through with the best AI models in one calm place, with your
            conversations saved for later.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <HeroActions />
          </div>
        </section>

        <section aria-label="Features" className="grid gap-4 pb-20 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <h2 className="font-medium">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
