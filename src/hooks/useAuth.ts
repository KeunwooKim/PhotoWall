"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    let resolved = false;

    // onAuthStateChange fires with INITIAL_SESSION first — use that as the
    // primary signal and treat getUser() as a fallback with a hard timeout so
    // slow network / stale refresh tokens don't block the UI forever.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      resolved = true;
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Fallback: if onAuthStateChange hasn't fired within 3 s, unblock the UI.
    const timer = setTimeout(() => {
      if (!resolved) {
        setIsLoading(false);
      }
    }, 3000);

    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (!resolved) {
        resolved = true;
        setUser(currentUser);
        setIsLoading(false);
      }
    }).catch(() => {
      if (!resolved) {
        resolved = true;
        setIsLoading(false);
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return {
    user,
    isLoading,
    isConfigured: isSupabaseConfigured(),
    signInWithGoogle,
    signOut,
  };
}
