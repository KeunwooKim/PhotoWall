"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WallStageClient from "@/components/wall/WallStageClient";
import EditorAssetsPanel from "@/components/wall/EditorAssetsPanel";
import EditorToolDock, { MenuIcon } from "@/components/wall/EditorToolDock";
import EditorToolRail from "@/components/wall/EditorToolRail";
import EditorPropertiesSidebar from "@/components/wall/EditorPropertiesSidebar";
import EditorMenuDrawer from "@/components/wall/EditorMenuDrawer";
import EditorSelectionSheet from "@/components/wall/EditorSelectionSheet";
import AuthButton from "@/components/auth/AuthButton";
import { DEFAULT_WALL_THEME_ID, resolveWallThemeId } from "@/lib/wall-themes";
import type { WallThemeId } from "@/types/wall";
import { useAuth } from "@/hooks/useAuth";
import { usePersonalWallLease } from "@/hooks/usePersonalWallLease";
import { fetchCloudWall, saveWallToCloud } from "@/lib/auth/migrate-wall";
import { sceneRevisionFromJson } from "@/lib/wall-scene/scene-revision";
import { clearWall, getOrCreateWallId, loadWall, saveWall, setPersonalWallId } from "@/lib/wall-storage";
import { publishWall } from "@/lib/wall-share";
import { shareWallImage } from "@/lib/wall-export";
import { createWallInvite } from "@/lib/wall-invite";
import { consumePendingImports } from "@/lib/booth-import/import-session";
import { consumePendingScanFiles } from "@/lib/photo-scan/scan-session";
import {
  prefetchWallScenePhotoUrls,
  resolveWallPhotoSrc,
} from "@/lib/storage/resolve-wall-photos";
import { migrateDataUrlsToGuestPhotos } from "@/lib/storage/migrate-guest-photos";
import { addPhotoDataUrlToWallScene } from "@/lib/wall-scene/add-photo-data-url";
import { addPhotoToWallScene } from "@/lib/wall-scene/add-photo";
import { applyUpscaleToWallPhoto } from "@/lib/photo-edit/apply-upscale-to-photo";
import { addStickerToWallScene } from "@/lib/wall-scene/add-sticker";
import {
  countSelectedQuotaObjects,
  getClipboardQuotaObjectCount,
} from "@/lib/wall-scene/clipboard-objects";
import {
  applyBringOntoWall,
  countOutsideObjectsOnWall,
} from "@/lib/wall-scene/bring-objects-onto-wall";
import { parseWallScene, serializeWallScene } from "@/lib/wall-scene/fabric-import";
import { fingerprintPersistableScene } from "@/lib/wall-scene/scene-fingerprint";
import { sanitizeWallScene } from "@/lib/wall-scene/sanitize-wall-scene";
import { registerWallSizeLockBlockedHandler } from "@/lib/wall-scene/wall-size-lock";
import { runWithoutWallPersist } from "@/lib/wall-scene/realtime/wall-persist-gate";
import { debounce } from "@/lib/debounce";
import { useWallPreviewFlush } from "@/hooks/useWallPreviewFlush";
import { usePersistWallViewport } from "@/hooks/usePersistWallViewport";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { EditorMode } from "@/components/wall/editor-types";
import type { PublishedWall } from "@/types/wall";
import type { WallStageExportHandle } from "@/components/wall/pixi/PixiWallStage";
import {
  bringObjectForward,
  bringObjectsToFront,
  sendObjectBackward,
  sendObjectsToBack,
} from "@/lib/wall-scene/layer-order";
import { primarySelectedId } from "@/lib/wall-scene/selection-utils";
import { canGroupSelection, selectionHasGroup } from "@/lib/wall-scene/group-objects";
import { useWallTransformActions } from "@/hooks/useWallTransformActions";
import { useWallEditorContextMenu } from "@/hooks/useWallEditorContextMenu";
import type { WallContextMenuActions } from "@/lib/wall-scene/build-context-menu-sections";
import WallContextMenu from "@/components/wall/WallContextMenu";
import TextStyleBar from "@/components/wall/TextStyleBar";
import WallQuotaHint from "@/components/wall/WallQuotaHint";
import ZoomResetButton from "@/components/wall/ZoomResetButton";
import PhotoCropToolbar from "@/components/wall/PhotoCropToolbar";
import PhotoColorToolbar from "@/components/wall/PhotoColorToolbar";
import { usePhotoCrop } from "@/hooks/usePhotoCrop";
import { usePhotoColorEdit } from "@/hooks/usePhotoColorEdit";
import { useInstagramExport } from "@/hooks/useInstagramExport";
import { useWallViewportAdapter } from "@/hooks/useWallViewportAdapter";
import type { PixiWallEngine } from "@/components/wall/pixi/pixi-wall-engine";
import WallInstagramExportChrome from "@/components/wall/WallInstagramExportChrome";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import WallLoadingOverlay from "@/components/wall/WallLoadingOverlay";
import GuestSaveBanner from "@/components/wall/GuestSaveBanner";
import { useClientWallPlan, useGuardWallObjectAdd } from "@/hooks/useWallSceneUsage";
import { TAPE_OPACITY_DEFAULT, TAPE_STROKE_WIDTH_DEFAULT } from "@/lib/wall-scene/highlighter";
import {
  DEFAULT_PEN_STYLE_ID,
  PEN_COLORS,
  clampPenStrokeWidth,
  createDefaultPenWidthByStyle,
  type PenStyleId,
  type PenWidthByStyle,
} from "@/lib/wall-scene/pen";
import {
  DEFAULT_TAPE_END_STYLE,
  getTapePreset,
  type TapeEndStyle,
  type TapePreset,
} from "@/lib/wall-scene/tape-style";
import { wallTextFontVariables } from "@/lib/fonts/wall-text-fonts";

const PEN_DRAW_COLORS = [...PEN_COLORS];

export default function PersonalWallKonvaEditor() {
  const { user, isLoading: authLoading } = useAuth();
  const [wallId, setWallId] = useState(() => getOrCreateWallId());
  const wallIdRef = useRef(wallId);
  const wallStageRef = useRef<HTMLDivElement>(null);
  const konvaStageRef = useRef<WallStageExportHandle | null>(null);

  const [themeId, setThemeId] = useState<WallThemeId>(DEFAULT_WALL_THEME_ID);
  const [loadedCanvasJson, setLoadedCanvasJson] = useState<object | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuInitialPanel, setMenuInitialPanel] = useState<"menu" | "settings" | "share">("menu");
  const [autoSaved, setAutoSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [mode, setMode] = useState<EditorMode>("select");
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [penColor, setPenColor] = useState<string>(PEN_DRAW_COLORS[0]);
  const [tapePreset, setTapePreset] = useState<TapePreset>(() => getTapePreset(undefined));
  const [tapeEndStyle, setTapeEndStyle] = useState<TapeEndStyle>(DEFAULT_TAPE_END_STYLE);
  const [penStyleId, setPenStyleId] = useState<PenStyleId>(DEFAULT_PEN_STYLE_ID);
  const [penWidthByStyle, setPenWidthByStyle] = useState<PenWidthByStyle>(createDefaultPenWidthByStyle);
  const [tapeStrokeWidth, setTapeStrokeWidth] = useState(TAPE_STROKE_WIDTH_DEFAULT);
  const [tapeOpacity, setTapeOpacity] = useState(TAPE_OPACITY_DEFAULT);

  const handleTapePresetChange = (preset: TapePreset) => {
    setTapePreset(preset);
    if (preset.opacity != null) setTapeOpacity(preset.opacity);
  };
  const penStrokeWidth = penWidthByStyle[penStyleId];
  const setPenStrokeWidth = (width: number) => {
    setPenWidthByStyle((prev) => ({
      ...prev,
      [penStyleId]: clampPenStrokeWidth(penStyleId, width),
    }));
  };

  const themeIdRef = useRef(themeId);
  const userRef = useRef(user);
  const syncedUserRef = useRef<string | null>(null);
  const persistEnabledRef = useRef(false);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  /** Last successfully synced server revision (optimistic concurrency). */
  const serverRevisionRef = useRef<number | undefined>(undefined);
  /** Skip destructive local reload when wallId only changes via cloud id adopt */
  const suppressWallIdReloadRef = useRef(false);
  /** Block autosave until cloud sync finishes (prevents empty local overwriting DB) */
  const cloudSyncDoneRef = useRef(false);
  /** One cloud write at a time — overlapping saves with stale baseRevision cause 409 loops. */
  const cloudSaveInFlightRef = useRef(false);
  /** If edits arrived while a cloud save was in flight, retry once after it finishes. */
  const pendingCloudSaveRef = useRef(false);
  /** Exclusive editor lease — false when another device claimed the wall. */
  const isEditorRef = useRef(true);

  themeIdRef.current = themeId;
  userRef.current = user;
  wallIdRef.current = wallId;

  const adoptWallId = useCallback((id: string) => {
    if (!id || id === wallIdRef.current) return;
    suppressWallIdReloadRef.current = true;
    setPersonalWallId(id);
    wallIdRef.current = id;
    setWallId(id);
  }, []);

  const selectedIds = useWallSceneStore((s) => s.selectedIds);
  const sceneObjects = useWallSceneStore((s) => s.document.objects);
  const showGrid = useWallSceneStore((s) => s.showGrid);
  const snapToGrid = useWallSceneStore((s) => s.snapToGrid);
  const toggleShowGrid = useWallSceneStore((s) => s.toggleShowGrid);
  const toggleSnapToGrid = useWallSceneStore((s) => s.toggleSnapToGrid);
  const primaryId = primarySelectedId(selectedIds);
  const selectedTextObject = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const obj = sceneObjects.find((o) => o.id === selectedIds[0]);
    return obj?.type === "text" ? obj : null;
  }, [selectedIds, sceneObjects]);
  const editingTextObject =
    editingTextId && selectedTextObject?.id === editingTextId ? selectedTextObject : null;
  const inspectorObject = useMemo(() => {
    if (selectedIds.length !== 1 || editingTextId) return null;
    return sceneObjects.find((o) => o.id === selectedIds[0]) ?? null;
  }, [editingTextId, selectedIds, sceneObjects]);

  const {
    cropPhotoId,
    cropAspectPreset,
    setCropAspectPreset,
    handleStartCrop: startCrop,
    handleCropApply,
    handleCropCancel,
    handleCropReset,
    canResetCrop,
    konvaCropProps,
  } = usePhotoCrop(sceneObjects);

  const {
    colorEditPhotoId,
    colorEditPhoto,
    params: colorParams,
    setParams: setColorParams,
    busy: colorBusy,
    errorMessage: colorError,
    handleStartColorEdit: startColorEdit,
    handleColorCancel,
    handleColorApply,
  } = usePhotoColorEdit(sceneObjects);

  const handleStartCrop = useCallback(
    (id: string) => {
      handleColorCancel();
      startCrop(id);
    },
    [handleColorCancel, startCrop],
  );

  const handleStartColorEdit = useCallback(
    (id: string) => {
      handleCropCancel();
      startColorEdit(id);
    },
    [handleCropCancel, startColorEdit],
  );

  const [upscaleBusy, setUpscaleBusy] = useState(false);

  useEffect(() => {
    if (!colorEditPhotoId) return;
    if (selectedIds.length !== 1 || selectedIds[0] !== colorEditPhotoId) {
      handleColorCancel();
    }
  }, [colorEditPhotoId, selectedIds, handleColorCancel]);

  useEffect(() => {
    if (!editingTextId) return;
    if (selectedIds.length !== 1 || selectedIds[0] !== editingTextId) {
      setEditingTextId(null);
    }
  }, [editingTextId, selectedIds]);
  const wallBounds = useWallSceneStore((s) => s.document.meta.wallBounds);
  const canUndo = useWallSceneStore((s) => s.historyPast.length > 0);
  const canRedo = useWallSceneStore((s) => s.historyFuture.length > 0);
  const undo = useWallSceneStore((s) => s.undo);
  const redo = useWallSceneStore((s) => s.redo);

  const showToast = useCallback((message: string) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(null), 2000);
  }, []);

  useEffect(() => {
    registerWallSizeLockBlockedHandler(() => {
      showToast("벽 크기가 고정되어 있어요. 설정에서 고정을 끄면 크기를 바꿀 수 있어요");
    });
    return () => registerWallSizeLockBlockedHandler(null);
  }, [showToast]);

  const wallPlan = useClientWallPlan();
  const { usage: sceneUsage, guardAdd, limitMessage } = useGuardWallObjectAdd(wallPlan);

  const [pixiEngine, setPixiEngine] = useState<PixiWallEngine | null>(null);
  const instagramExport = useInstagramExport(wallBounds);
  const instagramViewport = useWallViewportAdapter({
    pixiEngine,
    wallStageRef,
    wallBounds,
    stageReady: isReady,
  });

  const handleStartInstagramExport = useCallback(() => {
    if (cropPhotoId) handleCropCancel();
    if (colorEditPhotoId) handleColorCancel();
    useWallSceneStore.getState().clearSelection();
    setEditingTextId(null);
    setMode("select");
    instagramExport.start();
  }, [
    colorEditPhotoId,
    cropPhotoId,
    handleColorCancel,
    handleCropCancel,
    instagramExport,
  ]);

  const persistLocal = useCallback((json: object) => {
    saveWall(themeIdRef.current, json);
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 1500);
  }, []);

  const { markPreviewDirty, flushPreview } = useWallPreviewFlush({
    getWallId: () => wallIdRef.current,
    getThemeId: () => themeIdRef.current,
    wallStageRef,
    konvaStageRef,
    isEnabled: () => !!userRef.current,
  });

  const markCleanFromStore = useCallback(() => {
    lastSavedFingerprintRef.current = fingerprintPersistableScene(
      useWallSceneStore.getState().document,
    );
  }, []);

  const autoSaveCancelRef = useRef<() => void>(() => {});
  const queueDirtyAutosaveRef = useRef<() => void>(() => {});

  /** Adopt server snapshot on OCC conflict without re-arming autosave. */
  const adoptConflictWall = useCallback(
    (conflictWall: PublishedWall, toastMessage?: string) => {
      // Drop any pending debounce — it still carries a stale baseRevision.
      autoSaveCancelRef.current();

      const serverRev = sceneRevisionFromJson(conflictWall.canvasJson);
      serverRevisionRef.current = serverRev;

      // Avoid re-sanitizing before soft-match (same as shared walls).
      const doc = parseWallScene(conflictWall.canvasJson, { sanitize: false });
      const conflictFp = fingerprintPersistableScene(doc);
      const localFp = fingerprintPersistableScene(useWallSceneStore.getState().document);

      if (conflictFp === localFp) {
        markCleanFromStore();
        return false;
      }

      runWithoutWallPersist(() => {
        useWallSceneStore.getState().loadDocument(doc);
      }, 500);
      // Fingerprint AFTER loadDocument sanitize — pre-load fp can re-dirty the store.
      markCleanFromStore();
      saveWall(conflictWall.themeId, conflictWall.canvasJson);
      setThemeId(resolveWallThemeId(conflictWall.themeId));
      if (toastMessage) showToast(toastMessage);
      return true;
    },
    [markCleanFromStore, showToast],
  );

  const finishCloudSaveFlight = useCallback(() => {
    cloudSaveInFlightRef.current = false;
    if (!pendingCloudSaveRef.current) return;
    pendingCloudSaveRef.current = false;
    queueDirtyAutosaveRef.current();
  }, []);

  const autoSave = useMemo(
    () =>
      debounce((json: object, fingerprint: string) => {
        if (!persistEnabledRef.current) return;
        if (!isEditorRef.current) return;
        persistLocal(json);
        markPreviewDirty();

        if (!userRef.current) {
          lastSavedFingerprintRef.current = fingerprint;
          return;
        }

        // Never autosave an empty scene to cloud — refresh race used to wipe DB
        // while storage photos still existed. Explicit clear/save can still wipe.
        const objectCount = useWallSceneStore.getState().document.objects.length;
        if (objectCount === 0) return;

        if (cloudSaveInFlightRef.current) {
          pendingCloudSaveRef.current = true;
          return;
        }

        cloudSaveInFlightRef.current = true;
        const baseRevision = serverRevisionRef.current;

        void saveWallToCloud(
          themeIdRef.current,
          json,
          wallIdRef.current,
          baseRevision,
          userRef.current?.id,
        )
          .then((result) => {
            if (result.migratedDocument) {
              runWithoutWallPersist(() => {
                useWallSceneStore.getState().loadDocument(result.migratedDocument!);
              }, 500);
              markCleanFromStore();
            }
            if (result.restricted) {
              showToast(result.message || "활동이 제한된 계정이에요");
              return;
            }
            if (result.conflictWall) {
              adoptConflictWall(
                result.conflictWall,
                result.message || "다른 기기에서 벽이 먼저 저장됐어요. 다시 불러왔어요.",
              );
              return;
            }
            if (result.wall) {
              adoptWallId(result.wall.id);
              serverRevisionRef.current = sceneRevisionFromJson(result.wall.canvasJson);
              // Only mark clean after a successful cloud write (not before).
              markCleanFromStore();
              // Upload while stage is still alive — leave-time flush is race-prone.
              void flushPreview({ force: true, wallId: result.wall.id });
              return;
            }
            // Local already saved; cloud failed — keep dirty so a later edit/flush retries.
            showToast("클라우드 저장에 실패했어요. 잠시 후 다시 저장해 주세요");
          })
          .catch(() => {
            showToast("클라우드 저장에 실패했어요. 잠시 후 다시 저장해 주세요");
          })
          .finally(() => {
            finishCloudSaveFlight();
          });
      }, 1500),
    [
      persistLocal,
      adoptWallId,
      markPreviewDirty,
      flushPreview,
      showToast,
      adoptConflictWall,
      markCleanFromStore,
      finishCloudSaveFlight,
    ],
  );

  autoSaveCancelRef.current = () => autoSave.cancel();
  queueDirtyAutosaveRef.current = () => {
    if (!persistEnabledRef.current || !userRef.current) return;
    if (!isEditorRef.current) return;
    const doc = useWallSceneStore.getState().document;
    if (doc.objects.length === 0) return;
    const fp = fingerprintPersistableScene(doc);
    if (fp === lastSavedFingerprintRef.current) return;
    autoSave(serializeWallScene(doc), fp);
  };

  const handleLeaseKicked = useCallback(() => {
    persistEnabledRef.current = false;
    autoSaveCancelRef.current();
    showToast("다른 기기에서 편집을 시작했어요");
  }, [showToast]);

  const {
    isEditor,
    reclaim: reclaimEditorLease,
  } = usePersonalWallLease({
    wallId,
    userId: user?.id,
    enabled: !!user && isReady && !isCloudSyncing && !authLoading,
    onKicked: handleLeaseKicked,
  });
  isEditorRef.current = isEditor;

  useEffect(() => {
    if (!isEditor) {
      persistEnabledRef.current = false;
      autoSaveCancelRef.current();
      return;
    }
    if (user && cloudSyncDoneRef.current) {
      persistEnabledRef.current = true;
    }
  }, [isEditor, user]);

  const handleReclaimEditor = useCallback(async () => {
    if (!user) {
      reclaimEditorLease();
      return;
    }
    try {
      const cloud = await fetchCloudWall();
      if (cloud) {
        const doc = parseWallScene(cloud.canvasJson, { sanitize: false });
        runWithoutWallPersist(() => {
          useWallSceneStore.getState().loadDocument(doc);
        }, 500);
        saveWall(cloud.themeId, cloud.canvasJson);
        adoptWallId(cloud.id);
        serverRevisionRef.current = sceneRevisionFromJson(cloud.canvasJson);
        setThemeId(resolveWallThemeId(cloud.themeId));
        setLoadedCanvasJson(cloud.canvasJson);
        lastSavedFingerprintRef.current = fingerprintPersistableScene(
          useWallSceneStore.getState().document,
        );
        await prefetchWallScenePhotoUrls(doc, cloud.id);
      }
    } catch {
      // Still reclaim — OCC remains as safety net.
    }
    reclaimEditorLease();
    if (cloudSyncDoneRef.current) persistEnabledRef.current = true;
    showToast("이 기기에서 편집을 이어가요");
  }, [user, reclaimEditorLease, adoptWallId, showToast]);

  const handleDocumentChange = useCallback(
    (json: object) => {
      if (!isEditorRef.current) return;
      const fingerprint = fingerprintPersistableScene(useWallSceneStore.getState().document);
      if (!persistEnabledRef.current || fingerprint === lastSavedFingerprintRef.current) return;
      autoSave(json, fingerprint);
    },
    [autoSave],
  );

  // Flush pending autosave on tab hide / refresh / in-app navigate so edits
  // aren't lost to the 1.5s debounce (cancel-on-unmount used to drop them).
  useEffect(() => {
    const flush = () => {
      autoSave.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      // Flush before this effect tears down (dep change or leave)
      flush();
    };
  }, [autoSave]);

  const handleReady = useCallback(() => {
    lastSavedFingerprintRef.current = fingerprintPersistableScene(
      useWallSceneStore.getState().document,
    );
    // Logged-in: wait for cloud sync so empty local can't wipe DB
    if (!userRef.current || cloudSyncDoneRef.current) {
      persistEnabledRef.current = true;
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const outside = countOutsideObjectsOnWall();
    if (outside <= 0) return;
    showToast(
      outside === 1
        ? "벽 밖 요소 1개 — 메뉴에서 가져올 수 있어요"
        : `벽 밖 요소 ${outside}개 — 메뉴에서 가져올 수 있어요`,
    );
  }, [isReady, showToast]);

  const resolvePhotoSrc = useCallback(
    (src: string) => resolveWallPhotoSrc(src, wallId),
    [wallId],
  );

  const handleUpscalePhoto = useCallback(
    async (id: string) => {
      if (upscaleBusy) return;
      const photo = sceneObjects.find((item) => item.id === id);
      if (!photo || photo.type !== "photo") return;

      setUpscaleBusy(true);
      try {
        const displaySrc = await resolvePhotoSrc(photo.src);
        const result = await applyUpscaleToWallPhoto(photo, {
          displaySrc,
          userId: user?.id,
          plan: wallPlan,
        });
        if (result.status === "applied") {
          showToast("화질을 업스케일했어요");
        } else if (result.status === "skipped") {
          showToast("이미 충분히 큰 사진이에요");
        } else {
          showToast(result.message);
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : "업스케일에 실패했어요");
      } finally {
        setUpscaleBusy(false);
      }
    },
    [upscaleBusy, sceneObjects, resolvePhotoSrc, user?.id, wallPlan, showToast],
  );

  useEffect(() => {
    return () => {
      // Flush first while lastArgs still hold the real scene — then disarm.
      autoSave.flush();
      persistEnabledRef.current = false;
      autoSave.cancel();
      useWallSceneStore.getState().reset();
    };
  }, [autoSave]);

  // After reset-on-unmount so this cleanup saves camera before store.reset().
  usePersistWallViewport(wallId, isReady);

  useEffect(() => {
    if (suppressWallIdReloadRef.current) {
      suppressWallIdReloadRef.current = false;
      return;
    }

    setLoadedCanvasJson(null);
    setIsReady(false);
    persistEnabledRef.current = false;
    lastSavedFingerprintRef.current = null;

    void (async () => {
      const saved = loadWall();
      if (saved) {
        setThemeId(resolveWallThemeId(saved.themeId));
        const rawDoc = parseWallScene(saved.canvasJson, { sanitize: false });
        let doc = sanitizeWallScene(rawDoc);
        const legacy = await migrateDataUrlsToGuestPhotos(doc);
        if (legacy.migrated > 0) {
          doc = legacy.document;
        }
        const json = serializeWallScene(doc);
        const repaired =
          legacy.migrated > 0 ||
          fingerprintPersistableScene(rawDoc) !== fingerprintPersistableScene(doc);
        if (repaired) {
          saveWall(saved.themeId, json);
        }
        setLoadedCanvasJson(json);
        await prefetchWallScenePhotoUrls(doc, wallId);
        return;
      }

      setLoadedCanvasJson(serializeWallScene(useWallSceneStore.getState().document));
    })();
  }, [wallId]);

  const syncCloudWall = useCallback(async () => {
    if (!user) return;

    try {
      // Prefer cloud personal wall so local UUID drift doesn't spawn duplicates
      const cloud = await fetchCloudWall();
      const local = loadWall();
      const localDoc = local ? parseWallScene(local.canvasJson) : null;
      const localCount = localDoc?.objects.length ?? 0;

      if (cloud) {
        const cloudDoc = parseWallScene(cloud.canvasJson);
        const cloudCount = cloudDoc.objects.length;

        // Empty cloud must not wipe a non-empty local wall (refresh / race heal)
        if (cloudCount === 0 && localCount > 0 && local && localDoc) {
          const json = serializeWallScene(localDoc);
          const saved = await saveWallToCloud(
            local.themeId,
            json,
            cloud.id,
            cloudDoc.meta.revision ?? 0,
            user.id,
          );
          if (saved.migratedDocument) {
            useWallSceneStore.getState().loadDocument(saved.migratedDocument);
          }
          if (saved.wall) {
            saveWall(saved.wall.themeId, saved.wall.canvasJson);
            adoptWallId(saved.wall.id);
            serverRevisionRef.current = sceneRevisionFromJson(saved.wall.canvasJson);
            setThemeId(resolveWallThemeId(saved.wall.themeId));
            setLoadedCanvasJson(saved.wall.canvasJson);
            lastSavedFingerprintRef.current = fingerprintPersistableScene(
              parseWallScene(saved.wall.canvasJson),
            );
            showToast("체험 중이던 벽을 저장했어요");
          } else {
            saveWall(local.themeId, local.canvasJson);
            setThemeId(resolveWallThemeId(local.themeId));
            setLoadedCanvasJson(local.canvasJson);
            lastSavedFingerprintRef.current = fingerprintPersistableScene(localDoc);
          }
          return;
        }

        // Prefer newer local when both have content
        if (local && localDoc && localCount > 0 && cloudCount > 0) {
          const localRev = localDoc.meta.revision ?? 0;
          const cloudRev = cloudDoc.meta.revision ?? 0;
          const localTime = Date.parse(local.updatedAt);
          const cloudTime = Date.parse(cloud.updatedAt);
          const localNewer =
            localRev > cloudRev ||
            (localRev === cloudRev &&
              !Number.isNaN(localTime) &&
              !Number.isNaN(cloudTime) &&
              localTime > cloudTime + 1000);

          if (localNewer) {
            const json = serializeWallScene(localDoc);
            const saved = await saveWallToCloud(
              local.themeId,
              json,
              cloud.id,
              cloudRev,
              user.id,
            );
            if (saved.migratedDocument) {
              useWallSceneStore.getState().loadDocument(saved.migratedDocument);
            }
            if (saved.wall) {
              saveWall(saved.wall.themeId, saved.wall.canvasJson);
              adoptWallId(saved.wall.id);
              serverRevisionRef.current = sceneRevisionFromJson(saved.wall.canvasJson);
              setThemeId(resolveWallThemeId(saved.wall.themeId));
              setLoadedCanvasJson(saved.wall.canvasJson);
              lastSavedFingerprintRef.current = fingerprintPersistableScene(
                parseWallScene(saved.wall.canvasJson),
              );
            }
            return;
          }
        }

        // Cloud wins (or revisions equal) — sync quietly when already showing this wall.
        const cloudFp = fingerprintPersistableScene(cloudDoc);
        const storeFp = fingerprintPersistableScene(useWallSceneStore.getState().document);
        const localFp = localDoc ? fingerprintPersistableScene(localDoc) : null;
        const alreadySameContent = storeFp === cloudFp || localFp === cloudFp;

        // Write local BEFORE adoptWallId so any concurrent reload sees cloud data
        saveWall(cloud.themeId, cloud.canvasJson);
        adoptWallId(cloud.id);
        serverRevisionRef.current = cloudDoc.meta.revision ?? 0;
        setThemeId(resolveWallThemeId(cloud.themeId));
        await prefetchWallScenePhotoUrls(cloudDoc, cloud.id);
        lastSavedFingerprintRef.current = cloudFp;

        if (alreadySameContent) {
          // Refs/localStorage updated; skip remount toast spam on every login.
          if (storeFp !== cloudFp) {
            setLoadedCanvasJson(cloud.canvasJson);
          }
          return;
        }

        setLoadedCanvasJson(cloud.canvasJson);
        showToast("클라우드 벽을 불러왔어요");
        return;
      }

      if (local && localDoc) {
        const json = serializeWallScene(localDoc);
        const saved = await saveWallToCloud(
          local.themeId,
          json,
          local.id,
          localDoc.meta.revision ?? 0,
          user.id,
        );
        if (saved.migratedDocument) {
          useWallSceneStore.getState().loadDocument(saved.migratedDocument);
        }
        if (saved.wall) {
          saveWall(saved.wall.themeId, saved.wall.canvasJson);
          adoptWallId(saved.wall.id);
          serverRevisionRef.current = sceneRevisionFromJson(saved.wall.canvasJson);
          setThemeId(resolveWallThemeId(saved.wall.themeId));
          setLoadedCanvasJson(saved.wall.canvasJson);
          lastSavedFingerprintRef.current = fingerprintPersistableScene(
            parseWallScene(saved.wall.canvasJson),
          );
          showToast("벽이 이어졌어요 · 이제 어디서든 볼 수 있어요");
        }
      }
    } finally {
      cloudSyncDoneRef.current = true;
      // Do not overwrite lastSavedFingerprint from the live store here —
      // setLoadedCanvasJson may not have reloaded Konva yet, and a stale
      // fingerprint would autosave the wrong (or empty) scene.
      if (lastSavedFingerprintRef.current == null) {
        lastSavedFingerprintRef.current = fingerprintPersistableScene(
          useWallSceneStore.getState().document,
        );
      }
      persistEnabledRef.current = true;
    }
  }, [user, showToast, adoptWallId]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      cloudSyncDoneRef.current = true;
      syncedUserRef.current = null;
      if (isReady) persistEnabledRef.current = true;
      return;
    }

    if (!isReady || syncedUserRef.current === user.id) return;
    syncedUserRef.current = user.id;
    cloudSyncDoneRef.current = false;
    persistEnabledRef.current = false;
    setIsCloudSyncing(true);
    void syncCloudWall().finally(() => setIsCloudSyncing(false));
  }, [user, isReady, authLoading, syncCloudWall]);

  useEffect(() => {
    if (!isReady || authLoading) return;
    // Wait until cloud wall has finished loading — otherwise sync overwrites imports
    if (user && (isCloudSyncing || !cloudSyncDoneRef.current)) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      const pendingImports = consumePendingImports();
      const pendingScanFiles = consumePendingScanFiles();
      if (pendingImports.length === 0 && pendingScanFiles.length === 0) return;

      void (async () => {
        try {
          const bounds = useWallSceneStore.getState().document.meta.wallBounds;

          for (const dataUrl of pendingImports) {
            if (cancelled) return;
            if (!guardAdd(1)) {
              showToast(limitMessage);
              break;
            }
            await addPhotoDataUrlToWallScene(dataUrl, {
              wallWidth: bounds.width,
              wallHeight: bounds.height,
            });
          }

          for (const file of pendingScanFiles) {
            if (cancelled) return;
            if (!guardAdd(1)) {
              showToast(limitMessage);
              break;
            }
            await addPhotoToWallScene(file, {
              userId: user?.id,
              wallId,
              wallWidth: bounds.width,
              wallHeight: bounds.height,
              plan: wallPlan,
            });
          }

          if (cancelled) return;

          const doc = useWallSceneStore.getState().document;
          const json = serializeWallScene(doc);
          persistLocal(json);
          lastSavedFingerprintRef.current = fingerprintPersistableScene(doc);
          setLoadedCanvasJson(json);
          if (user?.id) {
            void saveWallToCloud(
              themeIdRef.current,
              json,
              wallIdRef.current,
              serverRevisionRef.current,
              user.id,
            ).then((result) => {
              if (result.migratedDocument) {
                useWallSceneStore.getState().loadDocument(result.migratedDocument);
              }
              if (result.wall) {
                adoptWallId(result.wall.id);
                serverRevisionRef.current = sceneRevisionFromJson(result.wall.canvasJson);
              }
            });
          }

          if (pendingScanFiles.length > 0 && pendingImports.length === 0) {
            showToast("스캔한 사진을 붙였어요");
          } else if (pendingImports.length > 0 && pendingScanFiles.length === 0) {
            showToast("QR 네컷 사진을 붙였어요");
          } else {
            showToast("사진을 붙였어요");
          }
        } catch (err) {
          if (!cancelled) {
            showToast(err instanceof Error ? err.message : "사진을 붙이지 못했어요");
          }
        }
      })();
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isReady,
    authLoading,
    user,
    isCloudSyncing,
    showToast,
    guardAdd,
    limitMessage,
    wallId,
    wallPlan,
    persistLocal,
    adoptWallId,
  ]);

  const handlePhotoUpload = useCallback(
    async (file: File) => {
      if (!guardAdd(1)) {
        showToast(limitMessage);
        return;
      }
      try {
        await addPhotoToWallScene(file, {
          userId: user?.id,
          wallId,
          wallWidth: wallBounds.width,
          wallHeight: wallBounds.height,
          plan: wallPlan,
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : "사진을 붙이지 못했어요");
      }
    },
    [user?.id, wallId, wallBounds.width, wallBounds.height, showToast, guardAdd, limitMessage, wallPlan],
  );

  const handleAddSticker = useCallback(
    (stickerId: string) => {
      if (!guardAdd(1)) {
        showToast(limitMessage);
        return;
      }
      const added = addStickerToWallScene(stickerId, {
        wallWidth: wallBounds.width,
        wallHeight: wallBounds.height,
      });
      if (!added) showToast("스티커를 붙이지 못했어요");
    },
    [wallBounds.width, wallBounds.height, showToast, guardAdd, limitMessage],
  );

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    useWallSceneStore.getState().removeSelectedObjects();
    useWallSceneStore.getState().bumpRevision();
  }, [selectedIds.length]);

  const handleModeChange = useCallback((next: EditorMode) => {
    setMode(next);
    if (next === "pen" || next === "tape" || next === "text") {
      useWallSceneStore.getState().clearSelection();
    }
  }, []);

  const handleSelectAll = useCallback(() => {
    useWallSceneStore.getState().selectAll();
  }, []);

  const handleBringOntoWall = useCallback(() => {
    const ids = useWallSceneStore.getState().selectedIds;
    const moved = applyBringOntoWall(ids);
    if (moved === 0) {
      showToast(
        ids.length > 0
          ? "선택한 항목은 이미 벽 안에 있어요"
          : "벽 밖으로 나간 항목이 없어요",
      );
      return;
    }
    showToast(
      moved === 1 ? "벽 안으로 가져왔어요" : `${moved}개 항목을 벽 안으로 가져왔어요`,
    );
  }, [showToast]);

  const handleBringForward = useCallback(() => {
    if (!primaryId) return;
    if (!bringObjectForward(primaryId)) {
      showToast("더 앞으로 보낼 수 없어요");
    }
  }, [primaryId, showToast]);

  const handleSendBackward = useCallback(() => {
    if (!primaryId) return;
    if (!sendObjectBackward(primaryId)) {
      showToast("더 뒤로 보낼 수 없어요");
    }
  }, [primaryId, showToast]);

  const handleBringToFront = useCallback(() => {
    if (selectedIds.length === 0) return;
    if (!bringObjectsToFront(selectedIds)) {
      showToast("이미 맨 앞이에요");
    }
  }, [selectedIds, showToast]);

  const handleSendToBack = useCallback(() => {
    if (selectedIds.length === 0) return;
    if (!sendObjectsToBack(selectedIds)) {
      showToast("이미 맨 뒤예요");
    }
  }, [selectedIds, showToast]);

  const {
    handleAlignLeft,
    handleAlignCenterH,
    handleAlignRight,
    handleAlignTop,
    handleAlignMiddle,
    handleAlignBottom,
    handleDistributeHorizontal: distributeHorizontal,
    handleDistributeVertical: distributeVertical,
    handleFlipHorizontal: flipHorizontal,
    handleFlipVertical: flipVertical,
    centerOnWall,
    nudgeSelection,
    duplicateSelection,
    copySelection,
    cutSelection,
    pasteSelection,
    groupSelection,
    ungroupSelection,
  } = useWallTransformActions();

  const handleCenterOnWall = useCallback(() => {
    if (!centerOnWall()) {
      showToast("이동할 수 없어요");
    }
  }, [centerOnWall, showToast]);

  const onDistributeHorizontal = useCallback(() => {
    if (!distributeHorizontal()) {
      showToast("3개 이상 선택해야 균등 배치할 수 있어요");
    }
  }, [distributeHorizontal, showToast]);

  const onDistributeVertical = useCallback(() => {
    if (!distributeVertical()) {
      showToast("3개 이상 선택해야 균등 배치할 수 있어요");
    }
  }, [distributeVertical, showToast]);

  const onFlipHorizontal = useCallback(() => {
    if (!flipHorizontal()) {
      showToast("뒤집을 항목이 없어요");
    }
  }, [flipHorizontal, showToast]);

  const onFlipVertical = useCallback(() => {
    if (!flipVertical()) {
      showToast("뒤집을 항목이 없어요");
    }
  }, [flipVertical, showToast]);

  const handleDuplicate = useCallback(() => {
    const n = countSelectedQuotaObjects();
    if (n > 0 && !guardAdd(n)) {
      showToast(limitMessage);
      return;
    }
    if (!duplicateSelection()) {
      showToast("복제할 항목이 없어요");
    }
  }, [duplicateSelection, showToast, guardAdd, limitMessage]);

  const handleCopy = useCallback(() => {
    if (!copySelection()) {
      showToast("복사할 항목이 없어요");
    }
  }, [copySelection, showToast]);

  const handleCut = useCallback(() => {
    if (!cutSelection()) {
      showToast("잘라낼 항목이 없어요");
    }
  }, [cutSelection, showToast]);

  const handlePaste = useCallback(() => {
    const n = getClipboardQuotaObjectCount();
    if (n > 0 && !guardAdd(n)) {
      showToast(limitMessage);
      return;
    }
    if (!pasteSelection()) {
      showToast("붙여넣을 항목이 없어요");
    }
  }, [pasteSelection, showToast, guardAdd, limitMessage]);

  const handleGroup = useCallback(() => {
    if (!groupSelection()) {
      showToast("2개 이상 선택해야 그룹할 수 있어요");
    }
  }, [groupSelection, showToast]);

  const handleUngroup = useCallback(() => {
    if (!ungroupSelection()) {
      showToast("그룹이 없어요");
    }
  }, [ungroupSelection, showToast]);

  const contextMenuActions = useMemo<WallContextMenuActions>(
    () => ({
      onCopy: handleCopy,
      onCut: handleCut,
      onPaste: handlePaste,
      onDuplicate: handleDuplicate,
      onDelete: handleDelete,
      onEditText: () => {
        const id = useWallSceneStore.getState().selectedIds[0];
        if (id) setEditingTextId(id);
      },
      onAlignLeft: handleAlignLeft,
      onAlignCenterH: handleAlignCenterH,
      onAlignRight: handleAlignRight,
      onAlignTop: handleAlignTop,
      onAlignMiddle: handleAlignMiddle,
      onAlignBottom: handleAlignBottom,
      onCenterOnWall: handleCenterOnWall,
      onDistributeHorizontal: onDistributeHorizontal,
      onDistributeVertical: onDistributeVertical,
      onFlipHorizontal: onFlipHorizontal,
      onFlipVertical: onFlipVertical,
      onGroup: handleGroup,
      onUngroup: handleUngroup,
      onBringToFront: handleBringToFront,
      onBringForward: handleBringForward,
      onSendBackward: handleSendBackward,
      onSendToBack: handleSendToBack,
    }),
    [
      handleAlignBottom,
      handleAlignCenterH,
      handleAlignLeft,
      handleAlignMiddle,
      handleAlignRight,
      handleAlignTop,
      handleBringForward,
      handleBringToFront,
      handleCenterOnWall,
      handleCopy,
      handleCut,
      handleDelete,
      handleDuplicate,
      handleGroup,
      handlePaste,
      handleSendBackward,
      handleSendToBack,
      handleUngroup,
      onDistributeHorizontal,
      onDistributeVertical,
      onFlipHorizontal,
      onFlipVertical,
    ],
  );

  const {
    isOpen: isContextMenuOpen,
    position: contextMenuPosition,
    sections: contextMenuSections,
    close: closeContextMenu,
    handleContextMenuRequest,
  } = useWallEditorContextMenu({
    mode,
    actions: contextMenuActions,
  });

  const handleThemeChange = useCallback(
    (next: WallThemeId) => {
      if (!isEditorRef.current) {
        showToast("다른 기기에서 편집 중이에요");
        return;
      }
      setThemeId(next);
      themeIdRef.current = next;
      const json = serializeWallScene(useWallSceneStore.getState().document);
      persistLocal(json);
      markPreviewDirty();
      if (userRef.current) {
        if (cloudSaveInFlightRef.current) {
          pendingCloudSaveRef.current = true;
          return;
        }
        cloudSaveInFlightRef.current = true;
        void saveWallToCloud(
          next,
          json,
          wallIdRef.current,
          serverRevisionRef.current,
          userRef.current.id,
        )
          .then((result) => {
            if (result.migratedDocument) {
              runWithoutWallPersist(() => {
                useWallSceneStore.getState().loadDocument(result.migratedDocument!);
              }, 500);
              markCleanFromStore();
            }
            if (result.conflictWall) {
              adoptConflictWall(
                result.conflictWall,
                result.message || "다른 기기에서 벽이 먼저 저장됐어요. 다시 불러왔어요.",
              );
              return;
            }
            if (result.wall) {
              adoptWallId(result.wall.id);
              serverRevisionRef.current = sceneRevisionFromJson(result.wall.canvasJson);
              markCleanFromStore();
            }
          })
          .finally(() => {
            finishCloudSaveFlight();
          });
      }
    },
    [
      persistLocal,
      adoptWallId,
      markPreviewDirty,
      adoptConflictWall,
      markCleanFromStore,
      finishCloudSaveFlight,
      showToast,
    ],
  );

  const handleSave = useCallback(async () => {
    if (!isEditorRef.current) {
      showToast("다른 기기에서 편집 중이에요");
      return;
    }
    const json = serializeWallScene(useWallSceneStore.getState().document);
    persistLocal(json);
    markPreviewDirty();

    if (user) {
      // Cancel pending autosave so it cannot POST with a stale base after this save.
      autoSave.cancel();

      if (cloudSaveInFlightRef.current) {
        pendingCloudSaveRef.current = true;
        showToast("저장 중이에요. 잠시만 기다려 주세요");
        return;
      }

      cloudSaveInFlightRef.current = true;
      try {
        const result = await saveWallToCloud(
          themeId,
          json,
          wallIdRef.current,
          serverRevisionRef.current,
          user.id,
        );
        if (result.migratedDocument) {
          runWithoutWallPersist(() => {
            useWallSceneStore.getState().loadDocument(result.migratedDocument!);
          }, 500);
          markCleanFromStore();
        }
        if (result.conflictWall) {
          adoptConflictWall(
            result.conflictWall,
            result.message || "다른 기기에서 벽이 먼저 저장됐어요. 다시 불러왔어요.",
          );
          return;
        }
        if (result.restricted) {
          showToast(result.message || "활동이 제한된 계정이에요");
          return;
        }
        if (result.wall) {
          adoptWallId(result.wall.id);
          serverRevisionRef.current = sceneRevisionFromJson(result.wall.canvasJson);
          markCleanFromStore();
          showToast("클라우드에 저장됐어요");
          return;
        }
        showToast("저장됐어요");
        markCleanFromStore();
        return;
      } finally {
        finishCloudSaveFlight();
      }
    }

    markCleanFromStore();
    showToast("저장됐어요");
  }, [
    persistLocal,
    themeId,
    user,
    showToast,
    adoptWallId,
    markPreviewDirty,
    autoSave,
    adoptConflictWall,
    markCleanFromStore,
    finishCloudSaveFlight,
  ]);

  const handleClear = useCallback(() => {
    if (!confirm("벽의 모든 꾸미기를 지울까요?")) return;
    useWallSceneStore.getState().recordHistory();
    useWallSceneStore.getState().reset();
    const json = serializeWallScene(useWallSceneStore.getState().document);
    clearWall();
    persistLocal(json);
    setLoadedCanvasJson(json);
    lastSavedFingerprintRef.current = fingerprintPersistableScene(
      useWallSceneStore.getState().document,
    );
    markPreviewDirty();
    if (userRef.current) {
      void saveWallToCloud(
        themeIdRef.current,
        json,
        wallIdRef.current,
        serverRevisionRef.current,
        userRef.current.id,
      ).then((result) => {
        if (result.wall) {
          adoptWallId(result.wall.id);
          serverRevisionRef.current = sceneRevisionFromJson(result.wall.canvasJson);
        }
      });
    }
    showToast("벽을 비웠어요");
  }, [showToast, persistLocal, adoptWallId, markPreviewDirty]);

  const handleShare = useCallback(async () => {
    if (!userRef.current) {
      showToast("로그인하면 벽을 공유할 수 있어요");
      return;
    }
    const json = serializeWallScene(useWallSceneStore.getState().document);
    setIsSharing(true);
    try {
      const data = saveWall(themeId, json);
      const { id, url } = await publishWall(data);
      if (id !== "share") {
        await flushPreview({ force: true, wallId: id });
      }
      await navigator.clipboard.writeText(url);
      showToast("링크가 복사됐어요");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "공유에 실패했어요");
    } finally {
      setIsSharing(false);
    }
  }, [themeId, showToast, flushPreview]);

  const handleExport = useCallback(async () => {
    const stage = wallStageRef.current;
    if (!stage || isExporting) return;

    setIsExporting(true);
    try {
      await shareWallImage(stage);
      showToast("이미지를 저장했어요");
    } catch {
      showToast("이미지 저장에 실패했어요");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, showToast]);

  const handleInvite = useCallback(async () => {
    if (!userRef.current) {
      showToast("로그인하면 친구를 초대할 수 있어요");
      return;
    }
    const json = serializeWallScene(useWallSceneStore.getState().document);
    setIsInviting(true);
    try {
      const data = saveWall(themeId, json);
      const { id } = await publishWall(data);

      if (id === "share") {
        showToast("친구 초대는 Supabase 설정 후 이용할 수 있어요");
        return;
      }

      await flushPreview({ force: true, wallId: id });
      const { url } = await createWallInvite(id);
      await navigator.clipboard.writeText(url);
      showToast("초대 링크가 복사됐어요");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "초대 링크 생성에 실패했어요");
    } finally {
      setIsInviting(false);
    }
  }, [themeId, showToast, flushPreview]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (isMod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if (isMod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleSelectAll();
        return;
      }
      if (!isMod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        setMode("select");
        return;
      }
      if (!isMod && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setMode("hand");
        return;
      }
      if (e.key === "Escape") {
        useWallSceneStore.getState().clearSelection();
        return;
      }
      if (isMod && e.key.toLowerCase() === "d") {
        if (selectedIds.length > 0 && (mode === "select" || mode === "hand")) {
          e.preventDefault();
          handleDuplicate();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === "c") {
        if (selectedIds.length > 0 && (mode === "select" || mode === "hand")) {
          e.preventDefault();
          handleCopy();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === "x") {
        if (selectedIds.length > 0 && (mode === "select" || mode === "hand")) {
          e.preventDefault();
          handleCut();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === "v") {
        if (mode === "select" || mode === "hand") {
          e.preventDefault();
          handlePaste();
        }
        return;
      }
      if (isMod && e.shiftKey && e.key.toLowerCase() === "g") {
        if (mode === "select" || mode === "hand") {
          e.preventDefault();
          handleUngroup();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === "g") {
        if (selectedIds.length > 0 && (mode === "select" || mode === "hand")) {
          e.preventDefault();
          handleGroup();
        }
        return;
      }
      if ((mode === "select" || mode === "hand") && selectedIds.length > 0) {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          nudgeSelection(-step, 0);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          nudgeSelection(step, 0);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          nudgeSelection(0, -step);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          nudgeSelection(0, step);
          return;
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDelete();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCopy, handleCut, handleDelete, handleDuplicate, handleGroup, handlePaste, handleSelectAll, handleUngroup, mode, nudgeSelection, redo, selectedIds.length, undo]);

  if (!loadedCanvasJson) {
    return <WallLoadingOverlay title="내 벽 불러오는 중..." />;
  }

  return (
    <div className={`flex h-[100dvh] w-screen flex-col overflow-hidden overscroll-none bg-background ${wallTextFontVariables}`}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-50 px-3"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <div className="pointer-events-auto mx-auto max-w-lg">
          <AnnouncementBanner target="editor" compact />
        </div>
      </div>

      <header
        className="relative z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-foreground/10 bg-surface px-3"
        style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setMenuInitialPanel("menu");
              setIsMenuOpen(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition hover:bg-foreground/5"
            aria-label="메뉴 열기"
          >
            <MenuIcon />
          </button>
          <span className="hidden text-xs font-medium text-muted sm:inline">내 벽</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ZoomResetButton />
          <WallQuotaHint usage={sceneUsage} plan={wallPlan} />
          {autoSaved && !saveMessage && (
            <div className="pointer-events-none hidden rounded-full bg-foreground/[0.06] px-3 py-1 text-xs text-muted sm:block">
              {user ? "클라우드 자동 저장됨" : "자동 저장됨"}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setMenuInitialPanel("share");
              setIsMenuOpen(true);
            }}
            className="hidden rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-foreground/90 transition hover:bg-foreground/5 sm:inline"
          >
            공유
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background transition hover:bg-foreground/90"
          >
            저장
          </button>
          <AuthButton compact />
        </div>
      </header>

      <EditorMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        initialPanel={menuInitialPanel}
        wallTitle="내 벽"
        onInvite={() => void handleInvite()}
        isInviting={isInviting}
        inviteLabel="친구 초대"
        onShare={() => void handleShare()}
        isSharing={isSharing}
        onExport={() => void handleExport()}
        isExporting={isExporting}
        onInstagramExport={handleStartInstagramExport}
        onSave={() => void handleSave()}
      />

      <div className="flex min-h-0 flex-1">
        <div className="hidden md:flex">
          <EditorToolRail
            mode={mode}
            onModeChange={handleModeChange}
            onToggleAssets={() => setIsAssetsOpen((v) => !v)}
            assetsOpen={isAssetsOpen}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
          <EditorAssetsPanel
            variant="docked"
            isOpen={isAssetsOpen}
            onClose={() => setIsAssetsOpen(false)}
            themeId={themeId}
            onThemeChange={handleThemeChange}
            onPhotoUpload={handlePhotoUpload}
            onAddSticker={handleAddSticker}
            returnTo="/wall/edit"
          />
        </div>

        <div className="relative min-h-0 min-w-0 flex-1 bg-surface">
          <WallStageClient
            themeId={themeId}
            initialJson={loadedCanvasJson}
            wallId={wallId}
            resolvePhotoSrc={resolvePhotoSrc}
            onDocumentChange={handleDocumentChange}
            onReady={handleReady}
            wallStageRef={wallStageRef}
            konvaStageRef={konvaStageRef}
            editorMode={mode}
            drawColor={mode === "pen" ? penColor : tapePreset.color}
            tapeStrokeWidth={tapeStrokeWidth}
            tapeEndStyle={tapeEndStyle}
            tapePattern={tapePreset.pattern}
            tapePatternAccent={tapePreset.accent ?? "#ffffff"}
            tapeOpacity={tapeOpacity}
            penStyleId={penStyleId}
            penStrokeWidth={penStrokeWidth}
            onGuardQuotaAdd={guardAdd}
            onQuotaBlocked={() => showToast(limitMessage)}
            onRequestSelectMode={() => setMode("select")}
            onEditText={setEditingTextId}
            onStartPhotoCrop={handleStartCrop}
            onContextMenuRequest={handleContextMenuRequest}
            interactionLockId={colorEditPhotoId}
            instagramExportActive={instagramExport.active}
            onEngineReady={setPixiEngine}
            stageOverlay={
              instagramExport.active ? (
                <WallInstagramExportChrome
                  session={instagramExport}
                  viewport={instagramViewport}
                  wallBounds={wallBounds}
                  themeId={themeId}
                  objects={sceneObjects}
                  wallStageRef={wallStageRef}
                  konvaStageRef={konvaStageRef}
                  onToast={showToast}
                  placement="stage"
                />
              ) : null
            }
            readOnly={!isEditor}
            {...konvaCropProps}
          />

          {instagramExport.active && (
            <WallInstagramExportChrome
              session={instagramExport}
              viewport={instagramViewport}
              wallBounds={wallBounds}
              themeId={themeId}
              objects={sceneObjects}
              wallStageRef={wallStageRef}
              konvaStageRef={konvaStageRef}
              onToast={showToast}
              placement="toolbar"
            />
          )}

          {!isEditor && (
            <div className="absolute left-1/2 top-3 z-40 flex max-w-[min(92vw,420px)] -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-3 py-2 text-xs text-background shadow-lg sm:text-sm">
              <span className="pl-1">다른 기기에서 편집 중이에요</span>
              <button
                type="button"
                onClick={() => void handleReclaimEditor()}
                className="shrink-0 rounded-full bg-background px-3 py-1 text-xs font-medium text-foreground"
              >
                여기서 다시 편집
              </button>
            </div>
          )}

          {editingTextObject && mode === "select" && (
            <div className="md:hidden">
              <TextStyleBar object={editingTextObject} onClose={() => setEditingTextId(null)} />
            </div>
          )}

          {selectedIds.length > 0 &&
            (mode === "select" || mode === "hand") &&
            !editingTextObject &&
            !cropPhotoId &&
            !colorEditPhotoId &&
            !instagramExport.active && (
              <EditorSelectionSheet
                object={inspectorObject}
                selectionCount={selectedIds.length}
                onClose={() => useWallSceneStore.getState().clearSelection()}
                onCopy={handleCopy}
                onPaste={handlePaste}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onBringForward={handleBringForward}
                onSendBackward={handleSendBackward}
                onBringToFront={handleBringToFront}
                onSendToBack={handleSendToBack}
                onAlignLeft={handleAlignLeft}
                onAlignCenterH={handleAlignCenterH}
                onAlignRight={handleAlignRight}
                onAlignTop={handleAlignTop}
                onAlignMiddle={handleAlignMiddle}
                onAlignBottom={handleAlignBottom}
                onCenterOnWall={handleCenterOnWall}
                canAlign={selectedIds.length >= 2}
                onSelectAll={handleSelectAll}
                onNudge={nudgeSelection}
                onStartCrop={
                  inspectorObject?.type === "photo" ? handleStartCrop : undefined
                }
                onStartColorEdit={
                  inspectorObject?.type === "photo" ? handleStartColorEdit : undefined
                }
                onUpscalePhoto={
                  inspectorObject?.type === "photo"
                    ? (id) => void handleUpscalePhoto(id)
                    : undefined
                }
                upscaleBusy={upscaleBusy}
                onToast={showToast}
                onBringOntoWall={handleBringOntoWall}
              />
            )}

          {cropPhotoId && (
            <PhotoCropToolbar
              aspectPreset={cropAspectPreset}
              onAspectChange={setCropAspectPreset}
              onApply={handleCropApply}
              onCancel={handleCropCancel}
              onReset={handleCropReset}
              canReset={canResetCrop}
              showRecoveryHint={canResetCrop}
            />
          )}

          {colorEditPhoto && (
            <PhotoColorToolbar
              photoSrc={colorEditPhoto.src}
              resolvePhotoSrc={resolvePhotoSrc}
              params={colorParams}
              onParamsChange={setColorParams}
              busy={colorBusy}
              errorMessage={colorError}
              onCancel={handleColorCancel}
              onApply={() => {
                void handleColorApply({
                  wallId,
                  userId: user?.id,
                  plan: wallPlan,
                  resolvePhotoSrc,
                }).then((ok) => {
                  if (ok) showToast("색 보정을 적용했어요");
                });
              }}
            />
          )}

          <div className="md:hidden">
            <EditorToolDock
              mode={mode}
              onModeChange={handleModeChange}
              onOpenDecorate={() => setIsAssetsOpen(true)}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              penColor={penColor}
              penStyleId={penStyleId}
              penStrokeWidth={penStrokeWidth}
              tapePresetId={tapePreset.id}
              tapeEndStyle={tapeEndStyle}
              tapeStrokeWidth={tapeStrokeWidth}
              tapeOpacity={tapeOpacity}
              onPenColorChange={setPenColor}
              onPenStyleIdChange={setPenStyleId}
              onPenStrokeWidthChange={setPenStrokeWidth}
              onTapePresetChange={handleTapePresetChange}
              onTapeEndStyleChange={setTapeEndStyle}
              onTapeStrokeWidthChange={setTapeStrokeWidth}
              onTapeOpacityChange={setTapeOpacity}
            />
          </div>

          <GuestSaveBanner hasObjects={sceneObjects.length > 0} />

          {saveMessage && (
            <div
              className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg"
              style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
            >
              {saveMessage}
            </div>
          )}

          {(!isReady || isCloudSyncing) && (
            <WallLoadingOverlay
              mode="overlay"
              title={isCloudSyncing ? "내 벽 불러오는 중..." : "편집 화면 준비 중..."}
            />
          )}
        </div>

        <div className="hidden md:flex">
          <EditorPropertiesSidebar
            mode={mode}
            inspectorObject={inspectorObject}
            editingTextObject={editingTextObject}
            cropActive={!!cropPhotoId}
            colorEditActive={!!colorEditPhotoId}
            onStartCrop={handleStartCrop}
            onStartColorEdit={handleStartColorEdit}
            onUpscalePhoto={(id) => void handleUpscalePhoto(id)}
            upscaleBusy={upscaleBusy}
            onCloseSelection={() => useWallSceneStore.getState().clearSelection()}
            onCloseTextEdit={() => setEditingTextId(null)}
            penColor={penColor}
            penStyleId={penStyleId}
            penStrokeWidth={penStrokeWidth}
            tapePresetId={tapePreset.id}
            tapeEndStyle={tapeEndStyle}
            tapeStrokeWidth={tapeStrokeWidth}
            tapeOpacity={tapeOpacity}
            onPenColorChange={setPenColor}
            onPenStyleIdChange={setPenStyleId}
            onPenStrokeWidthChange={setPenStrokeWidth}
            onTapePresetChange={handleTapePresetChange}
            onTapeEndStyleChange={setTapeEndStyle}
            onTapeStrokeWidthChange={setTapeStrokeWidth}
            onTapeOpacityChange={setTapeOpacity}
            selectionCount={selectedIds.length}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
            canAlignSelection={selectedIds.length >= 2}
            canDistributeSelection={selectedIds.length >= 3}
            canGroupSelection={canGroupSelection(selectedIds)}
            canUngroupSelection={selectionHasGroup(selectedIds, sceneObjects)}
            onSelectAll={handleSelectAll}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            onAlignLeft={handleAlignLeft}
            onAlignCenterH={handleAlignCenterH}
            onAlignRight={handleAlignRight}
            onAlignTop={handleAlignTop}
            onAlignMiddle={handleAlignMiddle}
            onAlignBottom={handleAlignBottom}
            onCenterOnWall={handleCenterOnWall}
            onDistributeHorizontal={onDistributeHorizontal}
            onDistributeVertical={onDistributeVertical}
            onFlipHorizontal={onFlipHorizontal}
            onFlipVertical={onFlipVertical}
            onToggleGrid={toggleShowGrid}
            onToggleSnapToGrid={toggleSnapToGrid}
            onClear={handleClear}
          />
        </div>
      </div>

      <WallContextMenu
        isOpen={isContextMenuOpen}
        position={contextMenuPosition}
        sections={contextMenuSections}
        onClose={closeContextMenu}
      />

      <EditorAssetsPanel
        variant="drawer"
        isOpen={isAssetsOpen}
        onClose={() => setIsAssetsOpen(false)}
        themeId={themeId}
        onThemeChange={handleThemeChange}
        onPhotoUpload={handlePhotoUpload}
        onAddSticker={handleAddSticker}
        returnTo="/wall/edit"
      />
    </div>
  );
}
