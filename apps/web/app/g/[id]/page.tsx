import { OnlineGameScreen } from "../../../components/OnlineGameScreen";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OnlineGameScreen id={id} />;
}
