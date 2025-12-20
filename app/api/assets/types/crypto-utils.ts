export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (value && typeof value === "object" && "d" in value) {
    // Prisma Decimal type
    return parseFloat(String(value));
  }
  return 0;
}

export function toBoolean(value: unknown): boolean {
  return Boolean(value);
}

export const TIMEFRAMES = ["5m", "30m", "1h", "4h", "12h"] as const;
export const VIEWABLE_TIMEFRAMES = ["30m", "1h"] as const;

export const CROSS_TF_EMA_MAPPING: Record<string, string[]> = {
  "30m": ["1h", "4h", "12h"],
  "1h": ["4h", "12h"],
};

export const CROSS_TF_SIGNAL_MAPPING: Record<string, string[]> = {
  "1h": ["4h", "12h"],
};

export const CROSS_TF_WT_MAPPING: Record<string, string[]> = {
  "30m": ["4h", "12h"],
  "1h": ["4h", "12h"],
};
