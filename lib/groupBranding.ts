export type GroupBranding = {
  theme?: string;
  headerMode?: string;
  headerLabel?: string;
  icon?: string;
};

export function groupBranding(value: unknown): GroupBranding {
  return value && typeof value === "object" ? value as GroupBranding : {};
}
