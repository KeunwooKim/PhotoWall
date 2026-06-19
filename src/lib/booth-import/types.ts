export type BoothImportErrorCode =
  | "invalid_url"
  | "domain_not_allowed"
  | "expired"
  | "not_found"
  | "no_images"
  | "fetch_failed";

export interface BoothImportResult {
  ok: true;
  images: string[];
  sourceUrl: string;
}

export interface BoothImportFailure {
  ok: false;
  error: BoothImportErrorCode;
  message: string;
}

export type BoothImportResponse = BoothImportResult | BoothImportFailure;
