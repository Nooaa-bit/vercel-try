// hype-hire/vercel/app/api/assets/candles/[symbol]/[timeframe].ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { CandleData, toNumber, toUnixTimestamp } from "../../assets";

const prisma = new PrismaClient();

interface CandlesResponse {
  symbol: string;
  timeframe: string;
  data: CandleData[];
  count: number;
  timezone: string;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CandlesResponse | ErrorResponse>
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
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    const data: CandleData[] = candles
      .map((candle) => {
        const open = toNumber(candle.open);
        const high = toNumber(candle.high);
        const low = toNumber(candle.low);
        const close = toNumber(candle.close);
        const volume = toNumber(candle.volume);

        if (
          open === undefined ||
          high === undefined ||
          low === undefined ||
          close === undefined
        ) {
          return null;
        }

        const processedCandle: CandleData = {
          time: toUnixTimestamp(candle.timestamp),
          open,
          high,
          low,
          close,
        };

        if (volume !== undefined) {
          processedCandle.volume = volume;
        }

        return processedCandle;
      })
      .filter((candle): candle is CandleData => candle !== null);

    res.status(200).json({
      symbol,
      timeframe,
      data,
      count: data.length,
      timezone: "UTC",
    });
  } catch (error) {
    console.error("Candles API error:", error);
    res.status(500).json({ error: "Failed to fetch candles" });
  }
}
