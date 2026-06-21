import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { WallBounds } from "@/lib/wall-bounds";
import { DEFAULT_WALL_BOUNDS } from "@/lib/wall-bounds";
import type { WallSceneDocument, WallSceneObject } from "@/types/wall-scene-v2";

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
  selectedId: string | null;
  viewportScale: number;

  loadDocument: (doc: WallSceneDocument) => void;
  reset: () => void;
  setSelectedId: (id: string | null) => void;
  setViewportScale: (scale: number) => void;
  upsertObject: (object: WallSceneObject) => void;
  patchObject: (id: string, patch: Partial<WallSceneObject>) => void;
  removeObject: (id: string) => void;
  reorderObject: (id: string, zIndex: number) => void;
  setWallBounds: (bounds: WallBounds) => void;
  bumpRevision: () => void;
}

function sortByZIndex(objects: WallSceneObject[]): WallSceneObject[] {
  return [...objects].sort((a, b) => a.zIndex - b.zIndex);
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
    selectedId: null,
    viewportScale: 1,

    loadDocument: (doc) => set({ document: { ...doc, objects: sortByZIndex(doc.objects) } }),

    reset: () =>
      set({
        document: createEmptyWallScene(),
        selectedId: null,
        viewportScale: 1,
      }),

    setSelectedId: (id) => set({ selectedId: id }),

    setViewportScale: (scale) => set({ viewportScale: scale }),

    upsertObject: (object) =>
      set((state) => {
        const exists = state.document.objects.some((o) => o.id === object.id);
        const objects = exists
          ? state.document.objects.map((o) => (o.id === object.id ? { ...o, ...object } : o))
          : [...state.document.objects, object];
        return { document: { ...state.document, objects: sortByZIndex(objects) } };
      }),

    patchObject: (id, patch) =>
      set((state) => ({
        document: {
          ...state.document,
          objects: state.document.objects.map((o) =>
            o.id === id ? ({ ...o, ...patch } as WallSceneObject) : o,
          ),
        },
      })),

    removeObject: (id) =>
      set((state) => ({
        document: {
          ...state.document,
          objects: state.document.objects.filter((o) => o.id !== id),
        },
        selectedId: state.selectedId === id ? null : state.selectedId,
      })),

    reorderObject: (id, zIndex) => {
      get().patchObject(id, { zIndex });
    },

    setWallBounds: (bounds) =>
      set((state) => ({
        document: {
          ...state.document,
          meta: { ...state.document.meta, wallBounds: bounds },
        },
      })),

    bumpRevision: () =>
      set((state) => ({
        document: {
          ...state.document,
          meta: { ...state.document.meta, revision: state.document.meta.revision + 1 },
        },
      })),
  })),
);
