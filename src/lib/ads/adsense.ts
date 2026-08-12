/** Google AdSense — optional; slots render only when client ID is set. */

export function getAdSenseClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  return id || null;
}

export function getAdSenseSlotHome(): string | null {
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME?.trim();
  return slot || null;
}

export function getAdSenseSlotLanding(): string | null {
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LANDING?.trim();
  return slot || getAdSenseSlotHome();
}

/** ads.txt uses pub-XXXXXXXX; client ID is ca-pub-XXXXXXXX */
export function getAdSensePublisherId(): string | null {
  const clientId = getAdSenseClientId();
  if (!clientId) return null;
  if (clientId.startsWith("ca-pub-")) return clientId.slice(3);
  if (clientId.startsWith("pub-")) return clientId;
  return `pub-${clientId}`;
}

export function isAdSenseConfigured(): boolean {
  return Boolean(getAdSenseClientId());
}
