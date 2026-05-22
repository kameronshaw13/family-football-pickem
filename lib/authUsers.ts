export const FAMILY_USERS = [
  { username: "kameron", displayName: "Kameron", isAdmin: true },
  { username: "mike", displayName: "Mike", isAdmin: false },
  { username: "quentin", displayName: "Quentin", isAdmin: false }
] as const;

export function findFamilyUser(username: string) {
  const clean = username.trim().toLowerCase();
  return FAMILY_USERS.find((u) => u.username === clean) || null;
}
