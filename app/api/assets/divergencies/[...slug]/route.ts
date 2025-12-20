import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { DivergenceData } from "@/app/api/assets/types/crypto";
import {
  toUnixTimestamp,
  toNumber,
  TIMEFRAMES,
} from "@/app/api/assets/types/crypto-utils";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    // Await params (Next.js 15)
    const { slug } = await context.params;

    if (!slug || slug.length < 3) {
      return NextResponse.json(
        {
          error: `Invalid path. Expected format: /api/assets/divergencies/{symbol}/{timeframe}`,
        },
        { status: 400 }
      );
    }

    // Parse slug: ["BTC", "USDT", "1h"] -> symbol: "BTC/USDT", timeframe: "1h"
    const timeframe = slug[slug.length - 1];
    const symbol = slug.slice(0, -1).join("/");

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
        hasDivergence: true,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    const divergences: DivergenceData[] = candles.map((candle) => ({
      time: toUnixTimestamp(candle.datetimeUtc),
      candle_number: candle.candleNumber,
      signal_type: candle.buySignal ? "buy" : "sell",
      price: toNumber(candle.close),
      wt2: toNumber(candle.wt2),
      closest: {
        type: candle.divTypeClosest,
        ref_candle: candle.divRefCandleClosest,
        candles_back: candle.divCandlesBackClosest,
        price_change_pct: candle.divPriceChangePctClosest
          ? toNumber(candle.divPriceChangePctClosest)
          : null,
        wt2_change_points: candle.divWt2ChangePointsClosest
          ? toNumber(candle.divWt2ChangePointsClosest)
          : null,
        dmi: candle.divDmiClosest ? toNumber(candle.divDmiClosest) : null,
      },
      biggest: {
        type: candle.divTypeBiggest,
        ref_candle: candle.divRefCandleBiggest,
        candles_back: candle.divCandlesBackBiggest,
        price_change_pct: candle.divPriceChangePctBiggest
          ? toNumber(candle.divPriceChangePctBiggest)
          : null,
        wt2_change_points: candle.divWt2ChangePointsBiggest
          ? toNumber(candle.divWt2ChangePointsBiggest)
          : null,
        dmi: candle.divDmiBiggest ? toNumber(candle.divDmiBiggest) : null,
      },
    }));

    return NextResponse.json({
      symbol: symbol,
      timeframe,
      data: divergences,
      count: divergences.length,
      timezone: "UTC",
    });
  } catch (error: unknown) {
    console.error("Error fetching divergences:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch divergences",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
