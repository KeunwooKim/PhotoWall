"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/api-fetch";
import type { FeatureFlag } from "@/lib/feature-flags";

export default function AdminOperationsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [orphanScan, setOrphanScan] = useState<{
    totalFiles: number;
    referenced: number;
    orphanCount: number;
  } | null>(null);
  const [orphanBusy, setOrphanBusy] = useState(false);
  const [pendingGc, setPendingGc] = useState<{ total: number; due: number } | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/feature-flags");
      if (!res.ok) throw new Error();
      setFlags((await res.json()) as FeatureFlag[]);
    } catch {
      setMessage("기능 설정을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    authFetch("/api/admin/storage/pending-delete")
      .then(async (res) => (res.ok ? ((await res.json()) as { total: number; due: number }) : null))
      .then((data) => {
        if (data) setPendingGc(data);
      })
      .catch(() => {});
  }, [load]);

  const refreshPendingGc = async () => {
    setPendingBusy(true);
    try {
      const res = await authFetch("/api/admin/storage/pending-delete");
      const data = (await res.json()) as { total?: number; due?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "조회 실패");
      setPendingGc({ total: data.total ?? 0, due: data.due ?? 0 });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "조회 실패");
    } finally {
      setPendingBusy(false);
    }
  };

  const processPendingGc = async () => {
    setPendingBusy(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/storage/pending-delete", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        deleted?: number;
        skipped?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "처리 실패");
      setMessage(`유예 삭제: ${data.deleted ?? 0}개 삭제 · ${data.skipped ?? 0}개 스킵`);
      await refreshPendingGc();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "처리 실패");
    } finally {
      setPendingBusy(false);
    }
  };

  const toggle = async (flag: FeatureFlag) => {
    setSavingKey(flag.key);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: flag.key, enabled: !flag.enabled }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as FeatureFlag;
      setFlags((prev) => prev.map((f) => (f.key === updated.key ? updated : f)));
      setMessage(`${updated.label} ${updated.enabled ? "켰어요" : "껐어요"}`);
    } catch {
      setMessage("변경에 실패했어요");
    } finally {
      setSavingKey(null);
    }
  };

  const scanOrphans = async () => {
    setOrphanBusy(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/storage/orphans");
      const data = (await res.json()) as {
        error?: string;
        totalFiles?: number;
        referenced?: number;
        orphanCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "스캔 실패");
      setOrphanScan({
        totalFiles: data.totalFiles ?? 0,
        referenced: data.referenced ?? 0,
        orphanCount: data.orphanCount ?? 0,
      });
      setMessage(`고아 파일 ${data.orphanCount ?? 0}개 (7일 이상)`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "스캔 실패");
    } finally {
      setOrphanBusy(false);
    }
  };

  const purgeOrphans = async () => {
    if (!confirm("참조되지 않는 Storage 파일을 삭제할까요? (최대 500개)")) return;
    setOrphanBusy(true);
    try {
      const res = await authFetch("/api/admin/storage/orphans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "PURGE", limit: 500 }),
      });
      const data = (await res.json()) as { error?: string; removed?: number };
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      setMessage(`${data.removed ?? 0}개 삭제했어요`);
      setOrphanScan(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setOrphanBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">기능 설정</h2>
        <p className="mt-1 text-sm text-muted">
          장애·점검 시 기능을 일시 중단할 수 있어요. 꺼두면 API와 UI에서 해당 기능이 차단됩니다.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">불러오는 중...</p>
      ) : (
        <ul className="space-y-3">
          {flags.map((flag) => (
            <li
              key={flag.key}
              className="flex items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-surface p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{flag.label}</p>
                <p className="mt-0.5 text-xs text-muted">{flag.description}</p>
                <p className="mt-1 font-mono text-[10px] text-muted">{flag.key}</p>
              </div>
              <button
                type="button"
                disabled={savingKey === flag.key}
                onClick={() => void toggle(flag)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  flag.enabled
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    : "bg-foreground/10 text-muted hover:bg-foreground/15"
                } disabled:opacity-50`}
                aria-pressed={flag.enabled}
              >
                {savingKey === flag.key ? "..." : flag.enabled ? "ON" : "OFF"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3 rounded-2xl border border-foreground/10 bg-surface p-4">
        <div>
          <h3 className="text-sm font-semibold">저장 후 유예 삭제 (24h)</h3>
          <p className="mt-1 text-xs text-muted">
            벽 저장 시 빠진 사진 경로를 큐에 넣고, 24시간 뒤 아무 벽에도 없으면 Storage에서
            삭제합니다. cron: GET /api/cron/storage-pending-delete
          </p>
        </div>
        {pendingGc ? (
          <p className="text-sm">
            대기 <strong>{pendingGc.total.toLocaleString()}</strong> · 삭제 도래{" "}
            <strong>{pendingGc.due.toLocaleString()}</strong>
          </p>
        ) : (
          <p className="text-xs text-muted">
            storage-pending-delete-migration.sql 실행 후 표시됩니다
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pendingBusy}
            onClick={() => void refreshPendingGc()}
            className="rounded-full bg-foreground/5 px-4 py-2 text-xs font-medium disabled:opacity-50"
          >
            새로고침
          </button>
          <button
            type="button"
            disabled={pendingBusy || !pendingGc || pendingGc.due === 0}
            onClick={() => void processPendingGc()}
            className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:opacity-50"
          >
            도래분 지금 처리
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-foreground/10 bg-surface p-4">
        <div>
          <h3 className="text-sm font-semibold">Storage 고아 파일</h3>
          <p className="mt-1 text-xs text-muted">
            벽에서 참조하지 않는 wall-photos (7일 이상). cron: GET /api/cron/storage-orphans
          </p>
        </div>
        {orphanScan ? (
          <p className="text-sm">
            전체 {orphanScan.totalFiles.toLocaleString()} · 참조{" "}
            {orphanScan.referenced.toLocaleString()} · 고아{" "}
            <strong>{orphanScan.orphanCount.toLocaleString()}</strong>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={orphanBusy}
            onClick={() => void scanOrphans()}
            className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:opacity-50"
          >
            {orphanBusy ? "작업 중…" : "스캔"}
          </button>
          <button
            type="button"
            disabled={orphanBusy || !orphanScan || orphanScan.orphanCount === 0}
            onClick={() => void purgeOrphans()}
            className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 disabled:opacity-50"
          >
            삭제 (PURGE)
          </button>
        </div>
      </section>
    </div>
  );
}
