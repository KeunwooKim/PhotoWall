"use client";

import { Line } from "react-konva";
import type { SnapGuide } from "@/lib/wall-scene/snap-guides";

interface SnapGuideLinesProps {
  guides: SnapGuide[];
  wallWidth: number;
  wallHeight: number;
}

export default function SnapGuideLines({ guides, wallWidth, wallHeight }: SnapGuideLinesProps) {
  if (guides.length === 0) return null;

  return (
    <>
      {guides.map((guide, index) =>
        guide.orientation === "horizontal" ? (
          <Line
            key={`h-${guide.position}-${index}`}
            points={[0, guide.position, wallWidth, guide.position]}
            stroke="#f43f5e"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ) : (
          <Line
            key={`v-${guide.position}-${index}`}
            points={[guide.position, 0, guide.position, wallHeight]}
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
