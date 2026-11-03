/** Shared with the result box inside My Card's score display. */
export default function MatchupResultMark({ result }: { result: string }) {
  const outcome = result === "W" ? "win" : result === "L" ? "loss" : "push";
  return <span className={`score-bug-result score-bug-result-${outcome}`}>{result}</span>;
}
