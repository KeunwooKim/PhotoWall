import WallEditor from "@/components/wall/WallEditor";

interface SharedWallPageProps {
  params: Promise<{ id: string }>;
}

export default async function SharedWallPage({ params }: SharedWallPageProps) {
  const { id } = await params;

  return (
    <main className="h-[100dvh] w-screen overflow-hidden bg-white">
      <WallEditor sharedId={id} />
    </main>
  );
}
