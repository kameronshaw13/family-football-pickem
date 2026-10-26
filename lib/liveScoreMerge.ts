/** Keep imported IDs attached to the displayed game so every card gets live scores. */
export function gameSourceIds(game: { id: string; source_game_ids?: string[] }) {
  return Array.from(new Set([game.id, ...(game.source_game_ids || [])]));
}

export function mergeLiveScores<T extends { id: string; source_game_ids?: string[] }, U extends { id: string }>(games: T[], updates: U[]) {
  const byId = new Map(updates.map(update => [update.id, update]));
  return games.map(game => {
    const update = gameSourceIds(game).map(id => byId.get(id)).find(Boolean);
    return update ? { ...game, ...update, id: game.id } : game;
  });
}

export function expandGameAliases<T extends { id: string; source_game_ids?: string[] }>(games: T[]): T[] {
  return games.flatMap(game => gameSourceIds(game).map(id => id === game.id ? game : { ...game, id }));
}
