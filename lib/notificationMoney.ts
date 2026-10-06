export function notificationMoney(value: number) {
  const rounded = Math.round(Number(value) * 100) / 100;
  return `$${rounded.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

export function notificationStakeText(risk: number, win: number) {
  return Math.abs(risk - win) < 0.005
    ? notificationMoney(risk)
    : `Risk ${notificationMoney(risk)} to win ${notificationMoney(win)}`;
}
