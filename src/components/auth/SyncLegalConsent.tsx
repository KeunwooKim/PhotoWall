"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import { LEGAL_VERSION, readLegalConsent } from "@/lib/legal/meta";

/**
 * After Google OAuth, persist the local consent timestamp to profiles.
 * Runs once per user session when local consent exists.
 */
export default function SyncLegalConsent() {
  const { user, isLoading } = useAuth();
  const syncedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !user) return;
    if (syncedForUser.current === user.id) return;

    const local = readLegalConsent();
    if (!local || local.version !== LEGAL_VERSION) return;

    syncedForUser.current = user.id;

    void authFetch("/api/legal/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consentedAt: local.consentedAt,
        version: local.version,
      }),
    })
      .then((res) => {
        if (!res.ok) syncedForUser.current = null;
      })
      .catch(() => {
        // Allow retry on next mount if network fails
        syncedForUser.current = null;
      });
  }, [user, isLoading]);

  return null;
}
