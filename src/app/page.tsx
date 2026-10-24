import { AudioLines, BellRing, Lock, MessageCircleHeart, Monitor, ShieldCheck } from "lucide-react";
import { HeaderAuthLink, HeroActions } from "@/components/landing/auth-actions";
import { ProductPreview } from "@/components/landing/product-preview";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { siteConfig } from "@/config/site";

const STEPS = [
  {
    title: "Say what you need",
    description: "“Order my usual groceries.” “Pay the electricity bill.” Just talk, the way you normally would.",
  },
  {
    title: "Watch it happen",
    description: "It does the task on its own computer in the cloud. You can watch every click, live, or just wait.",
  },
  {
    title: "Approve the important bits",
    description: "Before it pays, sends or submits anything, it stops and asks you. You always have the final say.",
  },
];

const FEATURES = [
  {
    icon: AudioLines,
    title: "Voice is on from the start",
    description: "It listens as soon as you open it, answers out loud, then listens again. No buttons needed.",
  },
  {
    icon: Monitor,
    title: "Works on any website",
    description: "It uses a real browser like a person would, so it works with shops and accounts that have no app or API.",
  },
  {
    icon: BellRing,
    title: "Reminds you before things are due",
    description: "Your weekly shop, a prescription refill, a bill. They show up as simple cards, ready to do in one tap.",
  },
  {
    icon: MessageCircleHeart,
    title: "Understands how you talk",
    description: "Save a routine and the words you use for it. Say “the usual” and it knows exactly what you mean.",
  },
  {
    icon: ShieldCheck,
    title: "You stay in control",
    description: "It never types your passwords or payment details. When a login is needed, you take over, then hand it back.",
  },
  {
    icon: Lock,
    title: "Your own private desktop",
    description: "Everything happens on your own isolated desktop, separate from your device, and tied only to your account.",
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
        <section className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
            <p className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
              Built for people with limited hand mobility
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Get things done with your <span className="text-gradient">voice</span>, not your hands
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              {siteConfig.name} handles your shopping, bills and everyday account tasks on a real computer, while you just
              talk. Hands-free, from the moment you open it.
            </p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <HeroActions />
            </div>
          </div>
          <ProductPreview />
        </section>

        <section id="how-it-works" aria-labelledby="how-heading" className="py-12">
          <h2 id="how-heading" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ title, description }, index) => (
              <li key={title} className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-medium">{title}</h3>
                <p className="mt-1 text-muted-foreground">{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features-heading" className="py-12">
          <h2 id="features-heading" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Made to be easy
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
                <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16">
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Ready to hand the clicking to someone else?
            </h2>
            <p className="max-w-lg text-muted-foreground">Open it, say hello, and tell it what you need.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <HeroActions />
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-center text-sm text-muted-foreground">
        {siteConfig.name} · Voice-first help for everyday tasks
      </footer>
    </div>
  );
}
