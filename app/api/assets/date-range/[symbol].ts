// hype-hire/vercel/app/api/assets/date-range/[symbol].ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

interface DateRangeResponse {
  symbol: string;
  min_date: string | null;
  max_date: string | null;
  timezone: string;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DateRangeResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Invalid symbol" });
  }

  try {
    const result = await prisma.processedCandle.aggregate({
      where: { symbol },
      _min: { timestamp: true },
      _max: { timestamp: true },
    });

    res.status(200).json({
      symbol,
      min_date: result._min.timestamp
        ? result._min.timestamp.toISOString().split("T")[0]
        : null,
      max_date: result._max.timestamp
        ? result._max.timestamp.toISOString().split("T")[0]
        : null,
      timezone: "UTC",
    });
  } catch (error) {
    console.error("Date range API error:", error);
    res.status(500).json({ error: "Failed to fetch date range" });
  }
}
