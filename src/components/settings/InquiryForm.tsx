"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth/api-fetch";
import type { InquiryCategory } from "@/types/inquiry";

const CATEGORIES: { value: InquiryCategory; label: string }[] = [
  { value: "general", label: "일반 문의" },
  { value: "bug", label: "버그 제보" },
  { value: "feature", label: "기능 제안" },
  { value: "business", label: "제휴·비즈니스" },
];

interface InquiryFormProps {
  onSuccess?: () => void;
}

export default function InquiryForm({ onSuccess }: InquiryFormProps) {
  const [category, setCategory] = useState<InquiryCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const res = await authFetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, body }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "failed");
      }

      setSubject("");
      setBody("");
      setMessage("문의를 보냈어요. 빠르게 확인할게요!");
      onSuccess?.();
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "문의 전송에 실패했어요");
      setTimeout(() => setMessage(null), 2500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as InquiryCategory)}
        className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2.5 text-sm outline-none focus:border-accent-dark"
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="제목"
        maxLength={200}
        required
        className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2.5 text-sm outline-none focus:border-accent-dark"
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="내용을 적어 주세요"
        rows={4}
        maxLength={5000}
        required
        className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2.5 text-sm outline-none focus:border-accent-dark"
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-foreground py-3 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? "보내는 중..." : "문의 보내기"}
      </button>

      {message && <p className="text-center text-xs text-muted">{message}</p>}
    </form>
  );
}
