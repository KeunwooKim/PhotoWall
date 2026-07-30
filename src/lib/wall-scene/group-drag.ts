import type Konva from "konva";
import { clampObjectPositionToWall } from "@/lib/wall-scene/clamp-object-to-wall";
import { createLivePatchBroadcaster } from "@/lib/wall-scene/realtime/live-object-patch";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import { getWallNode } from "@/lib/wall-scene/realtime/wall-node-sync";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";

interface DragSession {
  leaderId: string;
  leaderStartX: number;
  leaderStartY: number;
  startPositions: Map<string, { x: number; y: number }>;
}

let session: DragSession | null = null;
const liveBroadcast = createLivePatchBroadcaster();

function clampPatchForObject(
  object: WallSceneObject,
  patch: { x: number; y: number; rotation: number; scaleX: number; scaleY: number },
): { x: number; y: number; rotation: number; scaleX: number; scaleY: number } {
  const wall = useWallSceneStore.getState().document.meta.wallBounds;
  const candidate = { ...object, ...patch } as WallSceneObject;
  const clamped = clampObjectPositionToWall(candidate, wall);
  if (!clamped) return patch;
  return { ...patch, ...clamped };
}
function movingIdsForLeader(leaderId: string): string[] {
  const { document, selectedIds } = useWallSceneStore.getState();
  const leader = document.objects.find((object) => object.id === leaderId);
  if (!leader) return [];

  if (leader.groupId) {
    return document.objects
      .filter((object) => object.groupId === leader.groupId)
      .map((object) => object.id);
  }

  if (selectedIds.includes(leaderId) && selectedIds.length > 1) {
    return selectedIds;
  }

  return [leaderId];
}

export function beginGroupDrag(leaderId: string): void {
  const { document } = useWallSceneStore.getState();
  const leader = document.objects.find((object) => object.id === leaderId);
  if (!leader) return;

  const ids = movingIdsForLeader(leaderId);
  const startPositions = new Map<string, { x: number; y: number }>();

  for (const id of ids) {
    const object = document.objects.find((item) => item.id === id);
    if (object) startPositions.set(id, { x: object.x, y: object.y });
  }

  session = {
    leaderId,
    leaderStartX: leader.x,
    leaderStartY: leader.y,
    startPositions,
  };
}

export function applyGroupDrag(leaderNode: Konva.Node): void {
  if (!session || session.leaderId !== leaderNode.id()) return;

  const deltaX = leaderNode.x() - session.leaderStartX;
  const deltaY = leaderNode.y() - session.leaderStartY;
  if (deltaX === 0 && deltaY === 0) return;

  for (const [id, start] of session.startPositions) {
    if (id === session.leaderId) continue;

    const node = getWallNode(id);
    if (!node) continue;

    const x = start.x + deltaX;
    const y = start.y + deltaY;
    node.position({ x, y });
    liveBroadcast(id, { x, y });
  }
}

export function commitGroupDrag(leaderNode: Konva.Node): void {
  liveBroadcast.flush();

  if (!session) {
    commitSingleDrag(leaderNode);
    return;
  }

  const store = useWallSceneStore.getState();
  store.recordHistory();

  for (const id of session.startPositions.keys()) {
    const node = getWallNode(id) ?? (id === leaderNode.id() ? leaderNode : null);
    if (!node) continue;

    const object = store.document.objects.find((item) => item.id === id);
    if (!object) continue;

    let patch = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
    };
    patch = clampPatchForObject(object, patch);
    node.position({ x: patch.x, y: patch.y });
    store.patchObject(id, patch);
    broadcastWallPatch(id, patch);
  }

  session = null;
  store.bumpRevision();
}

function commitSingleDrag(node: Konva.Node): void {
  const id = node.id();
  const store = useWallSceneStore.getState();
  const object = store.document.objects.find((item) => item.id === id);
  let patch = {
    x: node.x(),
    y: node.y(),
    rotation: node.rotation(),
    scaleX: node.scaleX(),
    scaleY: node.scaleY(),
  };
  if (object) {
    patch = clampPatchForObject(object, patch);
    node.position({ x: patch.x, y: patch.y });
  }
  store.patchObject(id, patch);
  store.recordHistory();
  broadcastWallPatch(id, patch);
}

export function cancelGroupDrag(): void {
  session = null;
  liveBroadcast.flush();
}
