/** In-memory handoff for scanned photos as Files (avoids huge data URLs in scene JSON / localStorage). */

let pendingScanFiles: File[] = [];

export function savePendingScanFiles(files: File[]): void {
  if (typeof window === "undefined" || files.length === 0) return;
  pendingScanFiles = [...files];
}

export function consumePendingScanFiles(): File[] {
  if (typeof window === "undefined") return [];
  const files = pendingScanFiles;
  pendingScanFiles = [];
  return files;
}

export function hasPendingScanFiles(): boolean {
  return pendingScanFiles.length > 0;
}
