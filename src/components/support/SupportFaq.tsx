"use client";

import { useState } from "react";
import Link from "next/link";
import { SUPPORT_FAQ } from "@/lib/support/faq";

interface SupportFaqProps {
  onAskInquiry?: () => void;
}

export default function SupportFaq({ onAskInquiry }: SupportFaqProps) {
  const [openId, setOpenId] = useState<string | null>(SUPPORT_FAQ[0]?.id ?? null);

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
        {SUPPORT_FAQ.map((item) => {
          const open = openId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : item.id)}
                className="flex w-full items-start justify-between gap-3 py-4 text-left"
              >
                <span className="text-sm font-semibold text-foreground">{item.question}</span>
                <span
                  className={`mt-0.5 shrink-0 text-muted transition ${open ? "rotate-45" : ""}`}
                  aria-hidden
                >
                  +
                </span>
              </button>
              {open && (
                <div className="space-y-3 pb-4 pr-8">
                  <p className="text-sm leading-relaxed text-muted">{item.answer}</p>
                  {item.links && item.links.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {item.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="text-sm font-medium text-foreground underline underline-offset-2"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {onAskInquiry && (
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted">원하는 답이 없나요?</p>
          <button
            type="button"
            onClick={onAskInquiry}
            className="text-sm font-semibold text-foreground underline underline-offset-2"
          >
            문의하기
          </button>
        </div>
      )}
    </div>
  );
}
