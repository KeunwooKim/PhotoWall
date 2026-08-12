/** Magic-byte sniff for allowed wall / guestbook image types. */

export type SniffedImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

function bytesStartWith(buf: Uint8Array, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

/**
 * Detect JPEG / PNG / WEBP / GIF from leading bytes.
 * Returns null when the payload is not a supported image.
 */
export function sniffImageMime(buf: ArrayBuffer | Uint8Array): SniffedImageMime | null {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.length < 12) return null;

  // JPEG SOI
  if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";

  // PNG
  if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  // GIF87a / GIF89a
  if (
    bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return "image/gif";
  }

  // RIFF....WEBP
  if (
    bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function extensionForImageMime(mime: SniffedImageMime): "jpg" | "png" | "webp" | "gif" {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "gif";
}
