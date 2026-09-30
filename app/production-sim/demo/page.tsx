import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";

export default function ProductionSimDemoPage() {
  return <div className="route-app group-development"><RouteAppBootstrap slug="development" /><PickemApp appSlug="development" /></div>;
}
