export interface PhotoDecoDefinition {
  id: string;
  name: string;
  /** Procedural theme used when no overlay PNG is loaded. */
  theme: "blue" | "purple" | "pink";
  /** Optional PNG overlay with a transparent center. Drop in public/decos/. */
  src?: string;
  listed?: boolean;
}
