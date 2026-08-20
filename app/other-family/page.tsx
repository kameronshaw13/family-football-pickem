import CompanionAppEnhancements from "@/components/CompanionAppEnhancements";
import CompanionFineTune from "@/components/CompanionFineTune";
import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";

export default function OtherFamilyPickemPage() {
  return <div className="route-app group-other-family"><RouteAppBootstrap slug="other-family" /><PickemApp /><CompanionAppEnhancements slug="other-family" /><CompanionFineTune slug="other-family" /></div>;
}
