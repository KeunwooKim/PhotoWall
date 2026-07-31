interface WallLoadingOverlayProps {
  /** full-screen: 단독 페이지 전체를 차지, overlay: 편집기 위에 반투명으로 덮기 */
  mode?: "full-screen" | "overlay";
  title?: string;
  description?: string;
}

export default function WallLoadingOverlay({
  mode = "full-screen",
  title = "불러오는 중...",
  description,
}: WallLoadingOverlayProps) {
  const base =
    mode === "overlay"
      ? "pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-surface/75 backdrop-blur-[2px]"
      : "flex h-[100dvh] w-screen flex-col items-center justify-center gap-2 bg-background";

  return (
    <div className={base} role="status" aria-live="polite">
      <Spinner />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted">{description}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-6 w-6 animate-spin text-accent"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
