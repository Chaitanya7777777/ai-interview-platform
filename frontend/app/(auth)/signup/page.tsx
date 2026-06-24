"use client";

import { FormEvent, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/auth.service";
import { validateEmail, normalizeEmail } from "@/utils/disposable-email";

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
function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill email if navigated from /verify-email → "Use a different email"
  const prefillEmail = searchParams.get("email") ?? "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailErrorIsConflict, setEmailErrorIsConflict] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear inline error when user edits the email field
  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) {
      setEmailError("");
      setEmailErrorIsConflict(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // ── Client-side email validation ────────────────────────────────────────
    const validation = validateEmail(email);
    if (!validation.valid) {
      setEmailError(validation.error);
      return;
    }

    const normalizedEmail = validation.email; // already trimmed + lowercased

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    console.log("[Auth] signup_attempt:", normalizedEmail.split("@")[1]);

    try {
      const result = await authService.signUp({
        email: normalizedEmail,
        password,
        fullName,
      });

      // Supabase returns session immediately only when "Confirm email" is OFF.
      // When email confirmation is ON, session is null — route to verify page.
      if (result.session) {
        toast.success("Account created successfully.");
        router.refresh();
        router.push("/dashboard");
        return;
      }

      // Email confirmation required — navigate to verify page.
      console.log("[Auth] verification_sent:", normalizedEmail.split("@")[1]);
      router.push(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      const isAlreadyRegistered =
        raw.toLowerCase().includes("already") ||
        raw.toLowerCase().includes("exists") ||
        raw.toLowerCase().includes("registered");

      if (isAlreadyRegistered) {
        // Surface as an inline email-field error with a Sign in shortcut.
        setEmailError("An account already exists for this email.");
        setEmailErrorIsConflict(true);
      } else {
        toast.error(raw || "Failed to create account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
          Create your account
        </h1>
        <p className="text-muted-foreground">
          Start your AI interview preparation journey
        </p>
      </div>

      <div className="space-y-6">
        <form className="space-y-4" onSubmit={handleSubmit}>

          {/* Full name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Alex Johnson"
              className="h-12"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              required
              className={`h-12 ${emailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              disabled={isSubmitting}
              autoComplete="email"
            />
            {/* Inline email error — not a toast */}
            {emailError && (
              <p className="text-xs text-destructive flex items-center gap-1 flex-wrap">
                {emailError}
                {emailErrorIsConflict && (
                  <Link
                    href="/login"
                    className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                  >
                    Sign in instead →
                  </Link>
                )}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              className="h-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
            />
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              className="h-12"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-medium"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Creating account…" : "Create Account"}
          </Button>
        </form>
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

/**
 * Page export — wraps SignupForm in Suspense so Next.js can statically
 * prerender the shell while deferring the useSearchParams() read to the client.
 */
export default function SignupPage() {
  return (
    <Suspense fallback={<div className="w-full animate-pulse" aria-label="Loading..." />}>
      <SignupForm />
    </Suspense>
  );
}