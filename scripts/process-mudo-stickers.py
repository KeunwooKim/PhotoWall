#!/usr/bin/env python3
"""Extract 무한도전 sticker ZIPs into category folders and generate catalog TS.

After extraction, run `node scripts/trim-mudo-stickers.mjs` to crop transparent
padding and write aspect-aware defaultWidth/defaultHeight into the catalog.
"""

from __future__ import annotations

import re
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MUDO_DIR = ROOT / "public" / "stickers" / "mudo"
OUT_TS = ROOT / "src" / "lib" / "stickers" / "mudo-catalog.generated.ts"
ZIP_ARCHIVE = ROOT / "stickers-src" / "mudo-zips"

# zip filename (exact) → (categoryId, categoryLabel)
ZIP_TO_CATEGORY: dict[str, tuple[str, str]] = {
    "인스타 스토리 스티커_21 무한도전_by candydrop.Zip": ("classic", "기본"),
    "인스타 스토리 스티커_23 무한도전_by candydrop.Zip": ("classic", "기본"),
    "인스타 스토리 무한도전 자막 스티커_25 시험_by candydrop.Zip": ("exam", "시험"),
    "인스타 스토리 스티커_26 무한도전 자막_by candydrop.Zip": ("daily", "일상"),
    "인스타 스토리 스티커 33 무한도전 자막 11탄 일상_by candydrop.zip": ("daily", "일상"),
    "인스타 스토리 스티커_27 무한도전 자막 5탄_여행_by candydrop.Zip": ("travel", "여행"),
    "인스타 스토리 스티커_28 무한도전 자막 6탄_말풍선_by candydrop.Zip": ("bubble", "말풍선"),
    "인스타 스토리 스티커 41 무한도전 자막 16탄 말풍선2_by candydrop.Zip": ("bubble", "말풍선"),
    "인스타 스토리 스티커 29 무한도전 자막 7탄 음식1_by candydrop.Zip": ("food", "음식"),
    "인스타 스토리 스티커 30 무한도전 자막 8탄 음식2_by candydrop.Zip": ("food", "음식"),
    "인스타 스토리 스티커 31 무한도전 자막 9탄 계절 날씨_by candydrop.zip": ("weather", "계절·날씨"),
    "인스타 스토리 스티커 32 무한도전 자막 10탄 직장 회사_by candydrop.Zip": ("work", "직장"),
    "인스타 스토리 스티커 34 무한도전 자막 12탄 생일 축하_by candydrop.Zip": ("birthday", "생일"),
    "인스타 스토리 스티커 35 무한도전 자막 13탄 쇼핑 돈_by candydrop.Zip": ("money", "쇼핑·돈"),
    "인스타 스토리 스티커 36 무한도전 자막 번외편_by candydrop.Zip": ("extra", "번외"),
    "인스타 스토리 스티커 37 무한도전 자막 14탄 사랑 고백_by candydrop.Zip": ("love", "사랑"),
    "인스타 스토리 스티커 39 무한도전 자막 15탄 친구 우정_by candydrop.Zip": ("friends", "친구"),
    "인스타 스토리 스티커 42 무한도전 자막 17탄 여름휴가  바캉스_by candydrop.Zip": ("vacation", "휴가"),
}

CATEGORY_ORDER = [
    "classic",
    "bubble",
    "daily",
    "exam",
    "food",
    "weather",
    "work",
    "travel",
    "vacation",
    "birthday",
    "money",
    "love",
    "friends",
    "extra",
]


def clean_label(filename: str) -> str:
    stem = Path(filename).stem
    # "간단_인스타 스토리 ..."
    if "_인스타" in stem:
        stem = stem.split("_인스타", 1)[0]
    # "인스타 ... 무한도전_간단" / "... 자막_가만안놔둔다진짜"
    elif "무한도전" in stem or "스티커" in stem:
        left, _, right = stem.rpartition("_")
        if right and len(right) <= 48:
            stem = right
    stem = re.sub(r"\s*copy$", "", stem, flags=re.I)
    stem = stem.strip(" ._")
    return stem or "sticker"


def safe_filename(label: str, index: int, used: set[str]) -> tuple[str, str]:
    """Return (disk_filename, display_name). Disk names are ASCII-safe."""
    display = re.sub(r"\s+", " ", label).strip() or f"sticker-{index}"
    slug = slugify(display)
    name = f"{index:03d}-{slug}"
    base = name
    n = 2
    while name.lower() in used:
        name = f"{base}-{n}"
        n += 1
    used.add(name.lower())
    return f"{name}.png", display


def slugify(label: str) -> str:
    # Keep hangul; strip punctuation for stable ids/paths
    s = re.sub(r"[^\w가-힣+-]+", "-", label, flags=re.UNICODE)
    s = re.sub(r"-+", "-", s).strip("-")
    return (s[:48] or "item").lower()


def ts_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def main() -> None:
    MUDO_DIR.mkdir(parents=True, exist_ok=True)
    ZIP_ARCHIVE.mkdir(parents=True, exist_ok=True)

    by_category: dict[str, list[dict]] = defaultdict(list)
    category_labels: dict[str, str] = {}
    # Prefer archived zips if public was already cleaned
    zip_sources = sorted(
        [
            *(p for p in MUDO_DIR.iterdir() if p.is_file() and p.suffix.lower() == ".zip"),
            *(p for p in ZIP_ARCHIVE.iterdir() if p.is_file() and p.suffix.lower() == ".zip"),
        ],
        key=lambda p: p.name,
    )
    # de-dupe by name (prefer archive if both — iterate reversed so archive wins when both exist)
    seen_names: set[str] = set()
    zips: list[Path] = []
    for p in reversed(zip_sources):
        if p.name in seen_names:
            continue
        seen_names.add(p.name)
        zips.append(p)
    zips.reverse()

    if not zips:
        raise SystemExit("No mudo ZIP files found")

    # Clear previous extracted category dirs (keep structure clean)
    for child in list(MUDO_DIR.iterdir()):
        if child.is_dir() and not child.name.startswith("."):
            for f in child.glob("*.png"):
                f.unlink()
            try:
                child.rmdir()
            except OSError:
                pass

    for zip_path in zips:
        mapping = ZIP_TO_CATEGORY.get(zip_path.name)
        if not mapping:
            print(f"SKIP unmapped zip: {zip_path.name}")
            continue
        cat_id, cat_label = mapping
        category_labels[cat_id] = cat_label
        dest_dir = MUDO_DIR / cat_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        used_names: set[str] = {p.stem.lower() for p in dest_dir.glob("*.png")}
        next_index = len(list(dest_dir.glob("*.png"))) + 1

        with zipfile.ZipFile(zip_path) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                name = info.filename
                if "__MACOSX" in name or name.endswith(".DS_Store"):
                    continue
                if not name.lower().endswith(".png"):
                    continue

                label = clean_label(Path(name).name)
                out_name, display = safe_filename(label, next_index, used_names)
                next_index += 1
                out_path = dest_dir / out_name
                out_path.write_bytes(zf.read(info))

                sticker_id = f"mudo.{cat_id}.{Path(out_name).stem}"
                by_category[cat_id].append(
                    {
                        "id": sticker_id,
                        "name": display,
                        "src": f"mudo/{cat_id}/{out_name}",
                    }
                )

        # Move zip out of public so it isn't web-served
        target = ZIP_ARCHIVE / zip_path.name
        if zip_path.parent == MUDO_DIR:
            if target.exists():
                zip_path.unlink()
            else:
                zip_path.rename(target)
        print(f"OK {cat_id}: {zip_path.name}")

    # Also remove leftover .DS_Store in mudo
    ds = MUDO_DIR / ".DS_Store"
    if ds.exists():
        ds.unlink()

    lines: list[str] = [
        "/* Auto-generated by scripts/process-mudo-stickers.py — do not edit by hand. */",
        'import type { StickerCategory } from "./types";',
        "",
        "function image(path: string): string {",
        '  return `/stickers/${path}`;',
        "}",
        "",
        "export const MUDO_CATEGORIES: StickerCategory[] = [",
    ]

    total = 0
    for cat_id in CATEGORY_ORDER:
        stickers = by_category.get(cat_id, [])
        if not stickers:
            continue
        label = category_labels.get(cat_id, cat_id)
        lines.append("  {")
        lines.append(f'    id: "{cat_id}",')
        lines.append(f'    name: "{ts_escape(label)}",')
        lines.append("    stickers: [")
        for s in stickers:
            total += 1
            lines.append(
                "      {"
                f' id: "{s["id"]}",'
                f' name: "{ts_escape(s["name"])}",'
                f' kind: "image",'
                f' src: image("{ts_escape(s["src"])}"),'
                " defaultSize: 120 "
                "},"
            )
        lines.append("    ],")
        lines.append("  },")

    lines.append("];")
    lines.append("")
    lines.append(f"// {total} stickers across {len([c for c in CATEGORY_ORDER if by_category.get(c)])} categories")
    lines.append("")

    OUT_TS.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_TS.relative_to(ROOT)} ({total} stickers)")


if __name__ == "__main__":
    main()
