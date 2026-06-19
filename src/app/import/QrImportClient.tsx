"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";
import { savePendingImports } from "@/lib/booth-import/import-session";
import type { BoothImportFailure, BoothImportResult } from "@/lib/booth-import/types";
import { authFetch } from "@/lib/auth/api-fetch";

type ImportState = "idle" | "scanning" | "loading" | "error";

export default function QrImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledUrlRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  const lastScanRef = useRef<string | null>(null);
  const [state, setState] = useState<ImportState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");

  const importFromUrl = useCallback(
    async (rawUrl: string) => {
      const cleaned = rawUrl.trim();
      if (!cleaned || processingRef.current) return;
      if (lastScanRef.current === cleaned) return;

      processingRef.current = true;
      lastScanRef.current = cleaned;
      setState("loading");
      setErrorMessage(null);

      try {
        const res = await authFetch("/api/import/booth-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: cleaned }),
        });

        if (res.status === 401) {
          setState("error");
          setErrorMessage("QR 네컷 가져오기는 로그인 후 이용할 수 있어요");
          processingRef.current = false;
          lastScanRef.current = null;
          return;
        }

        const data = (await res.json()) as BoothImportResult | BoothImportFailure;

        if (!data.ok) {
          setState("error");
          setErrorMessage(data.message);
          processingRef.current = false;
          lastScanRef.current = null;
          return;
        }

        savePendingImports(data.images);
        router.replace("/wall/edit");
      } catch {
        setState("error");
        setErrorMessage("사진을 불러오지 못했어요. 잠시 후 다시 시도해 주세요");
        processingRef.current = false;
        lastScanRef.current = null;
      }
    },
    [router],
  );

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // scanner already stopped
    }
  }, []);

  const startScanner = useCallback(async () => {
    await stopScanner();
    processingRef.current = false;
    lastScanRef.current = null;
    setState("scanning");
    setErrorMessage(null);

    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (processingRef.current) return;
          void stopScanner().then(() => importFromUrl(decodedText));
        },
        () => {},
      );
    } catch {
      setState("error");
      setErrorMessage(
        "카메라를 사용할 수 없어요. 브라우저에서 카메라 권한을 허용하거나 링크를 직접 붙여 넣어 주세요",
      );
    }
  }, [importFromUrl, stopScanner]);

  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (!urlParam || handledUrlRef.current === urlParam) return;
    handledUrlRef.current = urlParam;
    void importFromUrl(urlParam);
  }, [searchParams, importFromUrl]);

  useEffect(() => {
    if (searchParams.get("url")) return;

    void startScanner();
    return () => {
      void stopScanner();
    };
  }, [searchParams, startScanner, stopScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = manualUrl.trim();
    if (!url) return;
    void stopScanner().then(() => importFromUrl(url));
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header
        className="flex items-center justify-between border-b border-foreground/8 px-4 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link
          href="/wall/edit"
          className="rounded-full bg-surface px-3 py-2 text-xs font-medium ring-1 ring-foreground/10"
        >
          ← 벽으로
        </Link>
        <h1 className="text-sm font-semibold">QR 네컷 가져오기</h1>
        <span className="w-14" aria-hidden="true" />
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-5">
        <section className="space-y-2 text-center">
          <p className="text-sm font-medium">인생네컷 QR을 스캔하세요</p>
          <p className="text-xs leading-relaxed text-muted">
            출력된 사진의 QR 코드를 비추면 자동으로 벽에 붙여요.
            <br />
            QR은 촬영 후 약 3일간 유효해요.
          </p>
        </section>

        <div className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-black/5">
          <div id="qr-reader" className="min-h-[280px] w-full" />
          {state === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <p className="text-sm font-medium">사진 불러오는 중...</p>
            </div>
          )}
        </div>

        {state === "error" && errorMessage && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
            {errorMessage}
          </div>
        )}

        {state === "error" && (
          <button
            type="button"
            onClick={() => void startScanner()}
            className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background"
          >
            QR 다시 스캔
          </button>
        )}

        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">링크 직접 입력</h2>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="QR 링크 붙여넣기"
              className="min-w-0 flex-1 rounded-xl border border-foreground/10 bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/25"
            />
            <button
              type="submit"
              disabled={!manualUrl.trim() || state === "loading"}
              className="shrink-0 rounded-xl bg-foreground px-4 py-2.5 text-xs font-medium text-background disabled:opacity-50"
            >
              가져오기
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
