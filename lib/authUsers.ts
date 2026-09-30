export const APP_USERS = {
  "shaw-family": [
    { username: "kameron", displayName: "Kameron", isAdmin: true },
    { username: "mike", displayName: "Mike", isAdmin: false },
    { username: "quentin", displayName: "Quentin", isAdmin: false }
  ],
  "other-family": [
    { username: "caleb", displayName: "Caleb", isAdmin: false },
    { username: "monte", displayName: "Monte", isAdmin: false },
    { username: "austin", displayName: "Austin", isAdmin: false },
    { username: "clayton", displayName: "Clayton", isAdmin: false }
  ],
  friends: [
    { username: "kameron", displayName: "Kameron", isAdmin: true },
    { username: "caleb", displayName: "Caleb", isAdmin: false },
    { username: "mason", displayName: "Mason", isAdmin: false },
    { username: "isaac", displayName: "Isaac", isAdmin: false },
    { username: "josh", displayName: "Josh", isAdmin: false },
    { username: "tate", displayName: "Tate", isAdmin: false },
    { username: "jack", displayName: "Jack", isAdmin: false },
    { username: "caden", displayName: "Caden", isAdmin: false }
  ]
} as const;

export type PickemAppSlug = keyof typeof APP_USERS;

export const FAMILY_USERS = Array.from(
  new Map(Object.values(APP_USERS).flat().map((user) => [user.username, user])).values()
);

export function normalizeAppSlug(value: string | null | undefined): PickemAppSlug {
  return value === "other-family" || value === "friends" ? value : "shaw-family";
}

export function usersForApp(groupSlug: string | null | undefined) {
  return APP_USERS[normalizeAppSlug(groupSlug)];
}

export function findFamilyUser(username: string, groupSlug?: string | null) {
  const clean = username.trim().toLowerCase();
  return usersForApp(groupSlug).find((user) => user.username === clean) || null;
}
