export const rm = (v: number | null | undefined, dp = 0) =>
  v == null ? "–" : `RM ${v.toLocaleString("en-MY", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const n = (v: number | null | undefined, dp = 0) =>
  v == null ? "–" : v.toLocaleString("en-MY", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const pct = (v: number | null | undefined, dp = 1) => (v == null ? "–" : `${(v * 100).toFixed(dp)}%`);
export const x = (v: number | null | undefined) => (v == null ? "–" : `${v.toFixed(2)}x`);
export const shortDate = (s: string) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString("en-MY", { day: "numeric", month: "short", timeZone: "UTC" });
