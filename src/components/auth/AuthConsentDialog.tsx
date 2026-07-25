"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { writeLegalConsent } from "@/lib/legal/meta";

interface AuthConsentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function AuthConsentDialog({ open, onClose, onConfirm }: AuthConsentDialogProps) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [age14, setAge14] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTerms(false);
    setPrivacy(false);
    setAge14(false);
  }, [open]);

  if (!open) return null;

  const allChecked = terms && privacy && age14;

  const handleConfirm = () => {
    if (!allChecked) return;
    writeLegalConsent();
    onConfirm();
  };

  const agreeAll = (checked: boolean) => {
    setTerms(checked);
    setPrivacy(checked);
    setAge14(checked);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-consent-title"
        className="relative z-10 w-full max-w-md rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <h2 id="auth-consent-title" className="text-lg font-bold tracking-tight">
          약관 동의
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          PhotoWall 회원가입 및 서비스 이용을 위해 아래 항목에 모두 동의해 주세요.
          동의하지 않으면 로그인할 수 없어요.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-foreground/[0.04] px-3 py-3">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => agreeAll(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-foreground"
            />
            <span className="text-sm font-semibold">전체 동의</span>
          </label>

          <ConsentRow checked={age14} onChange={setAge14}>
            <span>
              <span className="text-rose-600">[필수]</span> 만 14세 이상입니다
            </span>
          </ConsentRow>

          <ConsentRow checked={terms} onChange={setTerms}>
            <span>
              <span className="text-rose-600">[필수]</span>{" "}
              <Link
                href="/legal/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                이용약관
              </Link>
              에 동의합니다
            </span>
          </ConsentRow>

          <ConsentRow checked={privacy} onChange={setPrivacy}>
            <span>
              <span className="text-rose-600">[필수]</span>{" "}
              <Link
                href="/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                개인정보처리방침
              </Link>
              (개인정보 수집·이용)에 동의합니다
            </span>
          </ConsentRow>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-foreground/[0.06] py-3 text-sm font-medium"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!allChecked}
            onClick={handleConfirm}
            className="flex-[1.4] rounded-xl bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-40"
          >
            동의하고 가입하기
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsentRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 px-1 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-foreground"
      />
      <span className="text-sm leading-snug text-foreground">{children}</span>
    </label>
  );
}
