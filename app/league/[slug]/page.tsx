import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";

export default async function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div className="route-app group-universal">
    <RouteAppBootstrap slug={slug} />
    <PickemApp appSlug={slug} />
  </div>;
}
