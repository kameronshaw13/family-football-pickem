import CompanionAppEnhancements from "@/components/CompanionAppEnhancements";
import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";

export default function OtherFamilyPickemPage() {
  return <div className="route-app group-other-family"><RouteAppBootstrap slug="other-family" /><PickemApp /><CompanionAppEnhancements slug="other-family" /></div>;
}
