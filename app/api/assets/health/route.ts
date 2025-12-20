import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  TIMEFRAMES,
  VIEWABLE_TIMEFRAMES,
} from "@/app/api/assets/types/crypto-utils";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const symbolCount = await prisma.processedCandle.findMany({
      select: { symbol: true },
      distinct: ["symbol"],
    });

    return NextResponse.json({
      status: "ok",
      timezone: "UTC",
      mode: "supabase-database",
      symbols: symbolCount.length,
      timeframes: TIMEFRAMES,
      viewable_timeframes: VIEWABLE_TIMEFRAMES,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: String(error) },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
