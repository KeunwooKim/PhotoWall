"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PixiWallEngine } from "@/components/wall/pixi/pixi-wall-engine";
import { PIXI_WALL_MAX_HEIGHT, PIXI_WALL_MAX_WIDTH } from "@/lib/pixi-device";
import type { WallSceneObject, WallScenePhoto } from "@/types/wall-scene-v2";
import { useWallSceneStore } from "@/stores/wall-scene-store";

const SPIKE_WALL_W = Math.min(2800, PIXI_WALL_MAX_WIDTH);
const SPIKE_WALL_H = Math.min(2000, PIXI_WALL_MAX_HEIGHT);

/** Deterministic mock photos for the Pixi spike (canvas data URLs — no external CDN). */
function buildMockPhotos(count: number): WallScenePhoto[] {
  const photos: WallScenePhoto[] = [];
  const cols = 5;
  const cellW = 220;
  const cellH = 280;
  const gap = 40;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const hue = (i * 37) % 360;
      ctx.fillStyle = `hsl(${hue} 55% 70%)`;
      ctx.fillRect(0, 0, 400, 500);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 48px sans-serif";
      ctx.fillText(`#${i + 1}`, 24, 64);
    }
    photos.push({
      id: `spike-photo-${i}`,
      type: "photo",
      x: 120 + col * (cellW + gap),
      y: 120 + row * (cellH + gap),
      rotation: ((i % 5) - 2) * 3,
      scaleX: 1,
      scaleY: 1,
      zIndex: i,
      src: canvas.toDataURL("image/jpeg", 0.85),
      width: cellW,
      height: cellH,
    });
  }
  return photos;
}

function SpikeClient() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PixiWallEngine | null>(null);
  const [status, setStatus] = useState("booting");
  const [selected, setSelected] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const loadDocument = useWallSceneStore((s) => s.loadDocument);
  const setSelectedIds = useWallSceneStore((s) => s.setSelectedIds);
  const objects = useWallSceneStore((s) => s.document.objects);

  useEffect(() => {
    const photos = buildMockPhotos(24);
    loadDocument({
      meta: {
        version: 2,
        wallBounds: { x: 0, y: 0, width: SPIKE_WALL_W, height: SPIKE_WALL_H },
        revision: 1,
      },
      objects: photos as WallSceneObject[],
    });
  }, [loadDocument]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || engineRef.current) return;
    let cancelled = false;

    void (async () => {
      const engine = await PixiWallEngine.create({
        host,
        wallX: 0,
        wallY: 0,
        wallWidth: SPIKE_WALL_W,
        wallHeight: SPIKE_WALL_H,
        readOnly: false,
        onSelect: (id) => {
          setSelected(id);
          setSelectedIds([id]);
        },
        onClearSelection: () => {
          setSelected(null);
          setSelectedIds([]);
        },
        onReady: () => setStatus("ready"),
      });
      if (cancelled) {
        engine.destroy();
        return;
      }
      engineRef.current = engine;
      setStatus(`ready · wall ${SPIKE_WALL_W}×${SPIKE_WALL_H} · LOD textures`);
    })();

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [setSelectedIds]);

  useEffect(() => {
    void engineRef.current?.syncObjects(objects);
  }, [objects]);

  useEffect(() => {
    engineRef.current?.setSelectedIds(selected ? [selected] : []);
  }, [selected]);

  const handleExtract = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      const url = engine.getExportAdapter().toDataURL({ pixelRatio: 0.35, mimeType: "image/png" });
      setPreviewUrl(url);
      setStatus("extract ok");
    } catch (err) {
      setStatus(`extract failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col bg-neutral-900 text-neutral-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 text-sm">
        <strong className="text-base">Pixi wall spike</strong>
        <span className="text-neutral-400">{status}</span>
        <button
          type="button"
          className="rounded bg-sky-600 px-3 py-1 text-xs font-medium"
          onClick={handleExtract}
        >
          Extract preview
        </button>
        <Link href="/wall/edit" className="ml-auto text-xs text-sky-300 underline">
          ← /wall/edit
        </Link>
      </header>
      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" />
      </div>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="extract"
          className="absolute bottom-4 right-4 z-10 max-h-40 max-w-[40vw] rounded border border-white/20 shadow-lg"
        />
      ) : null}
    </div>
  );
}

export default function PixiWallSpikePage() {
  return <SpikeClient />;
}
