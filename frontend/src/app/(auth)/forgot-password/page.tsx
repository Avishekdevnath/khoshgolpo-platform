"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";

import AuthShell from "@/components/auth/AuthShell";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    setResetToken(null);
    try {
      const response = await apiPost<{ message: string; reset_token?: string }>(
        "auth/forgot-password",
        {
          email: email.trim().toLowerCase(),
        }
      );
      setMessage(response.message);
      setResetToken(response.reset_token ?? null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not request reset link");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Recover Account"
      title="Forgot password?"
      description="Enter your email and we will send you a reset link."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-muted">
            Account email
          </label>
          <Input
            id="email"
            placeholder="you@example.com"
            type="email"
            className="bg-surface2"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          <Mail className="h-4 w-4" />
          {isSubmitting ? "Sending..." : "Send Reset Link"}
        </Button>

        {message ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            {message}
          </div>
        ) : null}
        {resetToken ? (
          <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs text-foreground">
            Dev reset token: <span className="break-all">{resetToken}</span>
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between text-sm text-muted">
          <Link href="/login" className="text-foreground underline-offset-4 transition hover:underline">
            Back to sign in
          </Link>
          <Link href="/reset-password" className="transition hover:text-foreground">
            I have a reset code
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
