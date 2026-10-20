/** Stable currency rendering and two-decimal risk-input normalization. */
export function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return sign + "$" + absolute.toFixed(Number.isInteger(absolute) ? 0 : 2);
}
export function roundedMoney(value: number) {
  const rounded = Math.round(Number(value) || 0);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return sign + "$" + Math.abs(rounded);
}
export function stakeMoney(value: number) {
  const absolute = Math.abs(Number(value));
  const decimals = Number.isInteger(absolute) ? 0 : 2;
  return `$${absolute.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function normalizeRiskInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole = "", ...fractionParts] = cleaned.split(".");
  const fraction = fractionParts.join("").slice(0, 2);
  if (!fractionParts.length) return whole;
  return `${whole || "0"}.${fraction}`;
}
