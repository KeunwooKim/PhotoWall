"use client";

import { useEffect, useRef } from "react";
import { Container, Graphics, Text } from "pixi.js";
import { presenceColorToPixi } from "@/lib/wall-scene/presence-colors";
import { selectionStrokeWallPx } from "@/lib/wall-scene/selection-chrome";
import { peerHighlightLayout } from "@/lib/wall-scene/presence-utils";
import { getWallNode, registerPeerHighlightNode } from "@/lib/wall-scene/realtime/wall-node-sync";
import { wrapPixiContainer } from "@/lib/wall-scene/realtime/wrap-pixi-node";
import { usePeerSelectionsByObjectId } from "@/lib/wall-scene/realtime/wall-presence-store";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { PixiWallEngine } from "./pixi-wall-engine";

const DEG = Math.PI / 180;
const STACK_PX = 4;
const LABEL_STACK = 18;

/** Peer selection frames for shared walls (Pixi) — one pastel color per collaborator. */
export function usePixiPeerHighlights(
  engine: PixiWallEngine | null,
  currentSessionId?: string,
): void {
  const objects = useWallSceneStore((s) => s.document.objects);
  const peerHighlightsByObjectId = usePeerSelectionsByObjectId(currentSessionId);
  const rootsRef = useRef(new Map<string, Container>());

  useEffect(() => {
    if (!engine) return;
    const keep = new Set<string>();

    for (const object of objects) {
      const highlights = peerHighlightsByObjectId.get(object.id);
      if (!highlights?.length) continue;
      keep.add(object.id);

      const live = getWallNode(object.id);
      const layoutObject = live
        ? {
            ...object,
            x: live.x(),
            y: live.y(),
            rotation: live.rotation(),
            scaleX: live.scaleX(),
            scaleY: live.scaleY(),
          }
        : object;
      const layout = peerHighlightLayout(layoutObject);
      if (!layout) continue;

      let root = rootsRef.current.get(object.id);
      if (!root) {
        root = new Container();
        root.eventMode = "none";
        engine.overlayLayer.addChild(root);
        rootsRef.current.set(object.id, root);
        registerPeerHighlightNode(object.id, wrapPixiContainer(root, `peer-${object.id}`));
      }

      root.removeChildren();
      root.x = layout.x;
      root.y = layout.y;
      root.rotation = layout.rotation * DEG;
      root.scale.set(layout.scaleX, layout.scaleY);
      if (layout.offsetY) root.pivot.y = layout.offsetY;

      const sx = Math.abs(layout.scaleX) || 1;
      const sy = Math.abs(layout.scaleY) || 1;

      const viewScale = Math.max(engine.viewport.scale.x, 0.05);
      const strokeScreen = selectionStrokeWallPx(viewScale);

      highlights.forEach((peer, index) => {
        const color = presenceColorToPixi(peer.color);
        const insetX = (index * STACK_PX) / sx;
        const insetY = (index * STACK_PX) / sy;
        const frame = new Graphics()
          .rect(
            -insetX,
            -insetY,
            layout.width + insetX * 2,
            layout.height + insetY * 2,
          )
          .stroke({
            width: strokeScreen / Math.min(sx, sy),
            color,
            alpha: 0.95,
          });
        root!.addChild(frame);

        const label = new Text({
          text: peer.displayName || "친구",
          style: { fontSize: 12, fill: 0x3f3f46, fontWeight: "600" },
        });
        const tagW = Math.max(40, label.width + 8);
        const tagY = -18 / sy - index * (LABEL_STACK / sy);
        const tag = new Graphics()
          .roundRect(-4, tagY, tagW, 16, 4)
          .fill({ color });
        label.x = 0;
        label.y = tagY + 2;
        // Keep label readable regardless of object scale.
        label.scale.set(1 / sx, 1 / sy);
        tag.scale.set(1 / sx, 1 / sy);
        root!.addChild(tag);
        root!.addChild(label);
      });
    }

    for (const [id, root] of [...rootsRef.current]) {
      if (keep.has(id)) continue;
      registerPeerHighlightNode(id, null);
      root.destroy({ children: true });
      rootsRef.current.delete(id);
    }
  }, [engine, objects, peerHighlightsByObjectId]);

  useEffect(() => {
    return () => {
      const roots = rootsRef.current;
      for (const [id, root] of roots) {
        registerPeerHighlightNode(id, null);
        root.destroy({ children: true });
      }
      roots.clear();
    };
  }, [engine]);
}
