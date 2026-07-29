"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import AuthConsentDialog from "@/components/auth/AuthConsentDialog";
import {
  LEGAL_VERSION,
  hasValidLegalConsent,
  readLegalConsent,
  writeLegalConsent,
} from "@/lib/legal/meta";

/**
 * After Google OAuth:
 * - If local consent exists → sync to profiles
 * - If neither local nor server consent → show blocking consent dialog
 */
export default function SyncLegalConsent() {
  const { user, isLoading, signOut } = useAuth();
  const syncedForUser = useRef<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [checking, setChecking] = useState(false);

  const persistConsent = useCallback(async () => {
    if (!user) return false;
    const local = readLegalConsent() ?? writeLegalConsent();
    const res = await authFetch("/api/legal/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consentedAt: local.consentedAt,
        version: local.version,
      }),
    });
    return res.ok;
  }, [user]);

  useEffect(() => {
    if (isLoading || !user) {
      setNeedsConsent(false);
      return;
    }
    if (syncedForUser.current === user.id) return;

    let cancelled = false;

    const run = async () => {
      setChecking(true);

      // Already consented on this device — sync up and done
      if (hasValidLegalConsent()) {
        syncedForUser.current = user.id;
        const ok = await persistConsent();
        if (!ok) syncedForUser.current = null;
        if (!cancelled) {
          setNeedsConsent(false);
          setChecking(false);
        }
        return;
      }

      // Check server profile for consent from another device / prior session
      try {
        const res = await authFetch("/api/legal/consent", { method: "GET" });
        if (cancelled) return;

        if (res.ok) {
          const data = (await res.json()) as {
            ok?: boolean;
            legalVersion?: string | null;
            legalConsentedAt?: string | null;
          };
          if (data.ok && data.legalVersion === LEGAL_VERSION && data.legalConsentedAt) {
            writeLegalConsent();
            syncedForUser.current = user.id;
            setNeedsConsent(false);
            setChecking(false);
            return;
          }
        }
      } catch {
        // Fall through to show consent if status unknown
      }

      if (!cancelled) {
        setNeedsConsent(true);
        setChecking(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user, isLoading, persistConsent]);

  const handleConfirm = async () => {
    writeLegalConsent();
    const ok = await persistConsent();
    if (ok && user) {
      syncedForUser.current = user.id;
      setNeedsConsent(false);
    }
  };

  const handleClose = async () => {
    setNeedsConsent(false);
    await signOut();
  };

  if (!user || checking) return null;

  return (
    <AuthConsentDialog
      open={needsConsent}
      variant="postLogin"
      onClose={() => {
        void handleClose();
      }}
      onConfirm={() => {
        void handleConfirm();
      }}
    />
  );
}
