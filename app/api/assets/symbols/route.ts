//hype-hire/vercel/app/api/assets/symbols/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const symbols = await prisma.processedCandle.findMany({
      select: { symbol: true },
      distinct: ["symbol"],
      orderBy: { symbol: "asc" },
    });

    return NextResponse.json({
      symbols: symbols.map((s) => s.symbol),
      viewable_timeframes: ["30m", "1h"],
    });
  } catch (error) {
    console.error("Error fetching symbols:", error);
    return NextResponse.json(
      { error: "Failed to fetch symbols" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
