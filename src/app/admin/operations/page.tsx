"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/api-fetch";
import type { FeatureFlag } from "@/lib/feature-flags";

export default function AdminOperationsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
  }, [load]);

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
    </div>
  );
}
