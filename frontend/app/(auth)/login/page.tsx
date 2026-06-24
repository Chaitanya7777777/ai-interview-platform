"use client";

import { FormEvent, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RotateCcw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/auth.service";
import { normalizeEmail } from "@/utils/disposable-email";
import { supabase } from "@/lib/supabase";

/**
 * Inner component — isolated so that useSearchParams() is confined to a
 * subtree that Next.js can wrap in Suspense during static generation.
 *
 * Next.js App Router requires any component calling useSearchParams() to be
 * inside a <Suspense> boundary. Without it the production build fails:
 *   "useSearchParams() should be wrapped in a suspense boundary"
 *
 * Local dev (`next dev`) does not enforce this — only `next build` does.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline state when user tries to log in with an unverified email.
  // This replaces the login form with a targeted UI — no page redirect.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const nextPath = searchParams.get("next") ?? "/dashboard";

  // ── Resend cooldown ────────────────────────────────────────────────────────

  const startResendCooldown = () => {
    setResendCooldown(30);
    const timer = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(timer); return 0; }
        return s - 1;
      });
    }, 1_000);
  };

  // ── Resend handler ─────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (!unverifiedEmail || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: unverifiedEmail,
      });
      if (error) {
        const msg = error.message.toLowerCase();
        toast.error(
          msg.includes("rate") || msg.includes("too many")
            ? "Too many attempts. Please wait a few minutes."
            : "Failed to resend. Please try again."
        );
        return;
      }
      toast.success("Verification email sent — check your inbox.");
      startResendCooldown();
    } catch {
      toast.error("Failed to resend. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  // ── Main sign-in handler ───────────────────────────────────────────────────

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);
    setIsSubmitting(true);

    try {
      const { user } = await authService.signIn({
        email: normalizedEmail,
        password,
      });

      // Check email verification status
      if (user && !user.email_confirmed_at) {
        // Sign out silently — don't grant an unverified session access.
        await supabase.auth.signOut();
        setUnverifiedEmail(normalizedEmail);
        return;
      }

      toast.success("Signed in successfully.");
      router.refresh();
      router.push(nextPath);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Sign in failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Unverified email inline state ──────────────────────────────────────────

  if (unverifiedEmail) {
    return (
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            Verify your email
          </h1>
          <p className="text-muted-foreground">
            Your account isn&apos;t active yet.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 space-y-4">
          <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            Verify your email before continuing. We sent a confirmation link
            when you signed up — check your inbox (and spam folder).
          </p>

          <div className="flex flex-col gap-2.5">
            <Button
              className="w-full gap-2"
              disabled={resendCooldown > 0 || isResending}
              onClick={handleResend}
            >
              {isResending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RotateCcw className="h-4 w-4" />}
              {isResending
                ? "Sending…"
                : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : "Resend Email"}
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setUnverifiedEmail(null)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Wrong account?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create a new one
          </Link>
        </p>
      </div>
    );
  }

  // ── Normal login form ──────────────────────────────────────────────────────

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
          Welcome back
        </h1>
        <p className="text-muted-foreground">
          Enter your credentials to access your account
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            required
            className="h-12"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="#"
              className="text-sm font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            className="h-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            autoComplete="current-password"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base font-medium"
          disabled={isSubmitting}
        >
          {isSubmitting && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Sign up for free
        </Link>
      </p>
    </div>
  );
}

/**
 * Page export — wraps LoginForm in Suspense so Next.js can statically
 * prerender the shell while deferring the useSearchParams() read to the client.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full animate-pulse" aria-label="Loading..." />}>
      <LoginForm />
    </Suspense>
  );
}
