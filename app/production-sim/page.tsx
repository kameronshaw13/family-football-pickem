import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";

// Development league uses the same live app component as the other league routes.
export default function ProductionSimPage() {
  return <div className="route-app group-development"><RouteAppBootstrap slug="development" /><PickemApp appSlug="development" /></div>;
}
