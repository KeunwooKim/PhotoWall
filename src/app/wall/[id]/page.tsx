import WallViewer from "@/components/wall/WallViewer";
import { fetchWallFromDb, getSupabaseServer } from "@/lib/supabase/walls";
import { checkWallAccess } from "@/lib/supabase/wall-access";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

interface WallPageProps {
  params: Promise<{ id: string }>;
}

export default async function WallPage({ params }: WallPageProps) {
  const { id } = await params;
  const supabase = (await createClient()) ?? getSupabaseServer();
  const wall = await fetchWallFromDb(id, supabase);

  if (!wall) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">벽을 찾을 수 없어요</p>
          <p className="mt-1 text-sm text-muted">링크가 만료되었거나 삭제됐을 수 있어요</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background"
          >
            내 벽 꾸미러 가기
          </Link>
        </div>
      </div>
    );
  }

  let visitorId: string | null = null;
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    visitorId = user?.id ?? null;
  }

  if (!supabase) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <p className="text-sm text-muted">서비스 설정이 필요해요</p>
      </div>
    );
  }

  const access = await checkWallAccess(supabase, id, visitorId);

  if (!access.allowed) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="max-w-sm px-6 text-center">
          <p className="text-lg font-medium text-foreground">비공개 벽이에요</p>
          <p className="mt-2 text-sm text-muted">
            {access.reason === "private"
              ? "친구이더라도 벽 주인이 방문을 허용해야 볼 수 있어요. 설정에서 ‘벽 방문 허용’을 켜 달라고 요청해 보세요."
              : "이 벽에 접근할 수 없어요"}
          </p>
          {!visitorId && (
            <p className="mt-2 text-xs text-muted">로그인한 친구만 방문할 수 있어요</p>
          )}
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background"
          >
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <WallViewer
      themeId={wall.themeId}
      canvasJson={wall.canvasJson}
      readOnly
      wallId={wall.id}
      canGuestbook={access.canGuestbook}
    />
  );
}
