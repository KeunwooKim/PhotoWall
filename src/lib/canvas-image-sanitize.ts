type FabricObjectJson = {
  type?: string;
  src?: string;
  objects?: FabricObjectJson[];
};

function isRemoteImageSrc(src: string): boolean {
  if (src.startsWith("data:") || src.startsWith("blob:")) {
    return false;
  }
  if (src.startsWith("wall-photo://")) {
    return false;
  }
  return src.startsWith("http://") || src.startsWith("https://");
}

async function imageUrlExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD", mode: "cors" });
    if (head.ok) return true;
    if (head.status === 405 || head.status === 404) {
      const get = await fetch(url, { method: "GET", mode: "cors" });
      return get.ok;
    }
    return false;
  } catch {
    return false;
  }
}

async function filterFabricObjects(
  objects: FabricObjectJson[],
  removedUrls: string[],
): Promise<FabricObjectJson[]> {
  const kept: FabricObjectJson[] = [];

  for (const obj of objects) {
    if (Array.isArray(obj.objects)) {
      kept.push({
        ...obj,
        objects: await filterFabricObjects(obj.objects, removedUrls),
      });
      continue;
    }

    if (obj.type === "Image" && typeof obj.src === "string" && isRemoteImageSrc(obj.src)) {
      const exists = await imageUrlExists(obj.src);
      if (!exists) {
        removedUrls.push(obj.src);
        continue;
      }
    }

    kept.push(obj);
  }

  return kept;
}

/** Drop Fabric image objects whose remote src returns 404 (e.g. deleted from Storage). */
export async function stripBrokenImagesFromFabricJson(fabricJson: object): Promise<{
  json: object;
  removedUrls: string[];
}> {
  const record = fabricJson as Record<string, unknown>;
  const objects = record.objects;

  if (!Array.isArray(objects)) {
    return { json: fabricJson, removedUrls: [] };
  }

  const removedUrls: string[] = [];
  const cleanedObjects = await filterFabricObjects(objects as FabricObjectJson[], removedUrls);

  if (removedUrls.length === 0) {
    return { json: fabricJson, removedUrls: [] };
  }

  return {
    json: { ...record, objects: cleanedObjects },
    removedUrls,
  };
}
