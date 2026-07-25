/** Legal document versions — bump when policies change materially. */
export const LEGAL_VERSION = "2026-07-25";

export const LEGAL_META = {
  serviceName: "PhotoWall",
  operatorName: "PhotoWall 운영자",
  contactEmail: "krphotowall@gmail.com",
  contactPath: "/settings",
  governingLaw: "대한민국 법률",
  effectiveDate: "2026년 7월 25일",
  effectiveDateIso: LEGAL_VERSION,
} as const;

export const LEGAL_CONSENT_STORAGE_KEY = `photowall-legal-consent-${LEGAL_VERSION}`;

export interface LegalConsentRecord {
  terms: true;
  privacy: true;
  age14: true;
  version: string;
  consentedAt: string;
}

export function readLegalConsent(): LegalConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegalConsentRecord;
    if (
      parsed.version === LEGAL_VERSION &&
      parsed.terms === true &&
      parsed.privacy === true &&
      parsed.age14 === true
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLegalConsent(): LegalConsentRecord {
  const record: LegalConsentRecord = {
    terms: true,
    privacy: true,
    age14: true,
    version: LEGAL_VERSION,
    consentedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, JSON.stringify(record));
  }
  return record;
}

export function hasValidLegalConsent(): boolean {
  return readLegalConsent() !== null;
}
