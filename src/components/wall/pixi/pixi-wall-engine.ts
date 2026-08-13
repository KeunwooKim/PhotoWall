import "./pixi-csp";
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  Rectangle,
  TilingSprite,
  FederatedPointerEvent,
} from "pixi.js";
import { Viewport } from "pixi-viewport";
import { pixiResolutionCap, maxDisplayTextureEdge } from "@/lib/pixi-device";
import { loadDisplayBitmap } from "@/lib/wall-scene/load-display-texture";
import { wrapPixiContainer } from "@/lib/wall-scene/realtime/wrap-pixi-node";
import {
  registerWallNode,
  setWallNodeDragging,
} from "@/lib/wall-scene/realtime/wall-node-sync";
import {
  applyGroupDrag,
  beginGroupDrag,
  commitGroupDrag,
} from "@/lib/wall-scene/group-drag";
import { applyDragSnapToNode, beginDragSnap, clearDragSnapGuides } from "@/lib/wall-scene/drag-snap";
import { createLivePatchBroadcaster } from "@/lib/wall-scene/realtime/live-object-patch";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import {
  registerPixiDragOffsetSync,
  registerLiveWallBoundsApplier,
  setLiveContentShiftMode,
  type LiveWallLayout,
  getEffectiveWallBounds,
} from "@/lib/wall-scene/wall-drag-expand";
import { getStickerById } from "@/lib/stickers";
import {
  computeSlice9Rects,
  cssHexToNumber,
  filmSprocketRects,
  getFramePatternCanvas,
  getPhotoFrame,
  getPhotoFrameInset,
  getPhotoFrameOuterSize,
  getPhotoTransformerBox,
} from "@/lib/photo-frames";
import { coverBlitRects, fourCutHolesInPhoto, getFourCutSkin } from "@/lib/four-cut";
import { getPenStyle, resolvePenShadowBlur } from "@/lib/wall-scene/pen";
import {
  HIGHLIGHTER_OPACITY,
  HIGHLIGHTER_STROKE_WIDTH,
  isStraightHighlighterPath,
  linePointsToHighlighterRect,
} from "@/lib/wall-scene/highlighter";
import {
  buildTapePatternDrawList,
  buildTapePolygon,
} from "@/lib/wall-scene/tape-geometry";
import {
  DEFAULT_TAPE_END_STYLE,
  DEFAULT_TAPE_PATTERN,
} from "@/lib/wall-scene/tape-style";
import { isMoveOnlyObject, isTransformableObject } from "@/lib/wall-scene/selectable-objects";
import { selectionStrokeWallPx } from "@/lib/wall-scene/selection-chrome";
import { hardClampObjectPositionToWall } from "@/lib/wall-scene/clamp-object-to-wall";
import { primarySelectedId } from "@/lib/wall-scene/selection-utils";
import { getSceneObjectExtents, wallpaperDisplayOffset } from "@/lib/wall-bounds";
import {
  applyWallCameraToPixiViewport,
  applyWallCameraZoomClamp,
  camerasNear,
  readWallCameraFromPixiViewport,
} from "@/lib/wall-scene/pixi-viewport-camera";
import { clampUserZoom } from "@/lib/wall-scene/viewport-zoom";
import type { WallViewportSnapshot } from "@/lib/wall-scene/wall-viewport-storage";
import { clampUniformScaleFactor, clampObjectScalePair } from "@/lib/wall-scene/object-scale";
import {
  bakeTextTransformScale,
  TEXT_BOX_MIN_FONT_SIZE,
  TEXT_BOX_MIN_WIDTH,
} from "@/lib/wall-scene/bake-text-transform";
import { debounce } from "@/lib/debounce";
import { cullObjectsForViewport } from "@/lib/wall-scene/viewport-culling";
import { isAnyWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import { estimateTextBlockHeight } from "@/lib/wall-scene/text-content";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type {
  WallSceneObject,
  WallScenePhoto,
  WallScenePath,
  WallSceneText,
  WallSceneEmoji,
  WallSceneTape,
  WallSceneSticker,
} from "@/types/wall-scene-v2";

const DEG = Math.PI / 180;
/** Corner handle visual size in screen pixels (zoom/object-scale independent). */
const HANDLE_SCREEN_PX = 12;
/** Touch/pointer hit padding beyond the visual mark (screen px). */
const HANDLE_HIT_SCREEN_PX = 28;
/** Rotate knob radius in screen pixels. */
const ROTATE_KNOB_SCREEN_PX = 6;
const ROTATE_OFFSET_SCREEN_PX = 22;

type TransformMode = "scale" | "rotate" | "text-width" | "text-height";
type TransformEdge = "e" | "w" | "n" | "s";

/** Pixi extract may return OffscreenCanvas (no toDataURL) — normalize to a data URL. */
function canvasLikeToDataUrl(
  canvas: { width: number; height: number; toDataURL?: (type?: string, quality?: number) => string },
  mimeType: string,
): string {
  if (typeof canvas.toDataURL === "function") {
    return canvas.toDataURL(mimeType);
  }
  const html = document.createElement("canvas");
  html.width = Math.max(1, canvas.width);
  html.height = Math.max(1, canvas.height);
  const ctx = html.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(canvas as CanvasImageSource, 0, 0);
  return html.toDataURL(mimeType);
}

export type PixiStageExport = {
  width: () => number;
  height: () => number;
  toDataURL: (config?: {
    pixelRatio?: number;
    mimeType?: string;
    frame?: { x: number; y: number; width: number; height: number };
  }) => string;
  /** Ensure every scene object is built and visible before preview capture. */
  prepareFullExport?: () => Promise<void>;
};

type EngineOptions = {
  host: HTMLElement;
  wallX: number;
  wallY: number;
  wallWidth: number;
  wallHeight: number;
  readOnly: boolean;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  onSelect: (id: string, additive?: boolean) => void;
  onClearSelection: () => void;
  /** Empty wall background press in world coords (select marquee starts here). */
  onBackgroundPointerDown?: (x: number, y: number, shiftKey: boolean) => void;
  onReady?: () => void;
  onPointerMove?: (x: number, y: number) => void;
  onManipulationChange?: (active: boolean) => void;
  onEditText?: (objectId: string) => void;
  onStartPhotoCrop?: (objectId: string) => void;
  onObjectPatch?: (id: string, patch: { x?: number; y?: number; rotation?: number; scaleX?: number; scaleY?: number }) => void;
};

type ObjectEntry = {
  root: Container;
  objectId: string;
  type: WallSceneObject["type"];
};

/**
 * Imperative Pixi wall engine — viewport-sized WebGL canvas, wall-sized world.
 */
export class PixiWallEngine {
  readonly app: Application;
  readonly viewport: Viewport;
  readonly world: Container;
  readonly objectsLayer: Container;
  readonly overlayLayer: Container;
  private readonly entries = new Map<string, ObjectEntry>();
  private readonly textures = new Map<string, Texture>();
  private readonly textureMeta = new Map<
    string,
    { naturalWidth: number; naturalHeight: number; displayWidth: number; displayHeight: number }
  >();
  private readonly options: EngineOptions;
  private transformer = new Container();
  private selectedIds: string[] = [];
  private selectedId: string | null = null;
  private dragState: {
    id: string;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null = null;
  private transformState: {
    id: string;
    mode: TransformMode;
    edge: TransformEdge | null;
    peers: Array<{
      id: string;
      startX: number;
      startY: number;
      startScaleX: number;
      startScaleY: number;
      startRotation: number;
      baseWidth: number;
      baseHeight: number;
    }>;
    centerX: number;
    centerY: number;
    startDist: number;
    startAngle: number;
    width: number;
    height: number;
  } | null = null;
  private liveBroadcast = createLivePatchBroadcaster();
  private destroyed = false;
  private wallX: number;
  private wallY: number;
  private wallWidth: number;
  private wallHeight: number;
  /** fit scale baseline — used to derive userZoom for persistence. */
  private fitScaleBaseline = 1;
  private suppressCameraSync = false;
  private viewportChangeHandler: (() => void) | null = null;
  private cameraPersistHandler: ((camera: WallViewportSnapshot) => void) | null = null;
  /** Last pointer world position — used to rebind drag offset after west/north expand. */
  private lastWorldPointer: { x: number; y: number } | null = null;
  /** Select mode: objects accept pointer. Hand/draw modes: false. */
  private objectsInteractive = true;
  wallpaperSprite: TilingSprite | null = null;

  private wallBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.wallX,
      y: this.wallY,
      width: this.wallWidth,
      height: this.wallHeight,
    };
  }

  private constructor(app: Application, viewport: Viewport, options: EngineOptions) {
    this.app = app;
    this.viewport = viewport;
    this.options = options;
    this.wallX = options.wallX;
    this.wallY = options.wallY;
    this.wallWidth = options.wallWidth;
    this.wallHeight = options.wallHeight;
    this.world = new Container();
    this.objectsLayer = new Container();
    this.overlayLayer = new Container();
    this.world.addChild(this.objectsLayer);
    this.world.addChild(this.overlayLayer);
    this.overlayLayer.addChild(this.transformer);
    this.transformer.eventMode = "static";
    viewport.addChild(this.world);

    registerPixiDragOffsetSync(() => this.syncDragOffset());
    setLiveContentShiftMode("deferred");
    registerLiveWallBoundsApplier((layout) => this.applyLiveLayout(layout));
    this.bindViewportBackground();
    this.bindViewportCameraSync();
    viewport.on("zoomed", () => this.rebuildTransformer());
    viewport.on("drag-start", () => {
      this.app.canvas.style.cursor = "grabbing";
    });
    viewport.on("drag-end", () => {
      // ignorePaused=true → null when drag plugin is paused (select mode)
      if (this.viewport.plugins.get("drag", true)) {
        this.app.canvas.style.cursor = "grab";
      }
    });
    options.onReady?.();
  }

  static async create(options: EngineOptions): Promise<PixiWallEngine> {
    const app = new Application();
    const resolution = pixiResolutionCap();
    await app.init({
      resizeTo: options.host,
      backgroundAlpha: 0,
      antialias: true,
      resolution,
      autoDensity: true,
      preference: "webgl",
      eventMode: "static",
    });
    options.host.appendChild(app.canvas);

    const viewport = new Viewport({
      events: app.renderer.events,
      screenWidth: options.host.clientWidth || 390,
      screenHeight: options.host.clientHeight || 600,
      worldWidth: options.wallWidth,
      worldHeight: options.wallHeight,
    });
    viewport
      .drag({ mouseButtons: "all", keyToPress: null })
      .pinch()
      .wheel({ smooth: 3 })
      .decelerate();
    // Hand tool resumes drag; select mode needs left-click for objects.
    viewport.plugins.pause("drag");
    app.stage.addChild(viewport);
    const store = useWallSceneStore.getState();
    const fitScale = applyWallCameraToPixiViewport(
      viewport,
      {
        x: options.wallX,
        y: options.wallY,
        width: options.wallWidth,
        height: options.wallHeight,
      },
      {
        userZoom: store.userZoom,
        panX: store.panX,
        panY: store.panY,
      },
    );

    const engine = new PixiWallEngine(app, viewport, options);
    engine.fitScaleBaseline = fitScale;
    store.setViewportScale(fitScale * clampUserZoom(store.userZoom));
    return engine;
  }

  /** Apply store/localStorage camera (zoom reset, re-entry restore). */
  applyStoreCamera(camera: WallViewportSnapshot): void {
    this.suppressCameraSync = true;
    try {
      this.fitScaleBaseline = applyWallCameraToPixiViewport(
        this.viewport,
        this.wallBounds(),
        camera,
      );
      this.rebuildTransformer();
      const store = useWallSceneStore.getState();
      store.setViewportScale(this.fitScaleBaseline * clampUserZoom(camera.userZoom));
    } finally {
      this.suppressCameraSync = false;
    }
  }

  readCamera(): WallViewportSnapshot {
    return readWallCameraFromPixiViewport(
      this.viewport,
      this.wallBounds(),
      this.fitScaleBaseline,
    );
  }

  /** Push live Pixi viewport → Zustand (call before unmount save). */
  flushCameraToStore(): WallViewportSnapshot {
    const camera = this.readCamera();
    useWallSceneStore.getState().setCamera(camera);
    return camera;
  }

  setCameraPersistHandler(handler: ((camera: WallViewportSnapshot) => void) | null): void {
    this.cameraPersistHandler = handler;
  }

  private bindViewportCameraSync(): void {
    const sync = () => {
      if (this.suppressCameraSync || this.destroyed) return;
      const camera = readWallCameraFromPixiViewport(
        this.viewport,
        this.wallBounds(),
        this.fitScaleBaseline,
      );
      const store = useWallSceneStore.getState();
      if (
        camerasNear(camera, {
          userZoom: store.userZoom,
          panX: store.panX,
          panY: store.panY,
        })
      ) {
        this.cameraPersistHandler?.(camera);
        return;
      }
      store.setCamera(camera);
      const viewportScale = this.fitScaleBaseline * camera.userZoom;
      if (Math.abs(store.viewportScale - viewportScale) > 0.001) {
        store.setViewportScale(viewportScale);
      }
      this.cameraPersistHandler?.(camera);
    };
    this.viewport.on("zoomed", sync);
    this.viewport.on("moved", sync);
    this.viewport.on("drag-end", sync);

    const notifyCull = debounce(() => {
      if (this.destroyed) return;
      this.viewportChangeHandler?.();
    }, 32);
    this.viewport.on("zoomed", notifyCull);
    this.viewport.on("moved", notifyCull);
    this.viewport.on("drag-end", notifyCull);
  }

  setViewportChangeHandler(handler: (() => void) | null): void {
    this.viewportChangeHandler = handler;
  }

  private visibleObjectIds(objects: WallSceneObject[]): Set<string> {
    if (isAnyWallNodeDragging() || this.dragState || this.transformState) {
      return new Set(objects.map((o) => o.id));
    }
    const bounds = this.viewport.getVisibleBounds();
    const culled = cullObjectsForViewport(objects, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
    const ids = new Set(culled.map((o) => o.id));
    for (const id of this.selectedIds) ids.add(id);
    return ids;
  }

  getExportAdapter(): PixiStageExport {
    return {
      width: () => this.wallWidth,
      height: () => this.wallHeight,
      prepareFullExport: async () => {
        if (this.destroyed) return;
        const objects = useWallSceneStore.getState().document.objects;
        const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);
        for (const object of sorted) {
          if (this.destroyed) return;
          await this.upsertObject(object);
          const entry = this.entries.get(object.id);
          if (entry) entry.root.visible = true;
        }
        // Force a render so extract sees updated textures.
        this.app.renderer.render(this.app.stage);
      },
      toDataURL: (config) => {
        if (this.destroyed) return "data:,";
        const pixelRatio = Math.min(
          2,
          Math.max(0.25, config?.pixelRatio ?? 1),
        );
        const prevTransformer = this.transformer.visible;
        const prevVisible = new Map<string, boolean>();
        for (const [id, entry] of this.entries) {
          prevVisible.set(id, entry.root.visible);
          entry.root.visible = true;
        }
        this.transformer.visible = false;
        const frame = config?.frame
          ? new Rectangle(
              config.frame.x,
              config.frame.y,
              config.frame.width,
              config.frame.height,
            )
          : new Rectangle(this.wallX, this.wallY, this.wallWidth, this.wallHeight);
        try {
          const extracted = this.app.renderer.extract.canvas({
            target: this.world,
            frame,
            resolution: pixelRatio,
            clearColor: [0, 0, 0, 0],
          });
          return canvasLikeToDataUrl(
            extracted,
            config?.mimeType ?? "image/png",
          );
        } finally {
          this.transformer.visible = prevTransformer;
          for (const [id, wasVisible] of prevVisible) {
            const entry = this.entries.get(id);
            if (entry) entry.root.visible = wasVisible;
          }
        }
      },
    };
  }

  private resizeWorldBounds(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): void {
    if (
      bounds.x === this.wallX &&
      bounds.y === this.wallY &&
      bounds.width === this.wallWidth &&
      bounds.height === this.wallHeight
    ) {
      return;
    }
    // Keep the viewport transform — resize must not re-center or jump the view.
    const posX = this.viewport.position.x;
    const posY = this.viewport.position.y;
    const scaleX = this.viewport.scale.x;
    const scaleY = this.viewport.scale.y;

    this.wallX = bounds.x;
    this.wallY = bounds.y;
    this.wallWidth = bounds.width;
    this.wallHeight = bounds.height;
    this.viewport.resize(
      this.options.host.clientWidth || 390,
      this.options.host.clientHeight || 600,
      bounds.width,
      bounds.height,
    );
    this.viewport.position.set(posX, posY);
    this.viewport.scale.set(scaleX, scaleY);
    applyWallCameraZoomClamp(this.viewport, bounds);

    if (this.wallpaperSprite) {
      this.wallpaperSprite.position.set(bounds.x, bounds.y);
      this.wallpaperSprite.width = bounds.width;
      this.wallpaperSprite.height = bounds.height;
      const decorative =
        useWallSceneStore.getState().document.meta.wallpaperOffset ?? { x: 0, y: 0 };
      const tile = wallpaperDisplayOffset(bounds, decorative);
      this.wallpaperSprite.tilePosition.x = tile.x;
      this.wallpaperSprite.tilePosition.y = tile.y;
    }
  }

  /** Update wall AABB only — never moves the camera (expand/shrink stay world-locked). */
  setWallSize(width: number, height: number, x?: number, y?: number): void {
    this.resizeWorldBounds({
      x: x ?? this.wallX,
      y: y ?? this.wallY,
      width,
      height,
    });
    this.rebuildTransformer();
  }

  /**
   * Live / committed wall layout from wall-drag-expand.
   * World-locked: only AABB + wallpaper update; camera stays put.
   */
  applyLiveLayout(layout: LiveWallLayout): void {
    this.resizeWorldBounds(layout.bounds);

    if (this.wallpaperSprite) {
      const decorative = { x: layout.wallpaperOffsetX, y: layout.wallpaperOffsetY };
      const tile = wallpaperDisplayOffset(layout.bounds, decorative);
      this.wallpaperSprite.tilePosition.x = tile.x;
      this.wallpaperSprite.tilePosition.y = tile.y;
    }

    this.rebuildTransformer();
  }

  resize(): void {
    const camera = this.readCamera();
    this.viewport.resize(
      this.options.host.clientWidth || 390,
      this.options.host.clientHeight || 600,
      this.wallWidth,
      this.wallHeight,
    );
    this.applyStoreCamera(camera);
    useWallSceneStore.getState().setCamera(camera);
    this.cameraPersistHandler?.(camera);
  }

  setPanZoomEnabled(enabled: boolean): void {
    const canvas = this.app.canvas;
    if (enabled) {
      this.viewport.plugins.resume("drag");
      this.viewport.plugins.resume("pinch");
      this.viewport.plugins.resume("wheel");
      canvas.style.cursor = "grab";
    } else {
      this.viewport.plugins.pause("drag");
      this.viewport.plugins.pause("pinch");
      this.viewport.plugins.resume("wheel");
      canvas.style.cursor = "";
    }
  }

  /**
   * When false (hand / draw / text modes), objects ignore pointer so pan/draw
   * cannot accidentally drag them.
   */
  setObjectsInteractive(enabled: boolean): void {
    this.objectsInteractive = enabled;
    if (!enabled) {
      // Cancel an in-progress object drag if the mode switched mid-gesture.
      if (this.dragState) {
        const entry = this.entries.get(this.dragState.id);
        if (entry) {
          setWallNodeDragging(this.dragState.id, false);
          entry.root.cursor = enabled ? "grab" : "default";
        }
        this.dragState = null;
        this.options.onManipulationChange?.(false);
      }
      this.clearSelectionVisual();
    }
    for (const entry of this.entries.values()) {
      entry.root.eventMode = enabled ? "static" : "none";
      entry.root.cursor = enabled ? "grab" : "default";
    }
  }

  private clearSelectionVisual(): void {
    this.selectedIds = [];
    this.selectedId = null;
    this.rebuildTransformer();
  }

  setSelectedIds(ids: string[]): void {
    this.selectedIds = [...ids];
    this.selectedId = primarySelectedId(ids);
    this.rebuildTransformer();
  }

  /** Hide/show an object (e.g. while HTML crop overlay covers it). */
  setObjectHidden(id: string, hidden: boolean): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.root.visible = !hidden;
    if (hidden && this.selectedId === id) {
      this.clearSelectionVisual();
    }
  }

  async syncObjects(objects: WallSceneObject[]): Promise<void> {
    const keep = new Set(objects.map((o) => o.id));
    for (const [id, entry] of [...this.entries]) {
      if (keep.has(id)) continue;
      registerWallNode(id, null);
      entry.root.destroy({ children: true });
      this.entries.delete(id);
    }

    const visible = this.visibleObjectIds(objects);
    const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);
    for (const object of sorted) {
      // Always build/update entries so leave/share preview export includes
      // off-screen objects; only toggle visibility for viewport culling.
      await this.upsertObject(object);
      const entry = this.entries.get(object.id);
      if (entry) entry.root.visible = visible.has(object.id);
    }
    this.rebuildTransformer();
  }

  private bindViewportBackground(): void {
    this.viewport.eventMode = "static";
    this.viewport.on("pointerdown", (e: FederatedPointerEvent) => {
      const local = this.viewport.toWorld(e.global);
      this.options.onPointerMove?.(local.x, local.y);
      // Empty background only — object/transformer targets handle their own presses.
      if (e.target !== this.viewport && e.target !== this.world) return;
      if (this.options.readOnly) return;
      if (this.options.onBackgroundPointerDown) {
        this.options.onBackgroundPointerDown(local.x, local.y, e.shiftKey);
      } else {
        this.options.onClearSelection();
      }
    });
    this.viewport.on("pointermove", (e: FederatedPointerEvent) => {
      const local = this.viewport.toWorld(e.global);
      this.options.onPointerMove?.(local.x, local.y);
      this.onPointerMove(e);
    });
    this.viewport.on("pointerup", (e: FederatedPointerEvent) => this.onPointerUp(e));
    this.viewport.on("pointerupoutside", (e: FederatedPointerEvent) => this.onPointerUp(e));
  }

  private async upsertObject(object: WallSceneObject): Promise<void> {
    if (object.type === "svg") return;
    let entry = this.entries.get(object.id);
    if (!entry) {
      const root = new Container();
      root.eventMode =
        this.options.readOnly || !this.objectsInteractive ? "none" : "static";
      root.cursor =
        this.options.readOnly || !this.objectsInteractive ? "default" : "grab";
      root.label = object.id;
      this.objectsLayer.addChild(root);
      entry = { root, objectId: object.id, type: object.type };
      this.entries.set(object.id, entry);
      registerWallNode(object.id, wrapPixiContainer(root, object.id));
      this.bindObjectPointer(entry);
    }

    const { root } = entry;
    if (!this.dragState || this.dragState.id !== object.id) {
      if (!this.transformState || this.transformState.id !== object.id) {
        root.x = object.x;
        root.y = object.y;
        root.rotation = object.rotation * DEG;
        root.scale.set(object.scaleX, object.scaleY);
      }
    }
    root.alpha = object.opacity ?? 1;
    root.zIndex = object.zIndex;
    this.objectsLayer.sortableChildren = true;

    root.removeChildren();
    switch (object.type) {
      case "photo":
        await this.buildPhoto(root, object);
        break;
      case "sticker":
        await this.buildSticker(root, object);
        break;
      case "emoji":
        this.buildEmoji(root, object);
        break;
      case "text":
        this.buildText(root, object);
        break;
      case "tape":
        this.buildTape(root, object);
        break;
      case "path":
        this.buildPath(root, object);
        break;
      default:
        break;
    }
  }

  private async resolveSrc(src: string): Promise<string> {
    if (this.options.resolvePhotoSrc) {
      try {
        return await this.options.resolvePhotoSrc(src);
      } catch {
        return src;
      }
    }
    return src;
  }

  private async textureFor(src: string): Promise<Texture | null> {
    const resolved = await this.resolveSrc(src);
    const cached = this.textures.get(resolved);
    if (cached) return cached;
    try {
      const bitmap = await loadDisplayBitmap(resolved, maxDisplayTextureEdge());
      const texture = Texture.from(bitmap.canvas);
      this.textures.set(resolved, texture);
      this.textureMeta.set(resolved, {
        naturalWidth: bitmap.naturalWidth,
        naturalHeight: bitmap.naturalHeight,
        displayWidth: bitmap.displayWidth,
        displayHeight: bitmap.displayHeight,
      });
      return texture;
    } catch {
      return null;
    }
  }

  private async buildPhoto(root: Container, object: WallScenePhoto): Promise<void> {
    if (await this.buildFourCutSkinnedPhoto(root, object)) return;

    const frame = getPhotoFrame(object.frameId);
    const inset = getPhotoFrameInset(object);
    const outer = getPhotoFrameOuterSize(object);

    if (frame && (inset.left || inset.top || inset.right || inset.bottom)) {
      const patternCanvas = frame.pattern ? getFramePatternCanvas(frame) : null;
      if (patternCanvas) {
        const tile = new TilingSprite({
          texture: Texture.from(patternCanvas),
          width: outer.width,
          height: outer.height,
        });
        tile.x = outer.offsetX;
        tile.y = outer.offsetY;
        root.addChild(tile);
      } else {
        const matte = new Graphics()
          .rect(outer.offsetX, outer.offsetY, outer.width, outer.height)
          .fill({ color: cssHexToNumber(frame.matteFill ?? "#ffffff") });
        root.addChild(matte);
      }
      if (frame.id === "frame.film") {
        for (const hole of filmSprocketRects(object, inset)) {
          const sprocket = new Graphics()
            .rect(hole.x, hole.y, hole.width, hole.height)
            .fill({ color: 0xd4d4d4 });
          root.addChild(sprocket);
        }
      }
    }

    const resolved = await this.resolveSrc(object.src);
    const texture = await this.textureFor(object.src);
    if (!texture) {
      const placeholder = new Graphics()
        .rect(0, 0, object.width, object.height)
        .fill({ color: 0xcccccc, alpha: 0.5 });
      root.addChild(placeholder);
    } else {
      let displayTexture = texture;
      if (object.crop) {
        const meta = this.textureMeta.get(resolved);
        if (meta) {
          const sx = meta.displayWidth / Math.max(1, meta.naturalWidth);
          const sy = meta.displayHeight / Math.max(1, meta.naturalHeight);
          const cropFrame = new Rectangle(
            Math.max(0, object.crop.x * sx),
            Math.max(0, object.crop.y * sy),
            Math.max(1, object.crop.width * sx),
            Math.max(1, object.crop.height * sy),
          );
          cropFrame.width = Math.min(cropFrame.width, Math.max(1, texture.width - cropFrame.x));
          cropFrame.height = Math.min(cropFrame.height, Math.max(1, texture.height - cropFrame.y));
          displayTexture = new Texture({
            source: texture.source,
            frame: cropFrame,
            dynamic: true,
          });
        }
      }
      const sprite = new Sprite(displayTexture);
      sprite.width = object.width;
      sprite.height = object.height;
      root.addChild(sprite);
    }

    if (frame?.kind === "slice9" && frame.src && frame.slice9) {
      const sliceTexture = await this.textureFor(frame.src);
      if (sliceTexture) {
        const rects = computeSlice9Rects(
          sliceTexture.width,
          sliceTexture.height,
          outer,
          frame.slice9,
        );
        for (const rect of rects) {
          const piece = new Texture({
            source: sliceTexture.source,
            frame: new Rectangle(rect.sx, rect.sy, rect.sw, rect.sh),
            dynamic: true,
          });
          const sliceSprite = new Sprite(piece);
          sliceSprite.x = rect.dx;
          sliceSprite.y = rect.dy;
          sliceSprite.width = rect.dw;
          sliceSprite.height = rect.dh;
          root.addChild(sliceSprite);
        }
      }
    } else if (frame?.kind === "overlay" && frame.src) {
      const overlay = await this.textureFor(frame.src);
      if (overlay) {
        const sprite = new Sprite(overlay);
        sprite.x = outer.offsetX;
        sprite.y = outer.offsetY;
        sprite.width = outer.width;
        sprite.height = outer.height;
        root.addChild(sprite);
      }
    }
  }

  private async buildFourCutSkinnedPhoto(
    root: Container,
    object: WallScenePhoto,
  ): Promise<boolean> {
    const fourCut = object.fourCut;
    const skin = getFourCutSkin(fourCut?.skinId);
    const dests = fourCutHolesInPhoto(object);
    if (!fourCut || !skin || !dests) return false;

    const matte = new Graphics()
      .rect(0, 0, object.width, object.height)
      .fill({ color: cssHexToNumber(skin.fill) });
    root.addChild(matte);

    const resolved = await this.resolveSrc(object.src);
    const texture = await this.textureFor(object.src);
    const meta = this.textureMeta.get(resolved);
    const sx = meta ? meta.displayWidth / Math.max(1, meta.naturalWidth) : 1;
    const sy = meta ? meta.displayHeight / Math.max(1, meta.naturalHeight) : 1;

    for (let i = 0; i < 4; i++) {
      const dest = dests[i];
      if (!texture) {
        const placeholder = new Graphics()
          .rect(dest.x, dest.y, dest.width, dest.height)
          .fill({ color: 0xcccccc, alpha: 0.5 });
        root.addChild(placeholder);
        continue;
      }
      const blit = coverBlitRects(fourCut.windows[i], dest);
      const cropFrame = new Rectangle(
        Math.max(0, blit.sx * sx),
        Math.max(0, blit.sy * sy),
        Math.max(1, blit.sw * sx),
        Math.max(1, blit.sh * sy),
      );
      cropFrame.width = Math.min(cropFrame.width, Math.max(1, texture.width - cropFrame.x));
      cropFrame.height = Math.min(cropFrame.height, Math.max(1, texture.height - cropFrame.y));
      const piece = new Texture({
        source: texture.source,
        frame: cropFrame,
        dynamic: true,
      });
      const sprite = new Sprite(piece);
      sprite.x = blit.dx;
      sprite.y = blit.dy;
      sprite.width = blit.dw;
      sprite.height = blit.dh;
      root.addChild(sprite);
    }

    if (skin.src) {
      const overlay = await this.textureFor(skin.src);
      if (overlay) {
        const sprite = new Sprite(overlay);
        sprite.width = object.width;
        sprite.height = object.height;
        root.addChild(sprite);
      }
    }
    return true;
  }

  private async buildSticker(root: Container, object: WallSceneSticker): Promise<void> {
    const def = getStickerById(object.stickerId);
    if (!def) {
      const g = new Graphics()
        .rect(0, 0, object.width, object.height)
        .fill({ color: 0xffaa88, alpha: 0.8 });
      root.addChild(g);
      return;
    }
    if (def.kind === "emoji") {
      const text = new Text({
        text: def.src,
        style: {
          fontSize: Math.min(object.width, object.height),
          fontFamily: "Apple Color Emoji, Segoe UI Emoji, sans-serif",
        },
      });
      root.addChild(text);
      return;
    }
    const texture = await this.textureFor(def.src);
    if (!texture) return;
    const sprite = new Sprite(texture);
    sprite.width = object.width;
    sprite.height = object.height;
    root.addChild(sprite);
  }

  private buildEmoji(root: Container, object: WallSceneEmoji): void {
    const text = new Text({
      text: object.text,
      style: { fontSize: object.fontSize, fontFamily: "Apple Color Emoji, Segoe UI Emoji, sans-serif" },
    });
    root.addChild(text);
  }

  private buildText(root: Container, object: WallSceneText): void {
    const text = new Text({
      text: object.text,
      style: {
        fontSize: object.fontSize,
        fontFamily: object.fontFamily || "sans-serif",
        fontWeight: object.fontWeight === "bold" ? "bold" : "normal",
        fill: object.fill || "#222",
        wordWrap: true,
        wordWrapWidth: object.width,
        breakWords: true,
        align: object.textAlign || "left",
        lineHeight: object.fontSize * 1.35,
      },
    });
    root.addChild(text);
  }

  private buildTape(root: Container, object: WallSceneTape): void {
    const color = Number.parseInt((object.fill || "#fff59d").replace("#", ""), 16) || 0xfff59d;
    const g = new Graphics()
      .rect(0, 0, object.width, object.height)
      .fill({ color, alpha: HIGHLIGHTER_OPACITY });
    root.addChild(g);
  }

  private buildPath(root: Container, object: WallScenePath): void {
    const pts = object.points;
    if (pts.length < 4) return;

    if (
      object.tool === "tape" ||
      (object.tool !== "pen" && isStraightHighlighterPath(pts))
    ) {
      this.buildTapePath(root, object);
      return;
    }

    const stroke = Number.parseInt((object.stroke || "#222").replace("#", ""), 16) || 0x222222;
    const style = object.penStyle ? getPenStyle(object.penStyle) : null;
    const g = new Graphics();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) {
      g.lineTo(pts[i], pts[i + 1]);
    }
    const alpha = style?.opacity ?? 1;
    g.stroke({
      width: object.strokeWidth,
      color: stroke,
      alpha,
      cap: "round",
      join: "round",
    });
    // Fat invisible hit area for thin pens
    const hit = new Graphics();
    hit.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) {
      hit.lineTo(pts[i], pts[i + 1]);
    }
    hit.stroke({ width: Math.max(24, object.strokeWidth * 3), color: 0xffffff, alpha: 0.001 });
    hit.eventMode = "static";
    root.addChild(g);
    root.addChild(hit);
    if (style) {
      const blur = resolvePenShadowBlur(style, object.strokeWidth);
      if (blur > 0) {
        // Pixi filters are heavier — skip shadow on iOS-like for memory
      }
    }
  }

  private buildTapePath(root: Container, object: WallScenePath): void {
    const pts = object.points;
    const x1 = pts[0];
    const y1 = pts[1];
    const x2 = pts[2];
    const y2 = pts[3];
    const height = object.strokeWidth || 16;
    const endStyle = object.tapeEndStyle ?? DEFAULT_TAPE_END_STYLE;
    const pattern = object.tapePattern ?? DEFAULT_TAPE_PATTERN;
    const polygon = buildTapePolygon(x1, y1, x2, y2, height, endStyle);
    if (!polygon || polygon.length < 6) return;

    const fill =
      Number.parseInt((object.stroke || "#fff59d").replace("#", ""), 16) || 0xfff59d;
    const accent =
      Number.parseInt((object.tapePatternAccent || "#ffffff").replace("#", ""), 16) ||
      0xffffff;
    const alpha = object.opacity ?? HIGHLIGHTER_OPACITY;

    const body = new Graphics();
    body.poly(polygon);
    body.fill({ color: fill, alpha });

    const decor = buildTapePatternDrawList(x1, y1, x2, y2, height, pattern);
    if (decor.strokes.length || decor.dots.length) {
      const mask = new Graphics();
      mask.poly(polygon);
      mask.fill({ color: 0xffffff });
      const overlay = new Graphics();
      for (const s of decor.strokes) {
        overlay.moveTo(s.x1, s.y1);
        overlay.lineTo(s.x2, s.y2);
        overlay.stroke({
          width: s.width,
          color: accent,
          alpha: alpha * 0.9,
          cap: "round",
        });
      }
      for (const d of decor.dots) {
        overlay.circle(d.x, d.y, d.r);
        overlay.fill({ color: accent, alpha: alpha * 0.95 });
      }
      overlay.mask = mask;
      root.addChild(body);
      root.addChild(mask);
      root.addChild(overlay);
    } else {
      root.addChild(body);
    }

    const hit = new Graphics();
    hit.poly(polygon);
    hit.fill({ color: 0xffffff, alpha: 0.001 });
    hit.eventMode = "static";
    root.addChild(hit);
  }

  private bindObjectPointer(entry: ObjectEntry): void {
    const { root, objectId } = entry;
    let lastTap = 0;

    root.on("pointerdown", (e: FederatedPointerEvent) => {
      if (this.options.readOnly || !this.objectsInteractive) return;
      e.stopPropagation();
      const additive = e.shiftKey;
      this.options.onSelect(objectId, additive);
      const world = this.viewport.toWorld(e.global);
      this.lastWorldPointer = { x: world.x, y: world.y };
      this.dragState = {
        id: objectId,
        pointerId: e.pointerId,
        offsetX: world.x - root.x,
        offsetY: world.y - root.y,
      };
      beginDragSnap(objectId);
      beginGroupDrag(objectId);
      setWallNodeDragging(objectId, true);
      this.options.onManipulationChange?.(true);
      root.cursor = "grabbing";

      const now = Date.now();
      if (now - lastTap < 350) {
        const obj = useWallSceneStore.getState().document.objects.find((o) => o.id === objectId);
        if (obj?.type === "photo") this.options.onStartPhotoCrop?.(objectId);
        if (obj?.type === "text") this.options.onEditText?.(objectId);
      }
      lastTap = now;
    });
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (this.transformState) {
      this.applyTransformMove(e);
      return;
    }
    if (!this.dragState || e.pointerId !== this.dragState.pointerId) return;
    const entry = this.entries.get(this.dragState.id);
    if (!entry) return;
    const world = this.viewport.toWorld(e.global);
    this.lastWorldPointer = { x: world.x, y: world.y };
    entry.root.x = world.x - this.dragState.offsetX;
    entry.root.y = world.y - this.dragState.offsetY;
    const display = wrapPixiContainer(entry.root, this.dragState.id);
    applyDragSnapToNode(display, this.dragState.id);
    applyGroupDrag(display, e.nativeEvent instanceof Event ? e.nativeEvent : undefined);
    this.liveBroadcast(this.dragState.id, { x: entry.root.x, y: entry.root.y });
    this.options.onObjectPatch?.(this.dragState.id, { x: entry.root.x, y: entry.root.y });
    this.rebuildTransformer();
  }

  private onPointerUp(e: FederatedPointerEvent): void {
    if (this.transformState) {
      this.commitTransform();
      return;
    }
    if (!this.dragState || e.pointerId !== this.dragState.pointerId) return;
    const entry = this.entries.get(this.dragState.id);
    if (entry) {
      clearDragSnapGuides();
      this.liveBroadcast.flush();
      commitGroupDrag(wrapPixiContainer(entry.root, this.dragState.id));
      setWallNodeDragging(this.dragState.id, false);
      this.options.onManipulationChange?.(false);
      entry.root.cursor = "grab";
    }
    this.dragState = null;
    this.rebuildTransformer();
  }

  private syncDragOffset(_evt?: Event): void {
    if (!this.dragState) return;
    const entry = this.entries.get(this.dragState.id);
    if (!entry) return;
    // After west/north content shift, node moved but grab offset is stale.
    // Rebind from the last known world pointer so the next move keeps finger lock.
    const world = this.lastWorldPointer;
    if (!world) return;
    this.dragState.offsetX = world.x - entry.root.x;
    this.dragState.offsetY = world.y - entry.root.y;
  }

  private selectionBox(
    object: WallSceneObject,
    scaleX: number,
    scaleY: number,
  ): { ox: number; oy: number; boxW: number; boxH: number } {
    if (object.type === "photo") {
      return getPhotoTransformerBox(object, scaleX, scaleY);
    }
    const { width, height } = this.objectSize(object);
    const boxW = Math.max(1, width * Math.abs(scaleX));
    const boxH = Math.max(1, height * Math.abs(scaleY));
    return {
      ox: scaleX < 0 ? -boxW : 0,
      oy: scaleY < 0 ? -boxH : 0,
      boxW,
      boxH,
    };
  }

  private objectSize(object: WallSceneObject): { width: number; height: number } {
    switch (object.type) {
      case "photo":
      case "sticker":
      case "tape":
        return { width: object.width, height: object.height };
      case "text":
        return { width: object.width, height: estimateTextBlockHeight(object) };
      case "emoji":
        return { width: object.fontSize, height: object.fontSize };
      case "path": {
        const pts = object.points;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < pts.length; i += 2) {
          minX = Math.min(minX, pts[i]);
          maxX = Math.max(maxX, pts[i]);
          minY = Math.min(minY, pts[i + 1]);
          maxY = Math.max(maxY, pts[i + 1]);
        }
        return {
          width: Math.max(24, maxX - minX),
          height: Math.max(24, maxY - minY),
        };
      }
      default:
        return { width: 40, height: 40 };
    }
  }

  private moveOnlySelectionFrame(
    object: WallSceneObject,
    root: Container,
    strokeW: number,
  ): Graphics | null {
    if (object.type === "tape") {
      const sx = root.scale.x;
      const sy = root.scale.y;
      const boxW = Math.max(1, object.width * Math.abs(sx));
      const boxH = Math.max(1, object.height * Math.abs(sy));
      const ox = sx < 0 ? -boxW : 0;
      const oy = sy < 0 ? -boxH : 0;
      const outline = new Graphics()
        .rect(ox, oy, boxW, boxH)
        .stroke({ width: strokeW, color: 0x3b82f6, alpha: 0.95 });
      outline.eventMode = "none";
      outline.x = root.x;
      outline.y = root.y;
      outline.rotation = root.rotation;
      return outline;
    }

    if (object.type === "path") {
      const strokeWidth = object.strokeWidth || HIGHLIGHTER_STROKE_WIDTH;
      const layout = linePointsToHighlighterRect(object.points, strokeWidth + 8);
      if (!layout) return null;
      const outline = new Graphics()
        .rect(0, -layout.height / 2, layout.width, layout.height)
        .stroke({ width: strokeW, color: 0x3b82f6, alpha: 0.95 });
      outline.eventMode = "none";
      outline.x = root.x + layout.x;
      outline.y = root.y + layout.y;
      outline.rotation = (layout.rotation * Math.PI) / 180 + root.rotation;
      return outline;
    }

    return null;
  }

  private rebuildTransformer(): void {
    this.transformer.removeChildren();
    this.transformer.position.set(0, 0);
    this.transformer.rotation = 0;
    this.transformer.scale.set(1, 1);
    if (this.options.readOnly || this.selectedIds.length === 0) return;

    const storeObjects = useWallSceneStore.getState().document.objects;
    const viewScale = Math.max(this.viewport.scale.x, 0.05);
    const strokeW = selectionStrokeWallPx(viewScale);

    const drawMoveOnlyFrame = (object: WallSceneObject, entry: { root: Container }) => {
      const frame = this.moveOnlySelectionFrame(object, entry.root, strokeW);
      if (frame) this.transformer.addChild(frame);
    };

    // Secondary selection outlines.
    for (const id of this.selectedIds) {
      if (id === this.selectedId) continue;
      const object = storeObjects.find((o) => o.id === id);
      const entry = this.entries.get(id);
      if (!object || !entry) continue;
      if (isMoveOnlyObject(object)) {
        drawMoveOnlyFrame(object, entry);
        continue;
      }
      if (!isTransformableObject(object)) continue;
      const { ox, oy, boxW, boxH } = this.selectionBox(
        object,
        entry.root.scale.x,
        entry.root.scale.y,
      );
      const outline = new Graphics()
        .rect(ox, oy, boxW, boxH)
        .stroke({ width: strokeW, color: 0x3b82f6, alpha: 0.75 });
      outline.eventMode = "none";
      outline.x = entry.root.x;
      outline.y = entry.root.y;
      outline.rotation = entry.root.rotation;
      this.transformer.addChild(outline);
    }

    if (!this.selectedId) return;
    const object = storeObjects.find((o) => o.id === this.selectedId);
    const entry = this.entries.get(this.selectedId);
    if (!object || !entry) return;

    // Tape / highlighter: move-only border (no resize / rotate handles).
    if (isMoveOnlyObject(object)) {
      drawMoveOnlyFrame(object, entry);
      return;
    }
    if (!isTransformableObject(object)) return;

    const { ox, oy, boxW, boxH } = this.selectionBox(
      object,
      entry.root.scale.x,
      entry.root.scale.y,
    );
    const { width, height } = this.objectSize(object);
    const hs = HANDLE_SCREEN_PX / viewScale;
    const hit = HANDLE_HIT_SCREEN_PX / viewScale;
    const rotR = ROTATE_KNOB_SCREEN_PX / viewScale;
    const rotOff = ROTATE_OFFSET_SCREEN_PX / viewScale;

    const group = new Container();
    group.x = entry.root.x;
    group.y = entry.root.y;
    group.rotation = entry.root.rotation;
    group.scale.set(1, 1);

    const box = new Graphics()
      .rect(ox, oy, boxW, boxH)
      .stroke({ width: strokeW, color: 0x3b82f6, alpha: 0.95 });
    box.eventMode = "none";
    group.addChild(box);

    const corners: Array<{ x: number; y: number }> = [
      { x: ox, y: oy },
      { x: ox + boxW, y: oy },
      { x: ox + boxW, y: oy + boxH },
      { x: ox, y: oy + boxH },
    ];

    const worldCenter = () => {
      const localCx = ox + boxW / 2;
      const localCy = oy + boxH / 2;
      const rad = entry.root.rotation;
      return {
        x: entry.root.x + localCx * Math.cos(rad) - localCy * Math.sin(rad),
        y: entry.root.y + localCx * Math.sin(rad) + localCy * Math.cos(rad),
      };
    };

    const beginTransform = (
      mode: TransformMode,
      world: { x: number; y: number },
      edge: TransformEdge | null = null,
    ) => {
      const peers: NonNullable<typeof this.transformState>["peers"] = [];
      const storeObjects = useWallSceneStore.getState().document.objects;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const id of this.selectedIds) {
        const obj = storeObjects.find((o) => o.id === id);
        const ent = this.entries.get(id);
        if (!obj || !ent || !isTransformableObject(obj)) continue;
        const size = this.objectSize(obj);
        peers.push({
          id,
          startX: ent.root.x,
          startY: ent.root.y,
          startScaleX: ent.root.scale.x,
          startScaleY: ent.root.scale.y,
          startRotation: ent.root.rotation / DEG,
          baseWidth: size.width,
          baseHeight: size.height,
        });
        const live = {
          ...obj,
          x: ent.root.x,
          y: ent.root.y,
          scaleX: ent.root.scale.x,
          scaleY: ent.root.scale.y,
          rotation: ent.root.rotation / DEG,
        } as WallSceneObject;
        const ext = getSceneObjectExtents(live);
        minX = Math.min(minX, ext.minX);
        minY = Math.min(minY, ext.minY);
        maxX = Math.max(maxX, ext.maxX);
        maxY = Math.max(maxY, ext.maxY);
        setWallNodeDragging(id, true);
      }

      if (peers.length === 0) return;

      const center =
        peers.length === 1
          ? worldCenter()
          : { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

      this.transformState = {
        id: this.selectedId!,
        mode,
        edge,
        peers,
        centerX: center.x,
        centerY: center.y,
        startDist: Math.hypot(world.x - center.x, world.y - center.y) || 1,
        startAngle: Math.atan2(world.y - center.y, world.x - center.x),
        width,
        height,
      };
      this.options.onManipulationChange?.(true);
    };

    const addHandle = (
      x: number,
      y: number,
      cursor: string,
      onDown: (world: { x: number; y: number }) => void,
    ) => {
      const handle = new Graphics();
      handle.rect(-hit / 2, -hit / 2, hit, hit).fill({ color: 0xffffff, alpha: 0.001 });
      handle
        .rect(-hs / 2, -hs / 2, hs, hs)
        .fill({ color: 0xffffff })
        .stroke({ width: strokeW, color: 0x3b82f6 });
      handle.x = x;
      handle.y = y;
      handle.eventMode = "static";
      handle.cursor = cursor;
      handle.on("pointerdown", (e: FederatedPointerEvent) => {
        e.stopPropagation();
        onDown(this.viewport.toWorld(e.global));
      });
      group.addChild(handle);
    };

    for (const c of corners) {
      addHandle(c.x, c.y, "nwse-resize", (world) => beginTransform("scale", world));
    }

    // Text: side handles — horizontal changes wrap width, vertical changes font size.
    if (object.type === "text" && this.selectedIds.length === 1) {
      addHandle(ox + boxW / 2, oy, "ns-resize", (world) =>
        beginTransform("text-height", world, "n"),
      );
      addHandle(ox + boxW / 2, oy + boxH, "ns-resize", (world) =>
        beginTransform("text-height", world, "s"),
      );
      addHandle(ox, oy + boxH / 2, "ew-resize", (world) =>
        beginTransform("text-width", world, "w"),
      );
      addHandle(ox + boxW, oy + boxH / 2, "ew-resize", (world) =>
        beginTransform("text-width", world, "e"),
      );
    }

    const rot = new Graphics();
    rot.circle(0, 0, hit * 0.45).fill({ color: 0xffffff, alpha: 0.001 });
    rot.circle(0, 0, rotR).fill({ color: 0x3b82f6 });
    rot.x = ox + boxW / 2;
    rot.y = oy - rotOff;
    rot.eventMode = "static";
    rot.cursor = "grab";
    const stem = new Graphics()
      .moveTo(ox + boxW / 2, oy)
      .lineTo(ox + boxW / 2, oy - rotOff)
      .stroke({ width: strokeW, color: 0x3b82f6, alpha: 0.8 });
    stem.eventMode = "none";
    group.addChild(stem);
    rot.on("pointerdown", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      beginTransform("rotate", this.viewport.toWorld(e.global));
    });
    group.addChild(rot);
    this.transformer.addChild(group);
  }

  private applyTextEdgeTransform(
    state: NonNullable<PixiWallEngine["transformState"]>,
    world: { x: number; y: number },
  ): void {
    const peer = state.peers[0];
    if (!peer || !state.edge) return;
    const entry = this.entries.get(peer.id);
    if (!entry) return;

    const rad = peer.startRotation * DEG;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Local axes in world space (matches Pixi rotation matrix used elsewhere).
    const xAxis = { x: cos, y: sin };
    const yAxis = { x: -sin, y: cos };
    const startVW = Math.max(1, peer.baseWidth * Math.abs(peer.startScaleX));
    const startVH = Math.max(1, peer.baseHeight * Math.abs(peer.startScaleY));
    const project = (
      from: { x: number; y: number },
      axis: { x: number; y: number },
    ) => (world.x - from.x) * axis.x + (world.y - from.y) * axis.y;

    if (state.mode === "text-width") {
      const absStart = Math.abs(peer.startScaleX) || 1;
      let nextVW: number;
      let nextX = peer.startX;
      let nextY = peer.startY;
      if (state.edge === "e") {
        nextVW = Math.max(TEXT_BOX_MIN_WIDTH, project({ x: peer.startX, y: peer.startY }, xAxis));
      } else {
        const right = {
          x: peer.startX + startVW * xAxis.x,
          y: peer.startY + startVW * xAxis.y,
        };
        nextVW = Math.max(TEXT_BOX_MIN_WIDTH, -project(right, xAxis));
        nextX = right.x - nextVW * xAxis.x;
        nextY = right.y - nextVW * xAxis.y;
      }
      const nextAbs = absStart * (nextVW / startVW);
      const maxAbs = Math.min(4, 3200 / Math.max(1, peer.baseWidth));
      const minAbs = TEXT_BOX_MIN_WIDTH / Math.max(1, peer.baseWidth);
      const clampedAbs = Math.max(minAbs, Math.min(maxAbs, nextAbs));
      const appliedVW = startVW * (clampedAbs / absStart);
      if (state.edge === "w") {
        const right = {
          x: peer.startX + startVW * xAxis.x,
          y: peer.startY + startVW * xAxis.y,
        };
        nextX = right.x - appliedVW * xAxis.x;
        nextY = right.y - appliedVW * xAxis.y;
      }
      entry.root.scale.set((Math.sign(peer.startScaleX) || 1) * clampedAbs, peer.startScaleY);
      entry.root.x = nextX;
      entry.root.y = nextY;
    } else {
      const absStart = Math.abs(peer.startScaleY) || 1;
      let nextVH: number;
      let nextX = peer.startX;
      let nextY = peer.startY;
      const minVH = TEXT_BOX_MIN_FONT_SIZE * 1.35;
      if (state.edge === "s") {
        nextVH = Math.max(minVH, project({ x: peer.startX, y: peer.startY }, yAxis));
      } else {
        const bottom = {
          x: peer.startX + startVH * yAxis.x,
          y: peer.startY + startVH * yAxis.y,
        };
        nextVH = Math.max(minVH, -project(bottom, yAxis));
        nextX = bottom.x - nextVH * yAxis.x;
        nextY = bottom.y - nextVH * yAxis.y;
      }
      const nextAbs = absStart * (nextVH / startVH);
      const clampedAbs = Math.max(0.2, Math.min(4, nextAbs));
      const appliedVH = startVH * (clampedAbs / absStart);
      if (state.edge === "n") {
        const bottom = {
          x: peer.startX + startVH * yAxis.x,
          y: peer.startY + startVH * yAxis.y,
        };
        nextX = bottom.x - appliedVH * yAxis.x;
        nextY = bottom.y - appliedVH * yAxis.y;
      }
      entry.root.scale.set(peer.startScaleX, (Math.sign(peer.startScaleY) || 1) * clampedAbs);
      entry.root.x = nextX;
      entry.root.y = nextY;
    }

    this.liveBroadcast(peer.id, {
      x: entry.root.x,
      y: entry.root.y,
      rotation: entry.root.rotation / DEG,
      scaleX: entry.root.scale.x,
      scaleY: entry.root.scale.y,
    });
  }

  private applyTransformMove(e: FederatedPointerEvent): void {
    const state = this.transformState;
    if (!state) return;
    const world = this.viewport.toWorld(e.global);

    if (state.mode === "text-width" || state.mode === "text-height") {
      this.applyTextEdgeTransform(state, world);
    } else if (state.mode === "scale") {
      const dist = Math.hypot(world.x - state.centerX, world.y - state.centerY) || 1;
      const factor = clampUniformScaleFactor(state.peers, dist / state.startDist);
      for (const peer of state.peers) {
        const entry = this.entries.get(peer.id);
        if (!entry) continue;
        const signX = Math.sign(peer.startScaleX) || 1;
        const signY = Math.sign(peer.startScaleY) || 1;
        const baseX = Math.abs(peer.startScaleX) || 1;
        const baseY = Math.abs(peer.startScaleY) || 1;
        const nextX = baseX * factor;
        const nextY = nextX * (baseY / baseX);
        entry.root.scale.set(signX * nextX, signY * nextY);
        entry.root.x = state.centerX + (peer.startX - state.centerX) * factor;
        entry.root.y = state.centerY + (peer.startY - state.centerY) * factor;
        this.liveBroadcast(peer.id, {
          x: entry.root.x,
          y: entry.root.y,
          rotation: entry.root.rotation / DEG,
          scaleX: entry.root.scale.x,
          scaleY: entry.root.scale.y,
        });
      }
    } else {
      const angle = Math.atan2(world.y - state.centerY, world.x - state.centerX);
      const deltaRad = angle - state.startAngle;
      const deltaDeg = deltaRad / DEG;
      const cos = Math.cos(deltaRad);
      const sin = Math.sin(deltaRad);
      for (const peer of state.peers) {
        const entry = this.entries.get(peer.id);
        if (!entry) continue;
        entry.root.rotation = (peer.startRotation + deltaDeg) * DEG;
        const dx = peer.startX - state.centerX;
        const dy = peer.startY - state.centerY;
        entry.root.x = state.centerX + dx * cos - dy * sin;
        entry.root.y = state.centerY + dx * sin + dy * cos;
        this.liveBroadcast(peer.id, {
          x: entry.root.x,
          y: entry.root.y,
          rotation: entry.root.rotation / DEG,
          scaleX: entry.root.scale.x,
          scaleY: entry.root.scale.y,
        });
      }
    }
    this.rebuildTransformer();
  }

  private commitTransform(): void {
    const state = this.transformState;
    if (!state) return;
    this.liveBroadcast.flush();
    const store = useWallSceneStore.getState();
    const wall = getEffectiveWallBounds();
    store.recordHistory();

    for (const peer of state.peers) {
      const entry = this.entries.get(peer.id);
      if (!entry) continue;
      const object = store.document.objects.find((o) => o.id === peer.id);
      let patch: WallObjectPatch = {
        x: entry.root.x,
        y: entry.root.y,
        rotation: entry.root.rotation / DEG,
        scaleX: entry.root.scale.x,
        scaleY: entry.root.scale.y,
      };
      if (object?.type === "text") {
        const bakeMode =
          state.mode === "text-width"
            ? "width"
            : state.mode === "text-height"
              ? "height"
              : state.mode === "scale"
                ? "uniform"
                : null;
        if (bakeMode) {
          const baked = bakeTextTransformScale(
            object,
            entry.root.scale.x,
            entry.root.scale.y,
            bakeMode,
          );
          patch = { ...patch, ...baked };
          entry.root.scale.set(baked.scaleX, baked.scaleY);
        }
      } else if (object) {
        const size = this.objectSize(object);
        const scales = clampObjectScalePair(
          entry.root.scale.x,
          entry.root.scale.y,
          size.width,
          size.height,
        );
        patch = { ...patch, ...scales };
        entry.root.scale.set(scales.scaleX, scales.scaleY);
      }
      if (object) {
        const clamped = hardClampObjectPositionToWall(
          { ...object, ...patch } as WallSceneObject,
          wall,
        );
        if (clamped) {
          patch = { ...patch, ...clamped };
          entry.root.x = patch.x!;
          entry.root.y = patch.y!;
        }
      }
      store.patchObject(peer.id, patch);
      broadcastWallPatch(peer.id, patch);
      this.options.onObjectPatch?.(peer.id, patch);
      setWallNodeDragging(peer.id, false);
    }

    this.options.onManipulationChange?.(false);
    this.transformState = null;
    this.rebuildTransformer();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    registerPixiDragOffsetSync(null);
    setLiveContentShiftMode("immediate");
    registerLiveWallBoundsApplier(null);
    for (const id of this.entries.keys()) {
      registerWallNode(id, null);
    }
    this.entries.clear();
    for (const tex of this.textures.values()) {
      tex.destroy(true);
    }
    this.textures.clear();
    this.viewport.destroy({ children: true });
    this.app.destroy(true, { children: true, texture: true });
  }
}
