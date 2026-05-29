"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the first onAuthStateChange event fires. Never use routing logic while this is true. */
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    /**
     * The canonical Supabase SSR pattern:
     *
     * onAuthStateChange is the single source of truth for auth state.
     * It fires synchronously with INITIAL_SESSION on mount (reading from
     * the cookie/localStorage that createBrowserClient manages), and then
     * for every subsequent auth event (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED).
     *
     * We do NOT call getSession() separately — that creates a second
     * competing source of truth and a state race.
     *
     * We do NOT do any routing here. Routing is the middleware's job.
     * The AuthProvider's only job is to keep the UI state in sync.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      // isLoading becomes false after the first event fires.
      // This is the correct signal that the client knows the auth state.
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * signOut:
   * 1. Call supabase.auth.signOut() — clears the session from cookies AND localStorage.
   * 2. Clear local state immediately so the UI reacts without waiting for onAuthStateChange.
   * 3. Navigate to "/" (landing page) — a public route the middleware won't intercept.
   *    We push to "/" first so the middleware sees a public route on refresh and does
   *    NOT redirect to /login.
   */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isLoading,
      isAuthenticated: Boolean(session),
      signOut,
    }),
    [isLoading, session, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider.");
  }

  return context;
}