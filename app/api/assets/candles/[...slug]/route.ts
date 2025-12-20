import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { CandleData } from "@/app/api/assets/types/crypto";
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
    // Await params in Next.js 15+
    const { slug } = await context.params;

    console.log("🔍 Slug array:", slug);

    if (!slug || slug.length < 3) {
      return NextResponse.json(
        {
          error: `Invalid path. Got ${slug?.length || 0} segments, expected 3+`,
          slug,
        },
        { status: 400 }
      );
    }

    const timeframe = slug[slug.length - 1];
    const symbolParts = slug.slice(0, -1);
    const symbol = symbolParts.join("/");

    console.log(`✅ Parsed: symbol="${symbol}", timeframe="${timeframe}"`);

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
      select: {
        datetimeUtc: true,
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

    console.log(`📊 Found ${candles.length} candles`);

    const candleData: CandleData[] = candles.map((candle) => ({
      time: toUnixTimestamp(candle.datetimeUtc),
      open: toNumber(candle.open),
      high: toNumber(candle.high),
      low: toNumber(candle.low),
      close: toNumber(candle.close),
      volume: candle.volume ? toNumber(candle.volume) : undefined,
    }));

    return NextResponse.json({
      symbol,
      timeframe,
      data: candleData,
      count: candleData.length,
      timezone: "UTC",
    });
  } catch (error: unknown) {
    console.error("💥 Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch candles",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
