export async function exportWallAsImage(element: HTMLElement): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas");

  const canvas = await html2canvas(element, {
    useCORS: true,
    allowTaint: true,
    scale: 2,
    backgroundColor: null,
    logging: false,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지 생성 실패"))),
      "image/png",
      1,
    );
  });
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
  const file = new File([blob], "photowall.png", { type: "image/png" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: "내 디지털 포토월",
      text: "PhotoWall에서 꾸민 내 벽이에요!",
      files: [file],
    });
    return;
  }

  await downloadWallImage(element);
}
