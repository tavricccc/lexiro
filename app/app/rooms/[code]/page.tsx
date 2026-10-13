import { RoomPage } from "@/components/rooms/room-page";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomPage key={code} code={code.toUpperCase()} />;
}
