// hype-hire/vercel/app/api/assets/indicators/wavetrend/[...slug]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { WaveTrendData } from "@/app/api/assets/types/crypto";
import {
  toUnixTimestamp,
  toNumber,
  toBoolean,
  TIMEFRAMES,
  CROSS_TF_WT_MAPPING,
  CROSS_TF_SIGNAL_MAPPING,
} from "@/app/api/assets/types/crypto-utils";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    // Await params for Next.js 15+
    const { slug } = await context.params;

    // Parse slug: ["BTC", "USDT", "1h"] -> symbol: "BTC/USDT", timeframe: "1h"
    if (!slug || slug.length < 3) {
      return NextResponse.json(
        {
          error: `Invalid path. Expected at least 3 segments, got ${
            slug?.length || 0
          }`,
        },
        { status: 400 }
      );
    }

    const timeframe = slug[slug.length - 1]; // Last element
    const symbol = slug.slice(0, -1).join("/"); // Everything before last, joined with /

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

    const indicatorData: WaveTrendData[] = candles
      .filter((candle) => candle.wt1 !== null && candle.wt2 !== null)
      .map((candle) => {
        const dataPoint: WaveTrendData = {
          time: toUnixTimestamp(candle.datetimeUtc),
          wt1: toNumber(candle.wt1),
          wt2: toNumber(candle.wt2),
          buy: toBoolean(candle.buySignal),
          sell: toBoolean(candle.sellSignal),
        };

        // Add cross-timeframe WT2 values
        if (CROSS_TF_WT_MAPPING[timeframe]) {
          if (CROSS_TF_WT_MAPPING[timeframe].includes("4h") && candle.tf4hWt2) {
            const wt2Val = toNumber(candle.tf4hWt2);
            if (wt2Val !== 0) {
              dataPoint.wt2_4h = wt2Val;
            }
          }
          if (
            CROSS_TF_WT_MAPPING[timeframe].includes("12h") &&
            candle.tf12hWt2
          ) {
            const wt2Val = toNumber(candle.tf12hWt2);
            if (wt2Val !== 0) {
              dataPoint.wt2_12h = wt2Val;
            }
          }
        }

        // Add cross-timeframe signals
        const crossSignals: { [key: string]: boolean } = {};
        if (CROSS_TF_SIGNAL_MAPPING[timeframe]) {
          if (CROSS_TF_SIGNAL_MAPPING[timeframe].includes("4h")) {
            if (candle.tf4hBuySignal) crossSignals["4h_buy"] = true;
            if (candle.tf4hSellSignal) crossSignals["4h_sell"] = true;
          }
          if (CROSS_TF_SIGNAL_MAPPING[timeframe].includes("12h")) {
            if (candle.tf12hBuySignal) crossSignals["12h_buy"] = true;
            if (candle.tf12hSellSignal) crossSignals["12h_sell"] = true;
          }
        }

        if (Object.keys(crossSignals).length > 0) {
          dataPoint.cross_signals = crossSignals;
        }

        return dataPoint;
      });

    return NextResponse.json({
      symbol: symbol,
      timeframe,
      data: indicatorData,
      count: indicatorData.length,
      timezone: "UTC",
    });
  } catch (error: unknown) {
    console.error("Error fetching wavetrend:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch wavetrend data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
