/** Google AdSense client / publisher helpers. */

export const ADSENSE_CLIENT_ID = "ca-pub-9751470689295736";

export function getAdSenseClientId(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || ADSENSE_CLIENT_ID;
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
export function getAdSensePublisherId(): string {
  const clientId = getAdSenseClientId();
  if (clientId.startsWith("ca-pub-")) return clientId.slice(3);
  if (clientId.startsWith("pub-")) return clientId;
  return `pub-${clientId}`;
}

export function isAdSenseConfigured(): boolean {
  return Boolean(getAdSenseClientId());
}
