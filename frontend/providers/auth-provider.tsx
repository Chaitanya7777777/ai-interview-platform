"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";

import { authService } from "@/services/auth.service";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Register auth state change listener first so we react to immediate updates
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      // mark hydration complete when we receive an auth state event
      setIsLoading(false);
    });

    async function loadSession() {
      try {
        const currentSession = await authService.getSession();

        if (!isMounted) return;

        // Populate state from getSession if listener didn't already
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user ?? null);
        }
      } finally {
        // ensure we clear the loading flag if it hasn't been cleared by the listener
        if (isMounted) setIsLoading(false);
      }
    }

    void loadSession();

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (pathname === "/login" || pathname === "/signup") {
      router.replace("/dashboard");
    }
  }, [pathname, router, user]);

  useEffect(() => {
    // no-op: keep this hook for future side-effects if needed
  }, [user]);

  const signOut = useCallback(async () => {
    // Call service to sign out; ensure we clear client state and redirect.
    try {
      await authService.signOut();
    } finally {
      // always clear local client state and redirect to login
      setSession(null);
      setUser(null);
      router.replace("/login");
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      signOut,
    }),
    [isLoading, session, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider.");
  }

  return context;
}