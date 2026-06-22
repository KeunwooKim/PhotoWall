import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { WallBounds } from "@/lib/wall-bounds";
import {
  DEFAULT_WALL_BOUNDS,
  getSceneObjectsBounds,
  reconcileWallBounds,
} from "@/lib/wall-bounds";
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
  historyPast: WallSceneDocument[];
  historyFuture: WallSceneDocument[];

  loadDocument: (doc: WallSceneDocument) => void;
  reset: () => void;
  setSelectedId: (id: string | null) => void;
  setViewportScale: (scale: number) => void;
  recordHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  upsertObject: (object: WallSceneObject) => void;
  patchObject: (id: string, patch: Partial<WallSceneObject>) => void;
  removeObject: (id: string) => void;
  reorderObject: (id: string, zIndex: number) => void;
  setWallBounds: (bounds: WallBounds) => void;
  reconcileWallBoundsFromObjects: () => void;
  bumpRevision: () => void;
  /** Merge authoritative remote snapshot without replacing unrelated local state. */
  syncRemoteObjects: (objects: WallSceneObject[]) => void;
}

function sortByZIndex(objects: WallSceneObject[]): WallSceneObject[] {
  return [...objects].sort((a, b) => a.zIndex - b.zIndex);
}

const MAX_HISTORY = 50;

function cloneDocument(doc: WallSceneDocument): WallSceneDocument {
  return JSON.parse(JSON.stringify(doc)) as WallSceneDocument;
}

function withReconciledWallBounds(document: WallSceneDocument): WallSceneDocument {
  const next = reconcileWallBounds(
    document.meta.wallBounds,
    getSceneObjectsBounds(document.objects),
  );
  if (!next) return document;

  return {
    ...document,
    meta: { ...document.meta, wallBounds: next },
  };
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
        selectedId: null,
        viewportScale: 1,
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
          selectedId: null,
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
          selectedId: null,
        };
      }),

    canUndo: () => get().historyPast.length > 0,
    canRedo: () => get().historyFuture.length > 0,

    setSelectedId: (id) => set({ selectedId: id }),

    setViewportScale: (scale) => set({ viewportScale: scale }),

    upsertObject: (object) =>
      set((state) => {
        const exists = state.document.objects.some((o) => o.id === object.id);
        const objects = exists
          ? state.document.objects.map((o) => (o.id === object.id ? { ...o, ...object } : o))
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
            o.id === id ? ({ ...o, ...patch } as WallSceneObject) : o,
          ),
        },
      })),

    removeObject: (id) => {
      get().recordHistory();
      set((state) => ({
        document: withReconciledWallBounds({
          ...state.document,
          objects: state.document.objects.filter((o) => o.id !== id),
        }),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }));
    },

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

    reconcileWallBoundsFromObjects: () =>
      set((state) => {
        const document = withReconciledWallBounds(state.document);
        if (document === state.document) return state;
        return { document };
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
        return {
          document: withReconciledWallBounds({
            ...state.document,
            objects: sortByZIndex(merged),
          }),
        };
      }),
  })),
);
