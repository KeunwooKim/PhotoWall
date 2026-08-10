"use client";

import {
  TEXT_MAX_LENGTH,
  clampWallTextContent,
  updateTextObject,
} from "@/lib/wall-scene/add-text";

interface TextContentFieldProps {
  objectId: string;
  value: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Multiline text editor for wall text boxes.
 * Enter / Shift+Enter / mobile return all insert a newline (textarea default).
 */
export default function TextContentField({
  objectId,
  value,
  className = "",
  autoFocus = false,
}: TextContentFieldProps) {
  const length = [...value].length;
  const nearLimit = length >= TEXT_MAX_LENGTH - 20;

  return (
    <div className="space-y-1">
      <textarea
        value={value === " " ? "" : value}
        autoFocus={autoFocus}
        rows={4}
        maxLength={TEXT_MAX_LENGTH}
        enterKeyHint="enter"
        onChange={(e) => {
          updateTextObject(objectId, {
            text: clampWallTextContent(e.target.value),
          });
        }}
        onKeyDown={(e) => {
          // Keep Enter as newline; never treat it as “submit / close”.
          if (e.key === "Enter") {
            e.stopPropagation();
          }
        }}
        className={
          className ||
          "w-full resize-y rounded-xl border border-foreground/10 bg-surface px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:border-foreground/30"
        }
        placeholder="텍스트 입력 (Enter로 줄바꿈)"
        aria-label="텍스트 내용"
      />
      <p
        className={`text-right text-[10px] tabular-nums ${
          nearLimit ? "text-foreground/70" : "text-muted"
        }`}
      >
        {length}/{TEXT_MAX_LENGTH}
        <span className="ml-2 font-normal text-muted">Enter · 줄바꿈</span>
      </p>
    </div>
  );
}
