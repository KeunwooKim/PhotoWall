/**
 * Human-readable Discord alerts for app errors.
 * Server-only — never call from the browser (webhook secret).
 */

import { postDiscordPayload } from "@/lib/discord/notify";

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const MAX_DEDUPE_KEYS = 200;

const recentKeys = new Map<string, number>();

export type AppErrorNotifyInput = {
  error: unknown;
  extras?: Record<string, unknown>;
  /** Skip development mute + send even if recently notified (admin test). */
  force?: boolean;
};

type ErrorPlaybook = {
  title: string;
  summary: string;
  actions: string[];
  color: number;
};

function pruneDedupe(now: number): void {
  for (const [key, at] of recentKeys) {
    if (now - at > DEDUPE_WINDOW_MS) recentKeys.delete(key);
  }
  while (recentKeys.size > MAX_DEDUPE_KEYS) {
    const oldest = recentKeys.keys().next().value;
    if (oldest == null) break;
    recentKeys.delete(oldest);
  }
}

function shouldNotify(key: string): boolean {
  const now = Date.now();
  pruneDedupe(now);
  const last = recentKeys.get(key);
  if (last != null && now - last < DEDUPE_WINDOW_MS) return false;
  recentKeys.set(key, now);
  return true;
}

function errorText(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "(메시지 없음)",
      stack: error.stack,
    };
  }
  if (typeof error === "string") {
    return { name: "Error", message: error };
  }
  try {
    return { name: "Error", message: JSON.stringify(error).slice(0, 300) };
  } catch {
    return { name: "Error", message: String(error) };
  }
}

function playbookFor(message: string, name: string, extras?: Record<string, unknown>): ErrorPlaybook {
  const hay = `${name} ${message} ${JSON.stringify(extras ?? {})}`.toLowerCase();

  if (/quota|storage.*full|exceeded.*quota|ns_error_dom_quota/i.test(hay)) {
    return {
      title: "저장 공간 부족",
      summary: "브라우저/스토리지 용량이 가득 차서 저장에 실패했어요.",
      actions: [
        "해당 유저가 사진을 많이 올렸는지 확인",
        "localStorage / Supabase storage 사용량 점검",
        "단발이면 유저에게 용량 정리 안내",
      ],
      color: 0xf59e0b,
    };
  }

  if (/econnrefused|fetch failed|network|etimedout|enotfound|socket/i.test(hay)) {
    return {
      title: "네트워크 / 외부 서비스 오류",
      summary: "API나 DB·스토리지 연결이 잠깐 끊겼을 수 있어요.",
      actions: [
        "Supabase / Caddy / 서버 상태 확인",
        "같은 오류가 반복되면 네트워크·방화벽 점검",
        "단발이면 재시도로 회복되는 경우가 많음",
      ],
      color: 0xf97316,
    };
  }

  if (/jwt|unauthorized|invalid.*token|session|auth/i.test(hay) && !/oauth/i.test(hay)) {
    return {
      title: "인증 / 세션 문제",
      summary: "로그인 세션이 만료됐거나 권한이 없을 수 있어요.",
      actions: [
        "유저에게 다시 로그인 안내",
        "Supabase auth 설정·쿠키 도메인 확인",
        "관리자 API면 권한 체크 로직 확인",
      ],
      color: 0xeab308,
    };
  }

  if (/build_id|cannot find module|production build|enoent.*\.next/i.test(hay)) {
    return {
      title: "배포 / 빌드 문제",
      summary: "서버가 깨진 빌드를 서빙 중이거나 배포가 불완전해요.",
      actions: [
        "`npm run build` 성공 여부 확인 (.next/BUILD_ID)",
        "성공한 뒤에만 `pm2 restart photowall`",
        "최근 배포 로그에서 ESLint/타입 오류 확인",
      ],
      color: 0xef4444,
    };
  }

  if (/out of memory|oom|heap|maximum call stack/i.test(hay)) {
    return {
      title: "메모리 부족",
      summary: "서버 또는 브라우저 메모리가 부족해 작업이 중단됐어요.",
      actions: [
        "큰 벽/많은 사진 여부 확인",
        "PM2 메모리·재시작 횟수 확인",
        "iOS면 캔버스/벽 크기 한도 점검",
      ],
      color: 0xdc2626,
    };
  }

  if (typeof extras?.route === "string" && /walls/i.test(extras.route)) {
    return {
      title: "벽 API 오류",
      summary: "벽 생성·저장·조회 중 서버에서 오류가 났어요.",
      actions: [
        "해당 route 서버 로그 확인",
        "Supabase walls 테이블/권한 점검",
        "유저가 저장을 여러 번 눌렀는지 확인",
      ],
      color: 0xef4444,
    };
  }

  if (typeof extras?.route === "string" && /account/i.test(extras.route)) {
    return {
      title: "계정 API 오류",
      summary: "계정 삭제/처리 중 서버에서 오류가 났어요.",
      actions: [
        "해당 유저 ID로 DB 상태 확인",
        "관련 storage 파일 삭제 중 실패했는지 확인",
        "서버 로그에서 스택 확인",
      ],
      color: 0xef4444,
    };
  }

  return {
    title: "앱 오류",
    summary: "PhotoWall에서 처리하지 못한 오류가 발생했어요.",
    actions: [
      "아래 원문·스택을 보고 위치 파악",
      "같은 오류가 반복되는지 서버 로그 확인",
      "반복되면 재현 경로를 남기기",
    ],
    color: 0xef4444,
  };
}

function formatKst(date = new Date()): string {
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function extraLine(extras?: Record<string, unknown>): string {
  if (!extras || Object.keys(extras).length === 0) return "(없음)";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(extras)) {
    if (value == null) continue;
    const text =
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);
    parts.push(`• **${key}**: \`${text.slice(0, 120)}\``);
  }
  return parts.slice(0, 8).join("\n") || "(없음)";
}

/** Fire-and-forget Discord error card (deduped). */
export function notifyAppError(input: AppErrorNotifyInput): void {
  if (typeof window !== "undefined") return;
  if (
    !input.force &&
    process.env.NODE_ENV === "development" &&
    process.env.DISCORD_NOTIFY_ERRORS !== "1"
  ) {
    return;
  }

  const { name, message, stack } = errorText(input.error);
  const dedupeKey = `${name}:${message}:${String(input.extras?.route ?? "")}`.slice(0, 200);
  if (!input.force && !shouldNotify(dedupeKey)) return;

  const book = playbookFor(message, name, input.extras);
  const actions = book.actions.map((step, i) => `${i + 1}. ${step}`).join("\n");
  const stackPreview = (stack ?? "")
    .split("\n")
    .slice(0, 6)
    .join("\n")
    .slice(0, 800);

  void postDiscordPayload({
    embeds: [
      {
        title: `🔴 ${book.title}`,
        description: book.summary,
        color: book.color,
        fields: [
          {
            name: "어디서",
            value: String(input.extras?.route ?? input.extras?.path ?? "미상").slice(0, 200),
            inline: true,
          },
          {
            name: "시간 (KST)",
            value: formatKst(),
            inline: true,
          },
          {
            name: "에러",
            value: `\`\`\`${name}: ${message.slice(0, 400)}\`\`\``,
          },
          {
            name: "내가 할 일",
            value: actions.slice(0, 900),
          },
          {
            name: "추가 정보",
            value: extraLine(input.extras).slice(0, 900),
          },
          ...(stackPreview
            ? [
                {
                  name: "스택 (일부)",
                  value: `\`\`\`${stackPreview}\`\`\``,
                },
              ]
            : []),
        ],
        footer: { text: "PhotoWall · 같은 오류는 5분에 1번만 알림" },
      },
    ],
  });
}
