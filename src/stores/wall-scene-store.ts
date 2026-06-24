import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { WallBounds } from "@/lib/wall-bounds";
import {
  DEFAULT_WALL_BOUNDS,
  getSceneObjectsBounds,
  reconcileWallBounds,
} from "@/lib/wall-bounds";
import type { WallSceneDocument, WallSceneObject } from "@/types/wall-scene-v2";
import { mergeObjectPatch } from "@/lib/wall-scene/merge-object-patch";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { allSelectableIds, normalizeSelectedIds } from "@/lib/wall-scene/selection-utils";
import { getGroupMemberIds } from "@/lib/wall-scene/group-objects";
import { isCanvasSelectableObject } from "@/lib/wall-scene/selectable-objects";
import type { SnapGuide } from "@/lib/wall-scene/snap-guides";

export const DEFAULT_GRID_SIZE = 20;

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
    selectedIds: [],
    snapGuides: [],
    showGrid: false,
    snapToGrid: false,
    gridSize: DEFAULT_GRID_SIZE,
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
        selectedIds: [],
        snapGuides: [],
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

    clearSelection: () => set({ selectedIds: [], snapGuides: [] }),

    setSnapGuides: (guides) => set({ snapGuides: guides }),

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
      const { selectedIds, document } = get();
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
