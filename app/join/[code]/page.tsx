import { redirect } from "next/navigation";

export default async function JoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect("/?join=" + encodeURIComponent(code));
}
