// lib/types/assets.ts
import { Decimal } from "@prisma/client/runtime/library";

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface WaveTrendPoint {
  time: number;
  wt1: number;
  wt2: number;
  buy: boolean;
  sell: boolean;
  wt2_4h?: number;
  wt2_12h?: number;
  cross_signals?: Record<string, boolean>;
}

export interface EMAPoint {
  time: number;
  value: number;
}

export interface DivergenceData {
  time: number;
  candle_number: number;
  signal_type: "buy" | "sell";
  price: number;
  wt2: number;
  closest: {
    type: string;
    ref_candle: number;
    candles_back: number;
    price_change_pct: number;
    wt2_change_points: number;
    dmi: number;
  };
  biggest: {
    type: string;
    ref_candle: number;
    candles_back: number;
    price_change_pct: number;
    wt2_change_points: number;
    dmi: number;
  };
}

// Helper to convert Decimal to number safely
export function toNumber(
  value: Decimal | null | undefined
): number | undefined {
  if (!value) return undefined;
  return Number(value.toString());
}

// Helper to convert Date to Unix timestamp
export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
