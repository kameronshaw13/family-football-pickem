-- Read-only integrity audit. Administrative settlement placeholders are not games.
-- Different spreads can be legitimate movements or locked wager terms; never
-- bulk-delete duplicates or rewrite pick/side-bet snapshots from this report.
WITH matchups AS (
  SELECT league, home_team, away_team, commence_time, count(*) AS rows,
    count(DISTINCT (final_home_score, final_away_score)) FILTER (
      WHERE final_home_score IS NOT NULL AND final_away_score IS NOT NULL
    ) AS score_versions,
    count(DISTINCT CASE
      WHEN current_spread_team = away_team THEN current_spread
      WHEN current_spread_team = home_team THEN -current_spread END
    ) AS spread_versions,
    bool_or(final_home_score IS NOT NULL AND final_away_score IS NOT NULL) AS scored,
    bool_or(current_spread IS NOT NULL AND current_spread_team IS NOT NULL) AS lined
  FROM games
  WHERE league IN ('NFL', 'CFB') AND commence_time >= '2026-08-01'
    AND id NOT LIKE 'admin-%'
  GROUP BY league, home_team, away_team, commence_time
)
SELECT league, count(*) AS matchups,
  count(*) FILTER (WHERE rows > 1) AS duplicate_matchups,
  count(*) FILTER (WHERE score_versions > 1) AS score_conflicts,
  count(*) FILTER (WHERE spread_versions > 1) AS multiple_spreads,
  count(*) FILTER (WHERE commence_time < now() - interval '18 hours' AND NOT scored) AS missing_past_scores,
  count(*) FILTER (WHERE commence_time < now() - interval '18 hours' AND NOT lined) AS missing_past_spreads,
  count(*) FILTER (WHERE commence_time >= now() AND NOT lined) AS missing_future_spreads
FROM matchups GROUP BY league;

-- Same event with multiple names or kickoff times: inspect aliases/reschedules.
SELECT league, espn_event_id, count(*) AS rows,
  count(DISTINCT (home_team, away_team)) AS team_names,
  count(DISTINCT commence_time) AS kickoff_times
FROM games
WHERE league IN ('NFL', 'CFB') AND commence_time >= '2026-08-01'
  AND id NOT LIKE 'admin-%' AND espn_event_id IS NOT NULL
GROUP BY league, espn_event_id
HAVING count(DISTINCT (home_team, away_team)) > 1
  OR count(DISTINCT commence_time) > 1;

-- Partial data must not be silently coerced into zero scores or valid spreads.
SELECT id, league, home_team, away_team, current_spread_team, current_spread,
  final_home_score, final_away_score
FROM games
WHERE league IN ('NFL', 'CFB') AND commence_time >= '2026-08-01'
  AND id NOT LIKE 'admin-%' AND (
    (final_home_score IS NULL) <> (final_away_score IS NULL)
    OR final_home_score < 0 OR final_away_score < 0
    OR (current_spread IS NULL) <> (current_spread_team IS NULL)
    OR (current_spread IS NOT NULL AND
      regexp_replace(lower(current_spread_team), '[^a-z0-9]', '', 'g') NOT IN (
        regexp_replace(lower(home_team), '[^a-z0-9]', '', 'g'),
        regexp_replace(lower(away_team), '[^a-z0-9]', '', 'g')))
  );
