import Link from "next/link";
import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";

export default async function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div className="route-app group-universal">
    <RouteAppBootstrap slug={slug} />
    <Link href="/" className="universal-league-home-link" aria-label="Back to My Leagues">← My Leagues</Link>
    <PickemApp appSlug={slug} />
  </div>;
}
