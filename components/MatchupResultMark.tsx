/** Uses the same W/L/P badge classes as My Card and League Card. */
export default function MatchupResultMark({ result }: { result: string }) {
  return <span className={`badge pick-result-${result === "W" ? "win" : result === "L" ? "loss" : "push"}`}>{result}</span>;
}
