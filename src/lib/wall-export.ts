import { captureWallElementPreview } from "@/lib/storage/wall-preview";

export async function exportWallAsImage(element: HTMLElement): Promise<Blob> {
  return captureWallElementPreview(element);
}

export async function downloadWallImage(element: HTMLElement, filename = "photowall.png") {
  const blob = await exportWallAsImage(element);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareWallImage(element: HTMLElement) {
  const blob = await exportWallAsImage(element);
  const file = new File([blob], "photowall.jpg", { type: "image/jpeg" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: "내 디지털 포토월",
      text: "PhotoWall에서 꾸민 내 벽이에요!",
      files: [file],
    });
    return;
  }

  await downloadWallImage(element, "photowall.jpg");
}
