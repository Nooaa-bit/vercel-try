-- AlterTable
ALTER TABLE "processed_candles" ADD COLUMN     "vwap" DECIMAL(10,4),
ADD COLUMN     "vwapHigher" DECIMAL(10,4);
