"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/api-fetch";
import { useAuth } from "@/hooks/useAuth";
import {
  clearUgcLibrary,
  getUgcLibraryRevision,
  registerUgcLibrary,
} from "@/lib/stickers";
import type { StickerPackItemRow, StickerPackRow } from "@/lib/stickers/ugc-types";

type LibraryPackPayload = {
  pack: StickerPackRow;
  items: StickerPackItemRow[];
};

export function useUgcStickerLibrary() {
  const { user, isLoading: authLoading } = useAuth();
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      clearUgcLibrary();
      setRevision(getUgcLibraryRevision());
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/sticker-packs/library");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "라이브러리를 불러오지 못했어요");
      }
      const data = (await res.json()) as { packs: LibraryPackPayload[] };
      registerUgcLibrary(data.packs ?? []);
      setRevision(getUgcLibraryRevision());
    } catch (err) {
      setError(err instanceof Error ? err.message : "라이브러리 오류");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  return { revision, loading, error, refresh };
}
