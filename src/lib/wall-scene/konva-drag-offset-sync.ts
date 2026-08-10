import { DD } from "konva/lib/DragAndDrop";
import { registerKonvaDragOffsetSync } from "@/lib/wall-scene/wall-drag-expand";

/** Rebind Konva drag offsets after live west/north wall expand. Konva-only. */
export function installKonvaDragOffsetSync(): () => void {
  registerKonvaDragOffsetSync((evt?: Event) => {
    DD._dragElements.forEach((elem) => {
      if (elem.dragStatus !== "dragging" && elem.dragStatus !== "ready") return;
      const node = elem.node;
      const stage = node.getStage();
      if (!stage) return;
      if (evt) {
        stage.setPointersPositions(evt);
      }
      const pos =
        stage._getPointerById(elem.pointerId) || stage.getPointerPosition();
      if (!pos) return;
      const ap = node.getAbsolutePosition();
      elem.offset.x = pos.x - ap.x;
      elem.offset.y = pos.y - ap.y;
    });
  });
  return () => registerKonvaDragOffsetSync(null);
}
