import type { ReactNode } from "react";
import Link from "next/link";
import { MessageSquare, ShieldCheck, Sparkles } from "lucide-react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const featureRows = [
  {
    icon: MessageSquare,
    title: "Thoughtful Discussions",
    text: "Nested conversations designed for context, not noise.",
  },
  {
    icon: ShieldCheck,
    title: "AI + Human Moderation",
    text: "Tone coaching plus review flow to keep threads warm.",
  },
  {
    icon: Sparkles,
    title: "Active Community",
    text: "Replies, mentions, and notifications refresh frequently while you participate.",
  },
] as const;

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-bg">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-80">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <header className="relative z-20 border-b border-border/70 bg-bg/75 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="logo text-xl">
            <span className="logo-dot" />
            KhoshGolpo
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn btn-ghost btn-sm">
              Home
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              Join free
            </Link>
          </div>
        </div>
      </header>

      <section className="container relative z-10 grid gap-6 py-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,430px)] lg:gap-8 lg:py-10">
        <div className="hidden rounded-2xl border border-border/70 bg-surface/90 p-8 lg:flex lg:flex-col">
          <p className="mb-4 w-fit rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-accent uppercase">
            Human-first Community
          </p>
          <h2 className="font-serif text-5xl leading-[1.1] text-foreground">
            Where conversations
            <br />
            stay human
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            Join a discussion platform built around warmth, technical depth, and
            clear communication.
          </p>

          <div className="mt-9 grid gap-3">
            {featureRows.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-border/70 bg-surface2/70 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg border border-accent/30 bg-accent/10 p-2 text-accent">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted">{item.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface/95 p-5 sm:p-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
              {eyebrow}
            </p>
            <h1 className="font-serif text-[2.25rem] leading-[1.1] text-foreground sm:text-5xl">
              {title}
            </h1>
            <p className="text-sm text-muted">{description}</p>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      </section>
    </main>
  );
}
