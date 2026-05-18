import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export type AuthCredentials = {
  email: string;
  password: string;
};

export type SignUpPayload = AuthCredentials & {
  fullName?: string;
};

export type AuthResult = {
  user: User | null;
  session: Session | null;
};

export const authService = {
  async signIn({ email, password }: AuthCredentials): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return {
      user: data.user ?? null,
      session: data.session ?? null,
    };
  },

  async signUp({ email, password, fullName }: SignUpPayload): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
      },
    });

    if (error) {
      throw error;
    }

    return {
      user: data.user ?? null,
      session: data.session ?? null,
    };
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },

  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;
  },
  
};