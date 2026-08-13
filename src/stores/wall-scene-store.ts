import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { WallBounds } from "@/lib/wall-bounds";
import {
  DEFAULT_WALL_BOUNDS,
  asWallBounds,
  clampWallBoundsAnchored,
} from "@/lib/wall-bounds";
import { memorySafeWallMax } from "@/lib/wall-device";
import type { WallSceneDocument, WallSceneObject } from "@/types/wall-scene-v2";
import { mergeObjectPatch } from "@/lib/wall-scene/merge-object-patch";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { clampUserZoom, panForZoomAtScreenPoint } from "@/lib/wall-scene/viewport-zoom";
import { allSelectableIds, normalizeSelectedIds } from "@/lib/wall-scene/selection-utils";
import { getGroupMemberIds } from "@/lib/wall-scene/group-objects";
import { isCanvasSelectableObject } from "@/lib/wall-scene/selectable-objects";
import { sanitizeWallScene } from "@/lib/wall-scene/sanitize-wall-scene";
import type { SnapGuide } from "@/lib/wall-scene/snap-guides";

export const DEFAULT_GRID_SIZE = 20;

function snapGuidesEqual(a: SnapGuide[], b: SnapGuide[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].orientation !== b[i].orientation || a[i].position !== b[i].position) {
      return false;
    }
  }
  return true;
}

export function createEmptyWallScene(): WallSceneDocument {
  return {
    meta: {
      version: 2,
      wallBounds: DEFAULT_WALL_BOUNDS,
      revision: 0,
    },
    objects: [],
  };
}

export interface WallSceneStore {
  document: WallSceneDocument;
  selectedIds: string[];
  snapGuides: SnapGuide[];
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  viewportScale: number;
  userZoom: number;
  panX: number;
  panY: number;
  historyPast: WallSceneDocument[];
  historyFuture: WallSceneDocument[];

  loadDocument: (doc: WallSceneDocument) => void;
  reset: () => void;
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
  setSnapGuides: (guides: SnapGuide[]) => void;
  toggleShowGrid: () => void;
  toggleSnapToGrid: () => void;
  selectObject: (id: string, additive?: boolean) => void;
  selectAll: () => void;
  removeSelectedObjects: () => void;
  setViewportScale: (scale: number) => void;
  setUserZoom: (zoom: number) => void;
  setViewportZoomAtPoint: (
    newZoom: number,
    screenX: number,
    screenY: number,
    containerCenterX: number,
    containerCenterY: number,
  ) => void;
  addPan: (dx: number, dy: number) => void;
  /** Restore pan/zoom from a persisted camera snapshot. */
  setCamera: (camera: { panX: number; panY: number; userZoom: number }) => void;
  resetUserZoom: () => void;
  recordHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  upsertObject: (object: WallSceneObject) => void;
  patchObject: (id: string, patch: WallObjectPatch) => void;
  clearObjectField: (id: string, field: "groupId") => void;
  removeObject: (id: string) => void;
  reorderObject: (id: string, zIndex: number) => void;
  setWallBounds: (bounds: WallBounds) => void;
  addWallpaperOffset: (dx: number, dy: number) => void;
  setWallpaperOffset: (offset: { x: number; y: number } | undefined) => void;
  /** Move wallpaper + homeOrigin together when content shifts for west/north expand. */
  shiftWallHomeAnchors: (dx: number, dy: number) => void;
  /** When wall is default-sized, bake homeOrigin back to (0,0). */
  normalizeWallHomeOrigin: () => void;
  reconcileWallBoundsFromObjects: () => void;
  setWallSizeLocked: (locked: boolean) => void;
  setWallShrinkEnabled: (enabled: boolean) => void;
  bumpRevision: () => void;
  /** Merge authoritative remote snapshot without replacing unrelated local state. */
  syncRemoteObjects: (objects: WallSceneObject[]) => void;
  /** Apply remote wall meta (bounds + wallpaper offset) from peers. */
  syncRemoteWallMeta: (meta: {
    wallBounds: WallBounds;
    wallpaperOffset?: { x: number; y: number };
    wallSizeLocked?: boolean;
    wallShrinkEnabled?: boolean;
  }) => void;
}

function sortByZIndex(objects: WallSceneObject[]): WallSceneObject[] {
  return [...objects].sort((a, b) => a.zIndex - b.zIndex);
}

const MAX_HISTORY = 50;

function cloneDocument(doc: WallSceneDocument): WallSceneDocument {
  return JSON.parse(JSON.stringify(doc)) as WallSceneDocument;
}

function withReconciledWallBounds(document: WallSceneDocument): WallSceneDocument {
  // Clamp off-canvas drift first, then fit wall size — prevents a far drag from
  // inflating the canvas to WALL_MAX and crashing Safari on reload.
  return sanitizeWallScene(document);
}

export const useWallSceneStore = create<WallSceneStore>()(
  subscribeWithSelector((set, get) => ({
    document: {
      meta: {
        version: 2,
        wallBounds: DEFAULT_WALL_BOUNDS,
        revision: 0,
      },
      objects: [],
    },
    selectedIds: [],
    snapGuides: [],
    showGrid: false,
    snapToGrid: false,
    gridSize: DEFAULT_GRID_SIZE,
    viewportScale: 1,
    userZoom: 1,
    panX: 0,
    panY: 0,
    historyPast: [],
    historyFuture: [],

    loadDocument: (doc) =>
      set({
        document: withReconciledWallBounds({
          ...doc,
          objects: sortByZIndex(doc.objects),
        }),
        historyPast: [],
        historyFuture: [],
      }),

    reset: () =>
      set({
        document: createEmptyWallScene(),
        selectedIds: [],
        snapGuides: [],
        viewportScale: 1,
        userZoom: 1,
        panX: 0,
        panY: 0,
        historyPast: [],
        historyFuture: [],
      }),

    recordHistory: () =>
      set((state) => ({
        historyPast: [...state.historyPast, cloneDocument(state.document)].slice(-MAX_HISTORY),
        historyFuture: [],
      })),

    undo: () =>
      set((state) => {
        if (!state.historyPast.length) return state;
        const previous = state.historyPast[state.historyPast.length - 1];
        return {
          document: previous,
          historyPast: state.historyPast.slice(0, -1),
          historyFuture: [cloneDocument(state.document), ...state.historyFuture],
          selectedIds: [],
        };
      }),

    redo: () =>
      set((state) => {
        if (!state.historyFuture.length) return state;
        const [next, ...rest] = state.historyFuture;
        return {
          document: next,
          historyPast: [...state.historyPast, cloneDocument(state.document)].slice(-MAX_HISTORY),
          historyFuture: rest,
          selectedIds: [],
        };
      }),

    canUndo: () => get().historyPast.length > 0,
    canRedo: () => get().historyFuture.length > 0,

    setSelectedIds: (ids) =>
      set((state) => ({
        selectedIds: normalizeSelectedIds(ids, state.document.objects),
      })),

    clearSelection: () =>
      set((state) =>
        state.selectedIds.length === 0 && state.snapGuides.length === 0
          ? state
          : { selectedIds: [], snapGuides: [] },
      ),

    setSnapGuides: (guides) =>
      set((state) => {
        if (snapGuidesEqual(state.snapGuides, guides)) return state;
        return { snapGuides: guides };
      }),

    toggleShowGrid: () => set((state) => ({ showGrid: !state.showGrid })),

    toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

    selectObject: (id, additive = false) =>
      set((state) => {
        const object = state.document.objects.find((item) => item.id === id);
        if (!object || !isCanvasSelectableObject(object)) {
          return state;
        }

        if (additive) {
          const exists = state.selectedIds.includes(id);
          return {
            selectedIds: exists
              ? state.selectedIds.filter((selectedId) => selectedId !== id)
              : [...state.selectedIds, id],
          };
        }

        if (state.selectedIds.includes(id) && state.selectedIds.length > 1) {
          return {
            selectedIds: [
              ...state.selectedIds.filter((selectedId) => selectedId !== id),
              id,
            ],
          };
        }

        const groupIds = object.groupId
          ? getGroupMemberIds(state.document.objects, object.groupId)
          : [id];

        return { selectedIds: groupIds };
      }),

    selectAll: () =>
      set((state) => ({
        selectedIds: allSelectableIds(state.document.objects),
      })),

    removeSelectedObjects: () => {
      const { selectedIds } = get();
      if (selectedIds.length === 0) return;

      get().recordHistory();
      const remove = new Set(selectedIds);
      set((state) => ({
        document: withReconciledWallBounds({
          ...state.document,
          objects: state.document.objects.filter((object) => !remove.has(object.id)),
        }),
        selectedIds: [],
      }));
    },

    setViewportScale: (scale) => set({ viewportScale: scale }),
    setUserZoom: (zoom) => set({ userZoom: clampUserZoom(zoom) }),
    setViewportZoomAtPoint: (newZoom, screenX, screenY, containerCenterX, containerCenterY) =>
      set((state) => {
        const clamped = clampUserZoom(newZoom);
        if (Math.abs(clamped - state.userZoom) < 0.0001) return state;
        const nextPan = panForZoomAtScreenPoint(
          state.panX,
          state.panY,
          state.userZoom,
          clamped,
          screenX,
          screenY,
          containerCenterX,
          containerCenterY,
        );
        return { userZoom: clamped, ...nextPan };
      }),
    addPan: (dx, dy) =>
      set((state) => ({ panX: state.panX + dx, panY: state.panY + dy })),
    setCamera: (camera) =>
      set({
        panX: camera.panX,
        panY: camera.panY,
        userZoom: clampUserZoom(camera.userZoom),
      }),
    resetUserZoom: () => set({ userZoom: 1, panX: 0, panY: 0 }),

    upsertObject: (object) =>
      set((state) => {
        const exists = state.document.objects.some((o) => o.id === object.id);
        // Replace (do not shallow-merge): callers pass a full object, and omitted
        // optional fields (e.g. cleared `crop`) must actually disappear.
        const objects = exists
          ? state.document.objects.map((o) => (o.id === object.id ? object : o))
          : [...state.document.objects, object];
        return {
          document: withReconciledWallBounds({
            ...state.document,
            objects: sortByZIndex(objects),
          }),
        };
      }),

    patchObject: (id, patch) =>
      set((state) => ({
        document: {
          ...state.document,
          objects: state.document.objects.map((o) =>
            o.id === id ? mergeObjectPatch(o, patch) : o,
          ),
        },
      })),

    clearObjectField: (id, field) =>
      set((state) => ({
        document: {
          ...state.document,
          objects: state.document.objects.map((o) => {
            if (o.id !== id) return o;
            const next = { ...o } as WallSceneObject & { groupId?: string };
            delete next[field];
            return next as WallSceneObject;
          }),
        },
      })),

    removeObject: (id) => {
      get().recordHistory();
      set((state) => ({
        document: withReconciledWallBounds({
          ...state.document,
          objects: state.document.objects.filter((o) => o.id !== id),
        }),
        selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
      }));
    },

    reorderObject: (id, zIndex) => {
      get().patchObject(id, { zIndex });
    },

    setWallBounds: (bounds) =>
      set((state) => ({
        document: {
          ...state.document,
          meta: {
            ...state.document.meta,
            wallBounds: clampWallBoundsAnchored(
              asWallBounds(bounds),
              memorySafeWallMax(),
            ),
          },
        },
      })),

    addWallpaperOffset: (dx, dy) => {
      if (dx === 0 && dy === 0) return;
      set((state) => {
        const prev = state.document.meta.wallpaperOffset ?? { x: 0, y: 0 };
        return {
          document: {
            ...state.document,
            meta: {
              ...state.document.meta,
              wallpaperOffset: { x: prev.x + dx, y: prev.y + dy },
            },
          },
        };
      });
    },

    setWallpaperOffset: (offset) =>
      set((state) => ({
        document: {
          ...state.document,
          meta: {
            ...state.document.meta,
            wallpaperOffset: offset,
          },
        },
      })),

    shiftWallHomeAnchors: (dx, dy) => {
      void dx;
      void dy;
      // no-op — center-origin walls do not shift content/home on expand
    },

    normalizeWallHomeOrigin: () => {
      // no-op — home frame is fixed at DEFAULT_WALL_BOUNDS
    },
    reconcileWallBoundsFromObjects: () =>
      set((state) => {
        const document = withReconciledWallBounds(state.document);
        if (document === state.document) return state;
        return { document };
      }),

    setWallSizeLocked: (locked) =>
      set((state) => {
        if (!!state.document.meta.wallSizeLocked === locked) return state;
        return {
          document: {
            ...state.document,
            meta: {
              ...state.document.meta,
              wallSizeLocked: locked,
              revision: state.document.meta.revision + 1,
            },
          },
        };
      }),

    setWallShrinkEnabled: (enabled) =>
      set((state) => {
        if (!!state.document.meta.wallShrinkEnabled === enabled) return state;
        return {
          document: {
            ...state.document,
            meta: {
              ...state.document.meta,
              wallShrinkEnabled: enabled,
              revision: state.document.meta.revision + 1,
            },
          },
        };
      }),

    bumpRevision: () =>
      set((state) => ({
        document: {
          ...state.document,
          meta: { ...state.document.meta, revision: state.document.meta.revision + 1 },
        },
      })),

    syncRemoteObjects: (incoming) =>
      set((state) => {
        const localById = new Map(state.document.objects.map((object) => [object.id, object]));
        const merged = incoming.map((remote) => {
          const local = localById.get(remote.id);
          return (local ? { ...local, ...remote } : remote) as WallSceneObject;
        });
        // Do not sanitize here — re-baking homeOrigin/wallpaper on peers shifts their camera.
        return {
          document: {
            ...state.document,
            objects: sortByZIndex(merged),
          },
        };
      }),

    syncRemoteWallMeta: (meta) =>
      set((state) => ({
        document: {
          ...state.document,
          meta: {
            ...state.document.meta,
            wallBounds: clampWallBoundsAnchored(
              asWallBounds(meta.wallBounds),
              memorySafeWallMax(),
            ),
            ...(meta.wallpaperOffset !== undefined
              ? { wallpaperOffset: meta.wallpaperOffset }
              : {}),
            ...(meta.wallSizeLocked !== undefined
              ? { wallSizeLocked: meta.wallSizeLocked }
              : {}),
            ...(meta.wallShrinkEnabled !== undefined
              ? { wallShrinkEnabled: meta.wallShrinkEnabled }
              : {}),
          },
        },
      })),
  })),
);
