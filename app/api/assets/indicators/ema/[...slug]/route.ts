//hype-hire/vercel/app/api/assets/indicators/ema/[...slug]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { EmaDataPoint, EmaResponse } from "@/app/api/assets/types/crypto";
import {
  toUnixTimestamp,
  toNumber,
  TIMEFRAMES,
  CROSS_TF_EMA_MAPPING,
} from "@/app/api/assets/types/crypto-utils";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    // Await params (Next.js 15)
    const { slug } = await context.params;

    // Parse slug: ["BTC", "USDT", "1h"] -> symbol: "BTC/USDT", timeframe: "1h"
    if (!slug || slug.length < 3) {
      return NextResponse.json(
        {
          error: `Invalid path. Expected: /api/assets/indicators/ema/{symbol}/{timeframe}`,
        },
        { status: 400 }
      );
    }

    const timeframe = slug[slug.length - 1];
    const symbolParts = slug.slice(0, -1);
    const symbol = symbolParts.join("/");

    if (!TIMEFRAMES.includes(timeframe as (typeof TIMEFRAMES)[number])) {
      return NextResponse.json(
        {
          error: `Invalid timeframe: ${timeframe}. Valid: ${TIMEFRAMES.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    const candles = await prisma.processedCandle.findMany({
      where: {
        symbol: symbol,
        timeframe: timeframe,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    const result: { [key: string]: EmaDataPoint[] } = {};

    // Own timeframe EMAs (100, 200)
    const ema100Data: EmaDataPoint[] = [];
    const ema200Data: EmaDataPoint[] = [];

    candles.forEach((candle) => {
      const time = toUnixTimestamp(candle.datetimeUtc);

      if (candle.ema100 !== null) {
        ema100Data.push({ time, value: toNumber(candle.ema100) });
      }
      if (candle.ema200 !== null) {
        ema200Data.push({ time, value: toNumber(candle.ema200) });
      }
    });

    if (ema100Data.length > 0) result["ema_100"] = ema100Data;
    if (ema200Data.length > 0) result["ema_200"] = ema200Data;

    // Cross-timeframe EMAs
    const crossTimeframes = CROSS_TF_EMA_MAPPING[timeframe] || [];

    crossTimeframes.forEach((sourceTf) => {
      const ema100Key = `${sourceTf}_ema_100`;
      const ema200Key = `${sourceTf}_ema_200`;
      const ema100CrossData: EmaDataPoint[] = [];
      const ema200CrossData: EmaDataPoint[] = [];

      candles.forEach((candle) => {
        const time = toUnixTimestamp(candle.datetimeUtc);

        if (sourceTf === "1h") {
          if (candle.tf1hEma100 !== null) {
            ema100CrossData.push({ time, value: toNumber(candle.tf1hEma100) });
          }
          if (candle.tf1hEma200 !== null) {
            ema200CrossData.push({ time, value: toNumber(candle.tf1hEma200) });
          }
        } else if (sourceTf === "4h") {
          if (candle.tf4hEma100 !== null) {
            ema100CrossData.push({ time, value: toNumber(candle.tf4hEma100) });
          }
          if (candle.tf4hEma200 !== null) {
            ema200CrossData.push({ time, value: toNumber(candle.tf4hEma200) });
          }
        } else if (sourceTf === "12h") {
          if (candle.tf12hEma100 !== null) {
            ema100CrossData.push({ time, value: toNumber(candle.tf12hEma100) });
          }
          if (candle.tf12hEma200 !== null) {
            ema200CrossData.push({ time, value: toNumber(candle.tf12hEma200) });
          }
        }
      });

      if (ema100CrossData.length > 0) result[ema100Key] = ema100CrossData;
      if (ema200CrossData.length > 0) result[ema200Key] = ema200CrossData;
    });

    const response: EmaResponse = {
      symbol: symbol,
      timeframe,
      data: result,
      cross_timeframes: crossTimeframes,
      timezone: "UTC",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching EMAs:", error);
    return NextResponse.json(
      { error: "Failed to fetch EMA data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
