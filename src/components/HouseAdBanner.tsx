"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HouseBannerPlacement, PublicHouseBanner } from "@/types/house-banner";
import { HOUSE_BANNER_ASPECT_RATIO } from "@/types/house-banner";
import type { UserPlan } from "@/lib/wall-quotas";

const DISMISS_KEY = "photowall_dismissed_house_banners";

function getDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function dismissId(id: string) {
  const dismissed = getDismissedIds();
  dismissed.add(id);
  sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]));
}

interface HouseAdBannerProps {
  placement: HouseBannerPlacement;
  plan?: UserPlan | null;
}

export default function HouseAdBanner({ placement, plan = null }: HouseAdBannerProps) {
  const [items, setItems] = useState<PublicHouseBanner[]>([]);

  useEffect(() => {
    if (plan === "premium") {
      setItems([]);
      return;
    }

    fetch(`/api/banners?placement=${placement}&plan=free`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PublicHouseBanner[]) => {
        const dismissed = getDismissedIds();
        setItems(data.filter((item) => !dismissed.has(item.id)));
      })
      .catch(() => {});
  }, [placement, plan]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const image = (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title || "광고"}
            className="h-full w-full object-cover"
            width={2000}
            height={360}
          />
        );

        return (
          <div
            key={item.id}
            className="relative overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.04]"
            style={{ aspectRatio: HOUSE_BANNER_ASPECT_RATIO }}
            role="complementary"
            aria-label={item.title || "광고"}
          >
            <button
              type="button"
              onClick={() => {
                dismissId(item.id);
                setItems((prev) => prev.filter((a) => a.id !== item.id));
              }}
              className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-xs text-white hover:bg-black/60"
              aria-label="닫기"
            >
              ✕
            </button>
            {item.href ? (
              <Link href={item.href} className="block h-full w-full">
                {image}
              </Link>
            ) : (
              image
            )}
          </div>
        );
      })}
    </div>
  );
}
