export const FAMILY_USERS = [
  { username: "kameron", displayName: "Kameron", isAdmin: true },
  { username: "mike", displayName: "Mike", isAdmin: false },
  { username: "quentin", displayName: "Quentin", isAdmin: false },
  { username: "caleb", displayName: "Caleb", isAdmin: false },
  { username: "monte", displayName: "Monte", isAdmin: false },
  { username: "austin", displayName: "Austin", isAdmin: false },
  { username: "clayton", displayName: "Clayton", isAdmin: false },
  { username: "mason", displayName: "Mason", isAdmin: false },
  { username: "isaac", displayName: "Isaac", isAdmin: false },
  { username: "josh", displayName: "Josh", isAdmin: false }
] as const;

export function findFamilyUser(username: string) {
  const clean = username.trim().toLowerCase();
  return FAMILY_USERS.find((u) => u.username === clean) || null;
}
