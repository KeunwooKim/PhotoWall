"use client";

import { Line } from "react-konva";
import { getEffectiveWallBounds } from "@/lib/wall-scene/wall-drag-expand";
import { useWallSceneStore } from "@/stores/wall-scene-store";

/** Subscribes to snapGuides locally so drag updates do not re-render the whole stage. */
export default function SnapGuideLines() {
  const guides = useWallSceneStore((s) => s.snapGuides);
  // Re-render when stored bounds change; during live drag Stage is resized imperatively.
  useWallSceneStore((s) => s.document.meta.wallBounds.width);
  useWallSceneStore((s) => s.document.meta.wallBounds.height);
  const wall = getEffectiveWallBounds();

  if (guides.length === 0) return null;

  return (
    <>
      {guides.map((guide, index) =>
        guide.orientation === "horizontal" ? (
          <Line
            key={`h-${guide.position}-${index}`}
            points={[0, guide.position, wall.width, guide.position]}
            stroke="#f43f5e"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ) : (
          <Line
            key={`v-${guide.position}-${index}`}
            points={[guide.position, 0, guide.position, wall.height]}
            stroke="#f43f5e"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ),
      )}
    </>
  );
}
