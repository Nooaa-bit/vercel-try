// hype-hire/vercel/app/api/assets/health.ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

interface HealthResponse {
  status: string;
  timezone: string;
  mode: string;
  total_candles: number;
  unique_symbols: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  try {
    const [totalCount, symbolCount] = await Promise.all([
      prisma.processedCandle.count(),
      prisma.processedCandle.groupBy({
        by: ["symbol"],
      }),
    ]);

    res.status(200).json({
      status: "ok",
      timezone: "UTC",
      mode: "Supabase with Prisma",
      total_candles: totalCount,
      unique_symbols: symbolCount.length,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      timezone: "UTC",
      mode: "Supabase with Prisma",
      total_candles: 0,
      unique_symbols: 0,
    });
  }
}
