#!/usr/bin/env python3
"""Remove baked checkerboard / white backgrounds from sticker PNGs."""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow required: pip install pillow", file=sys.stderr)
    sys.exit(1)


def _color_close(a: tuple[int, int, int], b: tuple[int, int, int], tol: int) -> bool:
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol and abs(a[2] - b[2]) <= tol


def _is_background_rgb(rgb: tuple[int, int, int], tol: int) -> bool:
    r, g, b = rgb
    # Pure / near white
    if r >= 250 - tol and g >= 250 - tol and b >= 250 - tol:
        return True
    # Neutral light gray (checkerboard squares)
    if abs(r - g) <= 10 and abs(g - b) <= 10 and r >= 185 - tol and r <= 252:
        return True
    return False


def remove_background(img: Image.Image, tolerance: int = 42) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()

    seeds: list[tuple[int, int]] = []
    for x in range(w):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(h):
        seeds.append((0, y))
        seeds.append((w - 1, y))

    visited = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()

    for x, y in seeds:
        idx = y * w + x
        if visited[idx]:
            continue
        rgb = pixels[x, y][:3]
        if _is_background_rgb(rgb, tolerance):
            visited[idx] = 1
            queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        rgb = pixels[x, y][:3]
        pixels[x, y] = (rgb[0], rgb[1], rgb[2], 0)

        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            idx = ny * w + nx
            if visited[idx]:
                continue
            nrgb = pixels[nx, ny][:3]
            # Only walk through explicit background tones — never bleed into sticker pixels.
            if _is_background_rgb(nrgb, tolerance):
                visited[idx] = 1
                queue.append((nx, ny))

    return rgba


def process_file(src: Path, dst: Path, tolerance: int = 42) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as img:
        out = remove_background(img, tolerance=tolerance)
        out.save(dst, format="PNG", optimize=True)
    print(f"OK {dst} ({dst.stat().st_size // 1024}KB)")


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: process-sticker-transparency.py <src> <dst> [tolerance]")
        sys.exit(1)

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    tol = int(sys.argv[3]) if len(sys.argv) > 3 else 42
    process_file(src, dst, tolerance=tol)


if __name__ == "__main__":
    main()
