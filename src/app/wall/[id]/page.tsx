import WallViewer from "@/components/wall/WallViewer";
import AuthButton from "@/components/auth/AuthButton";
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

  if (!supabase) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <p className="text-sm text-muted">서비스 설정이 필요해요</p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const visitorId = user?.id ?? null;

  const access = await checkWallAccess(supabase, id, visitorId);

  if (!access.allowed) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="max-w-sm px-6 text-center">
          <p className="text-lg font-medium text-foreground">
            {access.reason === "members_only"
              ? "멤버만 볼 수 있는 공동 벽이에요"
              : access.reason === "not_member"
                ? "이 공동 벽의 멤버가 아니에요"
                : "비공개 벽이에요"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {access.reason === "members_only"
              ? "로그인한 뒤, 벽 주인이 초대한 멤버만 열람할 수 있어요."
              : access.reason === "not_member"
                ? "벽 주인에게 멤버 초대를 요청해 보세요."
                : access.reason === "private"
                  ? "친구이더라도 벽 주인이 방문을 허용해야 볼 수 있어요. 설정에서 ‘벽 방문 허용’을 켜 달라고 요청해 보세요."
                  : "이 벽에 접근할 수 없어요"}
          </p>
          {access.reason === "members_only" && (
            <div className="mt-6">
              <AuthButton />
            </div>
          )}
          <Link
            href="/"
            className={`${access.reason === "members_only" ? "mt-4" : "mt-6"} inline-block rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background`}
          >
            홈으로
          </Link>
        </div>
      </div>
    );
  }

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
