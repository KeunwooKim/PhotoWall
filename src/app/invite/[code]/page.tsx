import { redirect } from "next/navigation";
import { getInviteByCode } from "@/lib/supabase/social";

interface InvitePageProps {
  params: Promise<{ code: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const invite = await getInviteByCode(code);

  if (!invite) {
    redirect("/");
  }

  redirect(`/wall/${invite.wallId}?invited=1`);
}
