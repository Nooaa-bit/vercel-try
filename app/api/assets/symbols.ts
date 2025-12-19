// hype-hire/vercel/app/api/assets/symbols.ts
import { PrismaClient } from '@prisma/client'
import type { NextApiRequest, NextApiResponse } from 'next'

const prisma = new PrismaClient()

const VIEWABLE_TIMEFRAMES = ['5m', '30m', '1h']

interface SymbolsResponse {
  symbols: string[]
  viewable_timeframes: string[]
}

interface ErrorResponse {
  error: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SymbolsResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const symbols = await prisma.processedCandle.groupBy({
      by: ['symbol'],
      orderBy: {
        symbol: 'asc'
      }
    })

    res.status(200).json({
      symbols: symbols.map(s => s.symbol),
      viewable_timeframes: VIEWABLE_TIMEFRAMES
    })
  } catch (error) {
    console.error('Symbols API error:', error)
    res.status(500).json({ error: 'Failed to fetch symbols' })
  }
}
