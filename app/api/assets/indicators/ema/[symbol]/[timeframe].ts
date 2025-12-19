// pages/api/crypto/indicators/ema/[symbol]/[timeframe].ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { EMAPoint, toNumber, toUnixTimestamp } from "../../../assets";

const prisma = new PrismaClient();

const CROSS_TF_EMA_MAPPING: Record<string, string[]> = {
  "30m": ["1h", "4h", "12h"],
  "1h": ["4h", "12h"],
};

interface EMAResponse {
  symbol: string;
  timeframe: string;
  data: Record<string, EMAPoint[]>;
  cross_timeframes: string[];
  timezone: string;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EMAResponse | ErrorResponse>
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
        ema50: true,
        ema100: true,
        ema200: true,
        tf1hEma100: true,
        tf1hEma200: true,
        tf4hEma100: true,
        tf4hEma200: true,
        tf12hEma100: true,
        tf12hEma200: true,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    const result: Record<string, EMAPoint[]> = {};

    // Helper to add EMA series
    const addEMASeries = (
      key: string,
      getValue: (candle: (typeof candles)[0]) => number | undefined
    ) => {
      const points: EMAPoint[] = [];

      for (const candle of candles) {
        const value = getValue(candle);
        if (value !== undefined) {
          points.push({
            time: toUnixTimestamp(candle.timestamp),
            value,
          });
        }
      }

      if (points.length > 0) {
        result[key] = points;
      }
    };

    // Own timeframe EMAs
    addEMASeries("ema_100", (c) => toNumber(c.ema100));
    addEMASeries("ema_200", (c) => toNumber(c.ema200));

    // Cross-timeframe EMAs
    if (CROSS_TF_EMA_MAPPING[timeframe]) {
      for (const sourceTf of CROSS_TF_EMA_MAPPING[timeframe]) {
        if (sourceTf === "1h") {
          addEMASeries("1h_ema_100", (c) => toNumber(c.tf1hEma100));
          addEMASeries("1h_ema_200", (c) => toNumber(c.tf1hEma200));
        }
        if (sourceTf === "4h") {
          addEMASeries("4h_ema_100", (c) => toNumber(c.tf4hEma100));
          addEMASeries("4h_ema_200", (c) => toNumber(c.tf4hEma200));
        }
        if (sourceTf === "12h") {
          addEMASeries("12h_ema_100", (c) => toNumber(c.tf12hEma100));
          addEMASeries("12h_ema_200", (c) => toNumber(c.tf12hEma200));
        }
      }
    }

    res.status(200).json({
      symbol,
      timeframe,
      data: result,
      cross_timeframes: CROSS_TF_EMA_MAPPING[timeframe] || [],
      timezone: "UTC",
    });
  } catch (error) {
    console.error("EMA API error:", error);
    res.status(500).json({ error: "Failed to fetch EMA data" });
  }
}