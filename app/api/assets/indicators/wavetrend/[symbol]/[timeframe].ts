// pages/api/crypto/indicators/wavetrend/[symbol]/[timeframe].ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { WaveTrendPoint, toNumber, toUnixTimestamp } from "../../../assets";

const prisma = new PrismaClient();

// Configuration maps
const CROSS_TF_WT_MAPPING: Record<string, string[]> = {
  "30m": ["4h"],
  "1h": ["4h", "12h"],
};

const CROSS_TF_SIGNAL_MAPPING: Record<string, string[]> = {
  "1h": ["4h", "12h"],
};

interface WaveTrendResponse {
  symbol: string;
  timeframe: string;
  data: WaveTrendPoint[];
  count: number;
  timezone: string;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WaveTrendResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { symbol, timeframe } = req.query;

  if (
    !symbol ||
    !timeframe ||
    typeof symbol !== "string" ||
    typeof timeframe !== "string"
  ) {
    return res
      .status(400)
      .json({ error: "Missing or invalid symbol/timeframe" });
  }

  try {
    const candles = await prisma.processedCandle.findMany({
      where: {
        symbol,
        timeframe,
      },
      select: {
        timestamp: true,
        wt1: true,
        wt2: true,
        buySignal: true,
        sellSignal: true,
        tf4hWt2: true,
        tf12hWt2: true,
        tf4hBuySignal: true,
        tf4hSellSignal: true,
        tf12hBuySignal: true,
        tf12hSellSignal: true,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    const data: WaveTrendPoint[] = candles
      .map((candle) => {
        const wt1 = toNumber(candle.wt1);
        const wt2 = toNumber(candle.wt2);

        if (wt1 === undefined || wt2 === undefined) return null;

        const point: WaveTrendPoint = {
          time: toUnixTimestamp(candle.timestamp),
          wt1,
          wt2,
          buy: candle.buySignal,
          sell: candle.sellSignal,
        };

        // Add cross-timeframe WT2 values
        if (CROSS_TF_WT_MAPPING[timeframe]) {
          for (const sourceTf of CROSS_TF_WT_MAPPING[timeframe]) {
            if (sourceTf === "4h" && candle.tf4hWt2) {
              const wt2_4h = toNumber(candle.tf4hWt2);
              if (wt2_4h !== undefined && wt2_4h !== 0) {
                point.wt2_4h = wt2_4h;
              }
            }
            if (sourceTf === "12h" && candle.tf12hWt2) {
              const wt2_12h = toNumber(candle.tf12hWt2);
              if (wt2_12h !== undefined && wt2_12h !== 0) {
                point.wt2_12h = wt2_12h;
              }
            }
          }
        }

        // Add cross-timeframe signals
        if (CROSS_TF_SIGNAL_MAPPING[timeframe]) {
          const crossSignals: Record<string, boolean> = {};

          for (const sourceTf of CROSS_TF_SIGNAL_MAPPING[timeframe]) {
            if (sourceTf === "4h") {
              crossSignals["4h_buy"] = candle.tf4hBuySignal;
              crossSignals["4h_sell"] = candle.tf4hSellSignal;
            }
            if (sourceTf === "12h") {
              crossSignals["12h_buy"] = candle.tf12hBuySignal;
              crossSignals["12h_sell"] = candle.tf12hSellSignal;
            }
          }

          if (Object.keys(crossSignals).length > 0) {
            point.cross_signals = crossSignals;
          }
        }

        return point;
      })
      .filter((point): point is WaveTrendPoint => point !== null);

    res.status(200).json({
      symbol,
      timeframe,
      data,
      count: data.length,
      timezone: "UTC",
    });
  } catch (error) {
    console.error("WaveTrend API error:", error);
    res.status(500).json({ error: "Failed to fetch WaveTrend data" });
  }
}