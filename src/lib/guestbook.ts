interface FabricCanvasJson {
  version?: string;
  objects?: Record<string, unknown>[];
  background?: string;
  width?: number;
  height?: number;
}

const OBJECT_DEFAULTS = {
  cornerStyle: "circle",
  cornerColor: "#c4c4c4",
  borderColor: "#c4c4c4",
  transparentCorners: false,
  touchCornerSize: 24,
  cornerSize: 12,
  selectable: true,
  evented: true,
};

export function appendGuestbookPhoto(
  canvasJson: object,
  imageDataUrl: string,
  imageWidth: number,
  imageHeight: number,
): FabricCanvasJson {
  const json = canvasJson as FabricCanvasJson;
  const canvasWidth = json.width ?? 800;
  const canvasHeight = json.height ?? 600;
  const maxWidth = Math.min(220, canvasWidth * 0.35);
  const scale = Math.min(1, maxWidth / Math.max(imageWidth, imageHeight, 1));

  const photoObject = {
    type: "Image",
    version: "6.6.2",
    originX: "left",
    originY: "top",
    left: canvasWidth * 0.2 + Math.random() * (canvasWidth * 0.2),
    top: canvasHeight * 0.15 + Math.random() * (canvasHeight * 0.2),
    scaleX: scale,
    scaleY: scale,
    angle: -8 + Math.random() * 16,
    src: imageDataUrl,
    crossOrigin: "anonymous",
    ...OBJECT_DEFAULTS,
  };

  return {
    ...json,
    objects: [...(json.objects ?? []), photoObject],
  };
}
