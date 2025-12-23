//hype-hire/vercel/app/api/assets/date-range/[...slug]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await context.params;

    if (!slug || slug.length < 2) {
      return NextResponse.json(
        {
          error:
            "Invalid path. Expected format: /api/assets/date-range/{symbol}",
        },
        { status: 400 }
      );
    }

    // Parse slug: ["BTC", "USDT"] -> symbol: "BTC/USDT"
    const symbol = slug.join("/");

    // Get min and max dates for this symbol across all timeframes
    const minCandle = await prisma.processedCandle.findFirst({
      where: { symbol },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    });

    const maxCandle = await prisma.processedCandle.findFirst({
      where: { symbol },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    });

    if (!minCandle || !maxCandle) {
      return NextResponse.json(
        { error: "No data found for symbol" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      symbol,
      min_date: minCandle.timestamp.toISOString().split("T")[0],
      max_date: maxCandle.timestamp.toISOString().split("T")[0],
      timezone: "UTC",
    });
  } catch (error: unknown) {
    console.error("Error fetching date range:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch date range",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
