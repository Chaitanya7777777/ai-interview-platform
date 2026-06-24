"use client";

/**
 * app/(auth)/verify-email/page.tsx
 * ---------------------------------
 * Calm, centered email verification page.
 *
 * Features:
 * - Progressive polling: 5s → 10s → 15s → stop after ~60s total
 * - Resend button with 30-second cooldown + live countdown
 * - Open Inbox shortcut (Gmail, Outlook, Yahoo, iCloud, ProtonMail)
 * - maskEmail() so the full address is never displayed
 * - Change Email → back to /signup with email prefilled
 * - On verified: checkmark animation → toast → redirect /dashboard (1s delay)
 * - Isolated in Suspense so useSearchParams() works in Next.js App Router
 */

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  RefreshCw,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  maskEmail,
  getEmailProvider,
  normalizeEmail,
} from "@/utils/disposable-email";

// ── Constants ─────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN_SEC = 30;

/** Progressive poll delays in ms. Totals ~60s before auto-stopping. */
const POLL_SCHEDULE_MS = [5_000, 10_000, 15_000, 15_000, 15_000] as const;

// ── Inner component (reads search params) ─────────────────────────────────────

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawEmail = searchParams.get("email") ?? "";
  const email = normalizeEmail(rawEmail);
  const masked = email ? maskEmail(email) : "";
  const provider = email ? getEmailProvider(email) : null;

  // ── State ──────────────────────────────────────────────────────────────────
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);       // seconds remaining

  const pollIndexRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Verification check ─────────────────────────────────────────────────────

  const checkVerification = useCallback(async (isManual = false) => {
    if (verified) return;

    if (isManual) setChecking(true);

    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (user?.email_confirmed_at) {
        console.log("[Auth] verification_success:", user.email);
        setVerified(true);
        toast.success("Email verified — welcome to InterviewAI!");
        setTimeout(() => router.push("/dashboard"), 1_000);
        return true;
      }
    } catch {
      // Silent — user may not be signed in yet if they opened a new tab
    } finally {
      if (isManual) setChecking(false);
    }

    return false;
  }, [verified, router]);

  // ── Progressive polling ────────────────────────────────────────────────────

  const scheduleNextPoll = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (pollIndexRef.current >= POLL_SCHEDULE_MS.length) return; // schedule exhausted

    const delay = POLL_SCHEDULE_MS[pollIndexRef.current] as number;
    pollIndexRef.current += 1;

    pollTimerRef.current = setTimeout(async () => {
      const success = await checkVerification();
      if (!success) scheduleNextPoll();
    }, delay);
  }, [checkVerification]);

  useEffect(() => {
    // Kick off the first poll
    scheduleNextPoll();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resend cooldown timer ──────────────────────────────────────────────────

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SEC);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownTimerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1_000);
  };

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  // ── Resend handler ─────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (cooldown > 0 || resending || !email) return;

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("rate") || message.includes("too many")) {
          toast.error("Too many attempts. Please wait a few minutes.");
        } else {
          toast.error("Failed to resend. Please try again.");
        }
        return;
      }

      toast.success("Verification email sent — check your inbox.");
      startCooldown();
    } catch {
      toast.error("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────

  if (verified) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 animate-in zoom-in-50 duration-300">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Email verified!</h1>
        <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-2" />
      </div>
    );
  }

  // ── Main state ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center text-center gap-6">
      {/* Icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Mail className="h-8 w-8 text-primary" />
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Verify your email
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          We sent a verification link to
        </p>
        {masked && (
          <p className="text-sm font-semibold text-foreground">
            {masked}
          </p>
        )}
        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
          Click the link in your inbox to activate your account.
          Check your spam folder if you don&apos;t see it.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {/* Open Inbox shortcut */}
        {provider && (
          <Button
            variant="default"
            className="w-full gap-2"
            onClick={() => window.open(provider.url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4" />
            Open {provider.name}
          </Button>
        )}

        {/* Resend */}
        <Button
          variant={provider ? "outline" : "default"}
          className="w-full gap-2"
          disabled={cooldown > 0 || resending}
          onClick={handleResend}
        >
          {resending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RotateCcw className="h-4 w-4" />}
          {resending
            ? "Sending…"
            : cooldown > 0
            ? `Resend in ${cooldown}s`
            : "Resend Email"}
        </Button>

        {/* Refresh Status */}
        <Button
          variant="outline"
          className="w-full gap-2"
          disabled={checking}
          onClick={() => checkVerification(true)}
        >
          {checking
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />}
          {checking ? "Checking…" : "Refresh Status"}
        </Button>

        {/* Change Email */}
        <Link
          href={email ? `/signup?email=${encodeURIComponent(email)}` : "/signup"}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline pt-1"
        >
          Use a different email
        </Link>
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground/50 pt-2">
        Need help?{" "}
        <a
          href="mailto:support@interviewai.app"
          className="underline underline-offset-4 hover:text-muted-foreground transition-colors"
        >
          Contact support
        </a>
      </p>
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function VerifyEmailPage() {
  return (
    // Minimal centered layout — no marketing panel, no sidebar
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[480px] rounded-2xl border border-border/50 bg-card p-8 shadow-xl">
        <Suspense
          fallback={
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <VerifyEmailForm />
        </Suspense>
      </div>
    </div>
  );
}
