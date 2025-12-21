import { ProcessedCandle as PrismaProcessedCandle } from "@prisma/client";

// Base processed candle type from Prisma
export type ProcessedCandle = PrismaProcessedCandle;

// API Response types (matching your Flask responses)
export interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface WaveTrendData {
  time: number;
  wt1: number;
  wt2: number;
  vwap?: number; 
  vwapHigher?: number;
  buy: boolean;
  sell: boolean;
  wt2_4h?: number;
  wt2_12h?: number;
  cross_signals?: {
    [key: string]: boolean;
  };
}

export interface EmaDataPoint {
  time: number;
  value: number;
}

export interface EmaResponse {
  symbol: string;
  timeframe: string;
  data: {
    [key: string]: EmaDataPoint[];
  };
  cross_timeframes: string[];
  timezone: string;
}

export interface DivergenceData {
  time: number;
  candle_number: number;
  signal_type: "buy" | "sell";
  price: number;
  wt2: number;
  closest: {
    type: string | null;
    ref_candle: number | null;
    candles_back: number | null;
    price_change_pct: number | null;
    wt2_change_points: number | null;
    dmi: number | null;
  };
  biggest: {
    type: string | null;
    ref_candle: number | null;
    candles_back: number | null;
    price_change_pct: number | null;
    wt2_change_points: number | null;
    dmi: number | null;
  };
}
