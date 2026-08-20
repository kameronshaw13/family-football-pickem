import CompanionAppEnhancements from "@/components/CompanionAppEnhancements";
import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";

export default function FriendsPickemPage() {
  return <div className="route-app group-friends"><RouteAppBootstrap slug="friends" /><PickemApp /><CompanionAppEnhancements slug="friends" /></div>;
}
