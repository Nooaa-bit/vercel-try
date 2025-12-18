-- CreateTable
CREATE TABLE "raw_candles" (
    "id" BIGSERIAL NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "timeframe" VARCHAR(10) NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "open" DECIMAL(20,8) NOT NULL,
    "high" DECIMAL(20,8) NOT NULL,
    "low" DECIMAL(20,8) NOT NULL,
    "close" DECIMAL(20,8) NOT NULL,
    "volume" DECIMAL(20,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_candles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_candles" (
    "id" BIGSERIAL NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "timeframe" VARCHAR(10) NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "open" DECIMAL(20,8) NOT NULL,
    "high" DECIMAL(20,8) NOT NULL,
    "low" DECIMAL(20,8) NOT NULL,
    "close" DECIMAL(20,8) NOT NULL,
    "volume" DECIMAL(20,8) NOT NULL,
    "datetimeUtc" TIMESTAMP(3) NOT NULL,
    "candleNumber" INTEGER NOT NULL,
    "wt1" DECIMAL(10,4),
    "wt2" DECIMAL(10,4),
    "buySignal" BOOLEAN NOT NULL DEFAULT false,
    "sellSignal" BOOLEAN NOT NULL DEFAULT false,
    "ema50" DECIMAL(20,8),
    "ema100" DECIMAL(20,8),
    "ema200" DECIMAL(20,8),
    "tf1hEma100" DECIMAL(20,8),
    "tf1hEma200" DECIMAL(20,8),
    "tf4hEma100" DECIMAL(20,8),
    "tf4hEma200" DECIMAL(20,8),
    "tf12hEma100" DECIMAL(20,8),
    "tf12hEma200" DECIMAL(20,8),
    "tf1hEma100DistPct" DECIMAL(10,4),
    "tf1hEma200DistPct" DECIMAL(10,4),
    "tf4hEma100DistPct" DECIMAL(10,4),
    "tf4hEma200DistPct" DECIMAL(10,4),
    "tf12hEma100DistPct" DECIMAL(10,4),
    "tf12hEma200DistPct" DECIMAL(10,4),
    "tf4hBuySignal" BOOLEAN NOT NULL DEFAULT false,
    "tf4hSellSignal" BOOLEAN NOT NULL DEFAULT false,
    "tf12hBuySignal" BOOLEAN NOT NULL DEFAULT false,
    "tf12hSellSignal" BOOLEAN NOT NULL DEFAULT false,
    "tf4hWt2" DECIMAL(10,4),
    "tf12hWt2" DECIMAL(10,4),
    "hasDivergence" BOOLEAN NOT NULL DEFAULT false,
    "divTypeClosest" VARCHAR(20),
    "divRefCandleClosest" INTEGER,
    "divCandlesBackClosest" INTEGER,
    "divPriceChangePctClosest" DECIMAL(10,4),
    "divWt2ChangePointsClosest" DECIMAL(10,4),
    "divDmiClosest" DECIMAL(10,4),
    "divTypeBiggest" VARCHAR(20),
    "divRefCandleBiggest" INTEGER,
    "divCandlesBackBiggest" INTEGER,
    "divPriceChangePctBiggest" DECIMAL(10,4),
    "divWt2ChangePointsBiggest" DECIMAL(10,4),
    "divDmiBiggest" DECIMAL(10,4),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processed_candles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_query_idx" ON "raw_candles"("symbol", "timeframe", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "raw_candles_symbol_timeframe_timestamp_key" ON "raw_candles"("symbol", "timeframe", "timestamp");

-- CreateIndex
CREATE INDEX "processed_query_idx" ON "processed_candles"("symbol", "timeframe", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "processed_candles_symbol_timeframe_timestamp_key" ON "processed_candles"("symbol", "timeframe", "timestamp");
