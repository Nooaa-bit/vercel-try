"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

import {
  createChart,
  ColorType,
  LineStyle,
  Time,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import { ProtectedPage } from "@/components/ProtectedSection";

const TIMEFRAMES = ["5m", "30m", "1h"];
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/assets";

const TIMEZONE_OPTIONS = [
  { label: "UTC", offset: 0 },
  { label: "UTC+1", offset: 1 },
  { label: "UTC+2", offset: 2 },
  { label: "UTC+3", offset: 3 },
  { label: "UTC+4", offset: 4 },
  { label: "UTC+5", offset: 5 },
  { label: "UTC+6", offset: 6 },
  { label: "UTC+7", offset: 7 },
  { label: "UTC+8", offset: 8 },
  { label: "UTC+9", offset: 9 },
  { label: "UTC-5 (EST)", offset: -5 },
  { label: "UTC-6 (CST)", offset: -6 },
  { label: "UTC-7 (MST)", offset: -7 },
  { label: "UTC-8 (PST)", offset: -8 },
];

const DIVERGENCE_COLORS: Record<string, string> = {
  regular_bullish: "#00FF00",
  regular_bearish: "#FF3333",
  hidden_bullish: "#00FFFF",
  hidden_bearish: "#FFA500",
};

const EMA_COLORS = {
  "1h": { ema100: "#00FF00", ema200: "#00AA00" },
  "4h": { ema100: "#FFD700", ema200: "#FFA500" },
  "12h": { ema100: "#00BFFF", ema200: "#1E90FF" },
  own: { ema50: "#FF69B4", ema100: "#FF1493", ema200: "#C71585" },
}; //Configuration Constants Finished

interface CandleData {
  time: number;
  candle_number: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface IndicatorData {
  time: number;
  wt1: number;
  wt2: number;
  buy: boolean;
  sell: boolean;
  wt2_4h?: number;
  wt2_12h?: number;
  wt2_1h?: number;
  wt2_30m?: number;  
  vwap?: number;        
  vwapHigher?: number;    
  cross_signals?: {
    "4h_buy"?: boolean;
    "4h_sell"?: boolean;
    "12h_buy"?: boolean;
    "12h_sell"?: boolean;
    "1h_buy"?: boolean;
    "1h_sell"?: boolean;
  };
}

interface EMAData {
  [key: string]: Array<{ time: number; value: number }>;
}

interface DivergenceData {
  time: number;
  candle_number: number;
  signal_type: string;
  price: number;
  wt2: number;
  closest: unknown;
  biggest: {
    type: string;
    ref_candle: number;
    candles_back: number;
    price_change_pct: number;
    wt2_change_points: number;
    dmi: number;
  };
}

interface CachedTimeframeData {
  candles: CandleData[];
  indicators: IndicatorData[];
  emaData: EMAData;
  divergences: DivergenceData[];
  timestamp: number;
} //TypeScript Interfaces Finished

export default function Home() {
  const priceChartContainerRef = useRef<HTMLDivElement>(null);
  const indicatorChartContainerRef = useRef<HTMLDivElement>(null);
  const chartsWrapperRef = useRef<HTMLDivElement>(null);
  const crosshairLineRef = useRef<HTMLDivElement>(null);

  const priceChartRef = useRef<IChartApi | null>(null);
  const indicatorChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const wt2SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const whitespaceSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema100SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema1h100SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema1h200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema4h100SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema4h200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema12h100SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema12h200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const htfIndicatorLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const htfIndicator12hLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapHigherSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const divergenceWT2SeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(
    new Map()
  );
  const divergencePriceSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(
    new Map()
  ); //Component Definition & Refs Finished
  const referenceLinesRef = useRef<{
    overboughtLine: ISeriesApi<"Line">;
    oversoldLine: ISeriesApi<"Line">;
    zeroLine: ISeriesApi<"Line">;
  } | null>(null);

  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  const [activeSymbol, setActiveSymbol] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("activeSymbol");
      return saved || "BTC/USDT";
    }
    return "BTC/USDT";
  });
  const [activeTimeframe, setActiveTimeframe] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("activeTimeframe");
      return saved || "1h";
    }
    return "1h";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartsInitialized, setChartsInitialized] = useState(false);

  const [showControls, setShowControls] = useState(true);
  const [showAllEMAs, setShowAllEMAs] = useState(true);
  const [showEMA50, setShowEMA50] = useState(false);
  const [showEMA100, setShowEMA100] = useState(false);
  const [showEMA200, setShowEMA200] = useState(false);
  const [show1hEMA100, setShow1hEMA100] = useState(true);
  const [show1hEMA200, setShow1hEMA200] = useState(true);
  const [show4hEMA100, setShow4hEMA100] = useState(true);
  const [show4hEMA200, setShow4hEMA200] = useState(true);
  const [show12hEMA100, setShow12hEMA100] = useState(true);
  const [show12hEMA200, setShow12hEMA200] = useState(true);

  const [showRegularBullish, setShowRegularBullish] = useState(false);
  const [showRegularBearish, setShowRegularBearish] = useState(false);
  const [showHiddenBullish, setShowHiddenBullish] = useState(false);
  const [showHiddenBearish, setShowHiddenBearish] = useState(false);
  const [show4hSignals, setShow4hSignals] = useState(false);
  const [show12hSignals, setShow12hSignals] = useState(false);
  const [minDMI, setMinDMI] = useState(0);

  const [showDivergenceOnPrice, setShowDivergenceOnPrice] = useState(false);

  const [selectedTimezone, setSelectedTimezone] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("timezone");
      return saved ? parseInt(saved) : 2;
    }
    return 2;
  });

  const apiCacheRef = useRef<Map<string, CachedTimeframeData>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);
  //State Declarations (Controls) Finished

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("timezone", selectedTimezone.toString());
    }
  }, [selectedTimezone]);

  // Track if component is mounted to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);

  // Set mounted to true after first render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Persist active symbol to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSymbol", activeSymbol);
    }
  }, [activeSymbol]);

  // Persist active timeframe to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeTimeframe", activeTimeframe);
    }
  }, [activeTimeframe]);

  // Load divergence states from localStorage after mount (prevents hydration mismatch)
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      const savedRegularBullish = localStorage.getItem("showRegularBullish");
      const savedRegularBearish = localStorage.getItem("showRegularBearish");
      const savedHiddenBullish = localStorage.getItem("showHiddenBullish");
      const savedHiddenBearish = localStorage.getItem("showHiddenBearish");
      const savedDivergenceOnPrice = localStorage.getItem(
        "showDivergenceOnPrice"
      );

      if (savedRegularBullish !== null)
        setShowRegularBullish(savedRegularBullish === "true");
      if (savedRegularBearish !== null)
        setShowRegularBearish(savedRegularBearish === "true");
      if (savedHiddenBullish !== null)
        setShowHiddenBullish(savedHiddenBullish === "true");
      if (savedHiddenBearish !== null)
        setShowHiddenBearish(savedHiddenBearish === "true");
      if (savedDivergenceOnPrice !== null)
        setShowDivergenceOnPrice(savedDivergenceOnPrice === "true");
    }
  }, [mounted]);

  // Persist showRegularBullish to localStorage
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem("showRegularBullish", showRegularBullish.toString());
    }
  }, [mounted, showRegularBullish]);

  // Persist showRegularBearish to localStorage
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem("showRegularBearish", showRegularBearish.toString());
    }
  }, [mounted, showRegularBearish]);

  // Persist showHiddenBullish to localStorage
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem("showHiddenBullish", showHiddenBullish.toString());
    }
  }, [mounted, showHiddenBullish]);

  // Persist showHiddenBearish to localStorage
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem("showHiddenBearish", showHiddenBearish.toString());
    }
  }, [mounted, showHiddenBearish]);

  // Persist showDivergenceOnPrice to localStorage
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem(
        "showDivergenceOnPrice",
        showDivergenceOnPrice.toString()
      );
    }
  }, [mounted, showDivergenceOnPrice]);

  // Fetch available symbols
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const response = await fetch(`/api/assets/symbols`);
        const data = await response.json();

        if (data.symbols && data.symbols.length > 0) {
          setAvailableSymbols(data.symbols);
          if (!data.symbols.includes("BTC/USDT")) {
            setActiveSymbol(data.symbols[0]);
          }
        }
      } catch (err) {
        console.error("Error fetching symbols:", err);
      }
    };

    fetchSymbols();
  }, []);

  const convertTimezone = useCallback(
    (utcTimestamp: number): number => {
      return utcTimestamp + selectedTimezone * 3600;
    },
    [selectedTimezone]
  );

  const fetchRawData = useCallback(
    async (symbol: string, timeframe: string): Promise<void> => {
      const CACHE_TTL = 5 * 60 * 1000;
      const cacheKey = `${symbol}_${timeframe}`;
      const cached = apiCacheRef.current.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`✓ Using cached data for ${symbol} ${timeframe}`);
        setCacheVersion((v) => v + 1);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log(`🔄 Fetching ${symbol} ${timeframe} data...`);

        const [
          candlesResponse,
          indicatorResponse,
          emaResponse,
          divergencesResponse,
        ] = await Promise.all([
          fetch(`/api/assets/candles/${symbol}/${timeframe}`),
          fetch(`/api/assets/indicators/wavetrend/${symbol}/${timeframe}`),
          fetch(`/api/assets/indicators/ema/${symbol}/${timeframe}`),
          fetch(`/api/assets/divergencies/${symbol}/${timeframe}`),
        ]);

        if (
          !candlesResponse.ok ||
          !indicatorResponse.ok ||
          !emaResponse.ok ||
          !divergencesResponse.ok
        ) {
          throw new Error("Failed to fetch data");
        }

        const candlesResult = await candlesResponse.json();
        const indicatorResult = await indicatorResponse.json();
        const emaResult = await emaResponse.json();
        const divergencesResult = await divergencesResponse.json();

        const rawData: CachedTimeframeData = {
          candles: candlesResult.data || [],
          indicators: indicatorResult.data || [],
          emaData: emaResult.data || {},
          divergences: divergencesResult.data || [],
          timestamp: Date.now(),
        };

        console.log(`📊 ${symbol} ${timeframe} fetched:`, {
          candles: rawData.candles.length,
          indicators: rawData.indicators.length,
          emas: Object.keys(rawData.emaData).length,
          divergences: rawData.divergences.length,
        });

        if (rawData.candles.length === 0) {
          throw new Error("No candle data received");
        }

        apiCacheRef.current.set(cacheKey, rawData);
        setCacheVersion((v) => v + 1);
        console.log(
          `✓ Cached ${rawData.candles.length} candles for ${symbol} ${timeframe}`
        );
      } catch (err) {
        console.error(`❌ Error fetching ${symbol} ${timeframe}:`, err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getCachedData = useCallback((): CachedTimeframeData | null => {
    const cacheKey = `${activeSymbol}_${activeTimeframe}`;
    const data = apiCacheRef.current.get(cacheKey);
    if (!data) {
      console.warn(`⚠️ No cached data for ${activeSymbol} ${activeTimeframe}`);
      return null;
    }
    return data;
  }, [activeSymbol, activeTimeframe, cacheVersion]); // Imports and Setup section finished

  const convertedCandles = useMemo(() => {
    //Convert backend CandleData into the lightweight‑charts format
    const cached = getCachedData();
    if (!cached) return [];

    return cached.candles.map((candle) => ({
      time: convertTimezone(candle.time) as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
  }, [getCachedData, convertTimezone]); //Convert backend CandleData into the lightweight‑charts format

  const whitespaceData = useMemo(() => {
    //control autoscaling and reference line ranges
    const cached = getCachedData();
    if (!cached) return [];

    return cached.candles.map((candle) => ({
      time: convertTimezone(candle.time) as Time,
    }));
  }, [getCachedData, convertTimezone]); //control autoscaling and reference line ranges

  const convertedWT2 = useMemo(() => {
    //indicators and candles may not align
    const cached = getCachedData();
    if (!cached) {
      console.warn(`⚠️ convertedWT2: No cache for ${activeTimeframe}`);
      return [];
    }

    console.log(`📊 Building WT2 for ${activeTimeframe}:`, {
      candles: cached.candles.length,
      indicators: cached.indicators.length,
    });

    const wt2Map = new Map<number, number>();
    let validWt2Count = 0;

    cached.indicators.forEach((ind) => {
      if (ind.wt2 !== null && ind.wt2 !== undefined && !isNaN(ind.wt2)) {
        wt2Map.set(ind.time, ind.wt2);
        validWt2Count++;
      }
    });

    console.log(`  Built WT2 map: ${validWt2Count} valid entries`);

    if (validWt2Count === 0) {
      console.error(
        `❌ NO VALID WT2 DATA in indicators for ${activeTimeframe}!`
      );
      return [];
    }

    const result = cached.candles
      .map((candle) => {
        const wt2Value = wt2Map.get(candle.time);
        if (wt2Value !== undefined) {
          return {
            time: convertTimezone(candle.time) as Time,
            value: wt2Value,
          };
        }
        return null;
      })
      .filter((d) => d !== null) as Array<{ time: Time; value: number }>;

    console.log(`  ✓ Mapped ${result.length} WT2 points`);

    if (result.length === 0) {
      console.error(`❌ NO WT2 POINTS MAPPED for ${activeTimeframe}!`);
    }

    return result;
  }, [getCachedData, convertTimezone, activeTimeframe]); //indicators and candles may not align

  const htfIndicatorLine = useMemo(() => {
    //Higher timeframe 4H indicator line - only show on 30m and 1h
    const cached = getCachedData();

    // Only show 4H WT2 line on 30m and 1h timeframes
    if (!cached || !["30m", "1h"].includes(activeTimeframe)) {
      return [];
    }

    // Create a set of valid candle times for filtering
    const validCandleTimes = new Set(cached.candles.map((c) => c.time));

    const result = cached.indicators
      .filter((indicator) => {
        // Must have valid 4h_wt2 data and match candle times
        if (!indicator.wt2_4h || indicator.wt2_4h === 0) return false;
        // For 1h: be less strict - include if indicator has the data
        if (activeTimeframe === "1h") {
          return true; // Don't filter by validCandleTimes for 1h
        }

        // For 30m: strictly match candle times
        return validCandleTimes.has(indicator.time);
      })
      .map((indicator) => {
        const wt2Value = indicator.wt2_4h ?? 0;

        let color = "#0a0808ea"; // default
        if (wt2Value < -65) {
          color = "#0b610bff"; // dark green
        } else if (wt2Value < -50) {
          color = "#00FF00"; // green
        } else if (wt2Value > 50) {
          color = "#FF0000"; // red
        }

        return {
          time: convertTimezone(indicator.time) as Time,
          value: -95, // Position below the chart
          color: color,
        };
      });

    console.log(
      `📍 4H WT2 line: ${result.length} points for ${activeTimeframe}`
    );
    return result;
  }, [getCachedData, convertTimezone, activeTimeframe]); //Higher timeframe 4H indicator line

  const htfIndicator12hLine = useMemo(() => {
    //Higher timeframe 12H indicator line - only show on 1h
    const cached = getCachedData();

    // Only show 12H WT2 line on 1h timeframe
    if (!cached || activeTimeframe !== "1h") {
      return [];
    }

    const result = cached.indicators // For 1h timeframe, don't filter by candle times - just use the indicator data directly
      .filter((indicator) => {
        // Must have valid 12h_wt2 data
        return indicator.wt2_12h !== undefined && indicator.wt2_12h !== 0;
      })
      .map((indicator) => {
        const wt2Value = indicator.wt2_12h ?? 0;

        // Determine color
        let color = "#0a0808ea"; // default
        if (wt2Value < -65) {
          color = "#0b610bff"; // dark green
        } else if (wt2Value < -50) {
          color = "#00FF00"; // green
        } else if (wt2Value > 50) {
          color = "#FF0000"; // red
        }

        return {
          time: convertTimezone(indicator.time) as Time,
          value: -140, // Position below 4h line
          color: color,
        };
      });

    console.log(
      `📍 12H WT2 line: ${result.length} points for ${activeTimeframe}`
    );
    return result;
  }, [getCachedData, convertTimezone, activeTimeframe]);

  // VWAP data processing
  const { vwapData, vwapHigherData } = useMemo(() => {
    const cached = getCachedData();
    if (!cached) {
      return { vwapData: [], vwapHigherData: [] };
    }

    const vwapMap = new Map<number, number>();
    const vwapHigherMap = new Map<number, number>();

    cached.indicators.forEach((ind) => {
      if (ind.vwap !== null && ind.vwap !== undefined && !isNaN(ind.vwap)) {
        vwapMap.set(ind.time, ind.vwap);
      }
      if (
        ind.vwapHigher !== null &&
        ind.vwapHigher !== undefined &&
        !isNaN(ind.vwapHigher) &&
        ind.vwapHigher !== 0
      ) {
        vwapHigherMap.set(ind.time, ind.vwapHigher);
      }
    });

    const vwap = cached.candles
      .map((candle) => {
        const vwapValue = vwapMap.get(candle.time);
        if (vwapValue !== undefined) {
          return {
            time: convertTimezone(candle.time) as Time,
            value: vwapValue,
          };
        }
        return null;
      })
      .filter((d) => d !== null) as Array<{ time: Time; value: number }>;

    const vwapHigher = cached.candles
      .map((candle) => {
        const vwapHigherValue = vwapHigherMap.get(candle.time);
        if (vwapHigherValue !== undefined) {
          return {
            time: convertTimezone(candle.time) as Time,
            value: vwapHigherValue,
          };
        }
        return null;
      })
      .filter((d) => d !== null) as Array<{ time: Time; value: number }>;

    console.log(
      `📊 VWAP data: ${vwap.length} points, VWAPHigher: ${vwapHigher.length} points`
    );

    return { vwapData: vwap, vwapHigherData: vwapHigher };
  }, [getCachedData, convertTimezone]); // VWAP data processing end

  // Buy/Sell signal markers start
  const { buySignals, sellSignals } = useMemo(() => {
    const cached = getCachedData();
    if (!cached) return { buySignals: [], sellSignals: [] };

    const buy = cached.indicators
      .filter((d) => d.buy === true)
      .map((d) => ({
        time: convertTimezone(d.time) as Time,
        position: "belowBar" as const,
        color: "#26a69a",
        shape: "circle" as const,
        text: "",
      }));

    const sell = cached.indicators
      .filter((d) => d.sell === true)
      .map((d) => ({
        time: convertTimezone(d.time) as Time,
        position: "aboveBar" as const,
        color: "#ef5350",
        shape: "circle" as const,
        text: "",
      }));

    return { buySignals: buy, sellSignals: sell };
  }, [getCachedData, convertTimezone]); // Buy/Sell signal markers end

  // Cross-timeframe signal markers start
  const crossTimeframeSignals = useMemo(() => {
    const cached = getCachedData();
    if (!cached) return { "4h": [], "12h": [] };

    const signals4h: Array<{
      time: Time;
      position: "belowBar" | "aboveBar";
      color: string;
      shape: "arrowUp" | "arrowDown";
      text: string;
      size: number;
    }> = [];
    const signals12h: Array<{
      time: Time;
      position: "belowBar" | "aboveBar";
      color: string;
      shape: "arrowUp" | "arrowDown";
      text: string;
      size: number;
    }> = [];

    cached.indicators.forEach((indicator) => {
      if (!indicator.cross_signals) return;

      const time = convertTimezone(indicator.time) as Time;

      // 4h signals
      if (show4hSignals) {
        if (indicator.cross_signals["4h_buy"]) {
          signals4h.push({
            time: time,
            position: "belowBar" as const,
            color: "#00FF00",
            shape: "arrowUp" as const,
            text: "4",
            size: 2,
          });
        }
        if (indicator.cross_signals["4h_sell"]) {
          signals4h.push({
            time: time,
            position: "aboveBar" as const,
            color: "#FF0000",
            shape: "arrowDown" as const,
            text: "4",
            size: 2,
          });
        }
      }

      // 12h signals
      if (show12hSignals) {
        if (indicator.cross_signals["12h_buy"]) {
          signals12h.push({
            time: time,
            position: "belowBar" as const,
            color: "#00FFFF",
            shape: "arrowUp" as const,
            text: "12",
            size: 2,
          });
        }
        if (indicator.cross_signals["12h_sell"]) {
          signals12h.push({
            time: time,
            position: "aboveBar" as const,
            color: "#FF00FF",
            shape: "arrowDown" as const,
            text: "12",
            size: 2,
          });
        }
      }
    });

    return { "4h": signals4h, "12h": signals12h };
  }, [getCachedData, convertTimezone, show4hSignals, show12hSignals]); // Cross-timeframe signal markers end

  // EMA data processing start
  const convertedEMAs = useMemo(() => {
    const cached = getCachedData();
    if (!cached) {
      return {
        ema50: [],
        ema100: [],
        ema200: [],
        ema1h100: [],
        ema1h200: [],
        ema4h100: [],
        ema4h200: [],
        ema12h100: [],
        ema12h200: [],
      };
    }

    const convertEMA = (key: string) =>
      cached.emaData[key]
        ? cached.emaData[key].map((d) => ({
            time: convertTimezone(d.time) as Time,
            value: d.value,
          }))
        : [];

    return {
      ema50: convertEMA("ema_50"),
      ema100: convertEMA("ema_100"),
      ema200: convertEMA("ema_200"),
      ema1h100: convertEMA("1h_ema_100"),
      ema1h200: convertEMA("1h_ema_200"),
      ema4h100: convertEMA("4h_ema_100"),
      ema4h200: convertEMA("4h_ema_200"),
      ema12h100: convertEMA("12h_ema_100"),
      ema12h200: convertEMA("12h_ema_200"),
    };
  }, [getCachedData, convertTimezone]); // Cross-timeframe signal markers end

  // Divergence statistics
  const filteredDivergenceStats = useMemo(() => {
    const cached = getCachedData();
    if (!cached) return { total: 0, filtered: 0 };

    const total = cached.divergences.length;
    const filtered = cached.divergences.filter(
      (div) => div.biggest.dmi >= minDMI
    ).length;

    return { total, filtered };
  }, [getCachedData, minDMI]);

  // Update divergence lines on WT2 chart
  const updateDivergenceLinesWT2 = useCallback(() => {
    if (!indicatorChartRef.current) return;

    const cached = getCachedData();
    if (!cached || cached.divergences.length === 0) return;

    // Clear existing WT2 divergence lines
    divergenceWT2SeriesRef.current.forEach((series) => {
      indicatorChartRef.current!.removeSeries(series);
    });
    divergenceWT2SeriesRef.current.clear();

    const enabledTypes = new Set<string>();
    if (showRegularBullish) enabledTypes.add("regular_bullish");
    if (showRegularBearish) enabledTypes.add("regular_bearish");
    if (showHiddenBullish) enabledTypes.add("hidden_bullish");
    if (showHiddenBearish) enabledTypes.add("hidden_bearish");

    if (enabledTypes.size === 0) return;

    const candleMap = new Map(cached.candles.map((c) => [c.candle_number, c]));
    const indicatorMap = new Map(
      cached.indicators.map((ind) => [ind.time, ind.wt2])
    );

    let lineCount = 0;

    cached.divergences.forEach((div, idx) => {
      const divInfo = div.biggest;
      if (divInfo.dmi < minDMI || !enabledTypes.has(divInfo.type)) return;

      const refCandle = candleMap.get(divInfo.ref_candle);
      if (!refCandle) return;

      const currentWT2 = indicatorMap.get(div.time);
      const refWT2 = indicatorMap.get(refCandle.time);

      if (
        currentWT2 === undefined ||
        refWT2 === undefined ||
        isNaN(currentWT2) ||
        isNaN(refWT2)
      ) {
        return;
      }

      const color = DIVERGENCE_COLORS[divInfo.type] || "#FFFFFF";

      const lineSeries = indicatorChartRef.current!.addLineSeries({
        color: color,
        lineWidth: 2,
        lineStyle: 2,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      // In updateDivergenceLinesWT2
      if (refCandle.time === div.time) {
        console.warn(
          `⚠️ Skipping self-referencing WT2 divergence at ${refCandle.time}`
        );
        return;
      }

      const points = [
        { time: convertTimezone(refCandle.time) as Time, value: refWT2 },
        { time: convertTimezone(div.time) as Time, value: currentWT2 },
      ].sort((a, b) => (a.time as number) - (b.time as number));

      lineSeries.setData(points); // 👈 Use sorted points

      divergenceWT2SeriesRef.current.set(`${divInfo.type}_${idx}`, lineSeries);
      lineCount++;
    });

    console.log(`✓ Drew ${lineCount} WT2 divergence lines`);
  }, [
    getCachedData,
    convertTimezone,
    showRegularBullish,
    showRegularBearish,
    showHiddenBullish,
    showHiddenBearish,
    minDMI,
  ]); //Divergence lines on WT2 chart end

  // Update divergence lines on Price chart
  const updateDivergenceLinesPrice = useCallback(() => {
    if (!priceChartRef.current) {
      console.log("⚠️ Price chart ref not available");
      return;
    }

    const cached = getCachedData();
    if (!cached || cached.divergences.length === 0) {
      console.log("⚠️ No cached data or divergences");
      return;
    }

    console.log("🎨 updateDivergenceLinesPrice called:", {
      showDivergenceOnPrice,
      divergenceCount: cached.divergences.length,
      candleCount: cached.candles.length,
    });

    // Clear existing price divergence lines
    divergencePriceSeriesRef.current.forEach((series) => {
      priceChartRef.current!.removeSeries(series);
    });
    divergencePriceSeriesRef.current.clear();

    if (!showDivergenceOnPrice) {
      console.log("⚠️ Price divergences disabled");
      return;
    }

    const enabledTypes = new Set<string>();
    if (showRegularBullish) enabledTypes.add("regular_bullish");
    if (showRegularBearish) enabledTypes.add("regular_bearish");
    if (showHiddenBullish) enabledTypes.add("hidden_bullish");
    if (showHiddenBearish) enabledTypes.add("hidden_bearish");

    console.log("  Enabled types:", Array.from(enabledTypes));

    if (enabledTypes.size === 0) {
      console.log("⚠️ No divergence types enabled");
      return;
    }

    const candleMap = new Map(cached.candles.map((c, idx) => [idx + 1, c]));
    const candleTimeMap = new Map(cached.candles.map((c) => [c.time, c]));

    console.log("  Candle maps created:", {
      byIndex: candleMap.size,
      byTime: candleTimeMap.size,
    });

    let lineCount = 0;
    let skippedDMI = 0;
    let skippedType = 0;
    let skippedMissingCandle = 0;

    cached.divergences.forEach((div, idx) => {
      const divInfo = div.biggest;
      if (divInfo.dmi < minDMI) {
        skippedDMI++;
        return;
      }

      if (!enabledTypes.has(divInfo.type)) {
        skippedType++;
        return;
      }

      const refCandle = candleMap.get(divInfo.ref_candle);
      const currentCandle = candleTimeMap.get(div.time);

      if (!refCandle || !currentCandle) {
        skippedMissingCandle++;
        if (idx < 3) {
          console.log(`  ✗ Missing candle for div ${idx}:`, {
            refCandleNum: divInfo.ref_candle,
            refCandleFound: !!refCandle,
            divTime: div.time,
            currentCandleFound: !!currentCandle,
          });
        }
        return;
      }

      if (refCandle.time === currentCandle.time) {
        console.warn(
          `⚠️ Skipping self-referencing divergence at ${refCandle.time}`
        );
        return;
      }

      const color = DIVERGENCE_COLORS[divInfo.type] || "#FFFFFF";

      try {
        const lineSeries = priceChartRef.current!.addLineSeries({
          color: color,
          lineWidth: 3,
          lineStyle: 2,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
        });

        // 👇 SORT THE POINTS BY TIME
        const points = [
          {
            time: convertTimezone(refCandle.time) as Time,
            value: refCandle.close,
          },
          {
            time: convertTimezone(currentCandle.time) as Time,
            value: currentCandle.close,
          },
        ].sort((a, b) => (a.time as number) - (b.time as number));

        lineSeries.setData(points); // 👈 Use sorted points

        divergencePriceSeriesRef.current.set(
          `price_${divInfo.type}_${idx}`,
          lineSeries
        );
        lineCount++;

        if (lineCount <= 3) {
          console.log(`  ✓ Drew line ${lineCount}:`, {
            type: divInfo.type,
            refTime: refCandle.time,
            currentTime: currentCandle.time,
            refPrice: refCandle.close,
            currentPrice: currentCandle.close,
          });
        }
      } catch (err) {
        console.error(`  ✗ Error creating line ${idx}:`, err);
      }
    });

    console.log(`✅ PRICE divergence lines summary:`, {
      created: lineCount,
      skippedDMI,
      skippedType,
      skippedMissingCandle,
      totalDivergences: cached.divergences.length,
    });
  }, [
    getCachedData,
    convertTimezone,
    showDivergenceOnPrice,
    showRegularBullish,
    showRegularBearish,
    showHiddenBullish,
    showHiddenBearish,
    minDMI,
  ]); //Update divergence lines on Price chart end
  //Data Processing and useMemo Hooks finished

  //Chart Updates, Initialization
  // Main chart update effect. The Heart of Rendering. This is the master orchestrator - a massive useEffect that ties all the data transformations to chart updates. It runs whenever any data changes.
  useEffect(() => {
    if (
      !chartsInitialized ||
      !candleSeriesRef.current ||
      !wt2SeriesRef.current ||
      !whitespaceSeriesRef.current
    ) {
      return;
    }

    if (convertedCandles.length === 0) {
      console.warn(
        `⚠️ Skipping chart update: no candles for ${activeTimeframe}`
      );
      return;
    }

    console.log(`📈 Updating charts for ${activeTimeframe}`);

    try {
      // FORCE RESET: Clear all data first
      whitespaceSeriesRef.current.setData([]);
      candleSeriesRef.current.setData([]);
      wt2SeriesRef.current.setData([]);
      if (htfIndicatorLineRef.current) htfIndicatorLineRef.current.setData([]);
      if (htfIndicator12hLineRef.current)
        htfIndicator12hLineRef.current.setData([]);

      // Force a paint cycle, then set new data
      requestAnimationFrame(() => {
        try {
          if (
            !candleSeriesRef.current ||
            !wt2SeriesRef.current ||
            !whitespaceSeriesRef.current
          )
            return;

          whitespaceSeriesRef.current.setData(whitespaceData);
          candleSeriesRef.current.setData(convertedCandles);

          if (convertedWT2.length > 0) {
            wt2SeriesRef.current.setData(convertedWT2);

            // Set VWAP data
            if (vwapSeriesRef.current) {
              vwapSeriesRef.current.setData(vwapData);
              console.log(`✓ Set VWAP: ${vwapData.length} points`);
            }

            // Set VWAP Higher data
            if (vwapHigherSeriesRef.current) {
              vwapHigherSeriesRef.current.setData(vwapHigherData);
              console.log(`✓ Set VWAP Higher: ${vwapHigherData.length} points`);
            }

            // Update HTF indicator line (4h)
            if (htfIndicatorLineRef.current) {
              if (htfIndicatorLine.length > 0) {
                const segments = htfIndicatorLine.map(
                  (point: { time: Time; value: number; color: string }) => ({
                    time: point.time,
                    value: point.value,
                    color: point.color,
                  })
                );
                htfIndicatorLineRef.current.setData(segments);
                console.log(`✓ Set 4H line: ${segments.length} points`);
              } else {
                htfIndicatorLineRef.current.setData([]);
                console.log(
                  `✓ Cleared 4H line (not applicable for ${activeTimeframe})`
                );
              }
            }

            // Update HTF indicator line (12h)
            if (htfIndicator12hLineRef.current) {
              if (htfIndicator12hLine.length > 0) {
                const segments = htfIndicator12hLine.map(
                  (point: { time: Time; value: number; color: string }) => ({
                    time: point.time,
                    value: point.value,
                    color: point.color,
                  })
                );
                htfIndicator12hLineRef.current.setData(segments);
                console.log(`✓ Set 12H line: ${segments.length} points`);
              } else {
                htfIndicator12hLineRef.current.setData([]);
                console.log(
                  `✓ Cleared 12H line (not applicable for ${activeTimeframe})`
                );
              }
            }

            // Markers on PRICE chart (cross-TF signals)
            const allMarkers = [
              ...crossTimeframeSignals["4h"],
              ...crossTimeframeSignals["12h"],
            ].sort((a, b) => (a.time as number) - (b.time as number));

            candleSeriesRef.current.setMarkers(allMarkers);

            // Keep WT2 markers separate (own timeframe signals only)
            const wt2Markers = [...buySignals, ...sellSignals].sort(
              (a, b) => (a.time as number) - (b.time as number)
            );

            wt2SeriesRef.current.setMarkers(wt2Markers);

            const firstTime = convertedCandles[0].time; // Set overbought/oversold lines on WT2 chart
            const lastTime = convertedCandles[convertedCandles.length - 1].time;

            const refs = referenceLinesRef.current;
            if (refs) {
              refs.overboughtLine.setData([
                { time: firstTime, value: 80 },
                { time: lastTime, value: 80 },
              ]);
              refs.oversoldLine.setData([
                { time: firstTime, value: -80 },
                { time: lastTime, value: -80 },
              ]);
              refs.zeroLine.setData([
                { time: firstTime, value: 0 },
                { time: lastTime, value: 0 },
              ]);
            }
          } else {
            console.error(`❌ No WT2 data to display for ${activeTimeframe}`);
            wt2SeriesRef.current.setData([]);
          } // Set overbought/oversold lines on WT2 chart end

          // Update EMAs
          if (activeTimeframe === "1w") {
            if (ema50SeriesRef.current && convertedEMAs.ema50.length > 0) {
              ema50SeriesRef.current.setData(convertedEMAs.ema50);
            }
            if (ema100SeriesRef.current) ema100SeriesRef.current.setData([]);
            if (ema200SeriesRef.current) ema200SeriesRef.current.setData([]);
          } else {
            if (ema100SeriesRef.current && convertedEMAs.ema100.length > 0) {
              ema100SeriesRef.current.setData(convertedEMAs.ema100);
            }
            if (ema200SeriesRef.current && convertedEMAs.ema200.length > 0) {
              ema200SeriesRef.current.setData(convertedEMAs.ema200);
            }
            if (ema50SeriesRef.current) ema50SeriesRef.current.setData([]);
          }

          if (ema1h100SeriesRef.current && convertedEMAs.ema1h100.length > 0) {
            ema1h100SeriesRef.current.setData(convertedEMAs.ema1h100);
          }
          if (ema1h200SeriesRef.current && convertedEMAs.ema1h200.length > 0) {
            ema1h200SeriesRef.current.setData(convertedEMAs.ema1h200);
          }
          if (ema4h100SeriesRef.current && convertedEMAs.ema4h100.length > 0) {
            ema4h100SeriesRef.current.setData(convertedEMAs.ema4h100);
          }
          if (ema4h200SeriesRef.current && convertedEMAs.ema4h200.length > 0) {
            ema4h200SeriesRef.current.setData(convertedEMAs.ema4h200);
          }
          if (
            ema12h100SeriesRef.current &&
            convertedEMAs.ema12h100.length > 0
          ) {
            ema12h100SeriesRef.current.setData(convertedEMAs.ema12h100);
          }
          if (
            ema12h200SeriesRef.current &&
            convertedEMAs.ema12h200.length > 0
          ) {
            ema12h200SeriesRef.current.setData(convertedEMAs.ema12h200);
          }

          // Fit content after all data is rendered
          requestAnimationFrame(() => {
            if (priceChartRef.current && indicatorChartRef.current) {
              // Fit both charts
              priceChartRef.current.timeScale().fitContent();
              indicatorChartRef.current.timeScale().fitContent();

              // Explicitly sync the charts after fitting
              setTimeout(() => {
                if (priceChartRef.current && indicatorChartRef.current) {
                  const priceRange = priceChartRef.current
                    .timeScale()
                    .getVisibleLogicalRange();
                  if (priceRange) {
                    indicatorChartRef.current
                      .timeScale()
                      .setVisibleLogicalRange(priceRange);
                  }
                }
              }, 10);

              setTimeout(() => {
                updateDivergenceLinesWT2();
                updateDivergenceLinesPrice();
              }, 100);
            }
          });

          console.log(`✓ Charts updated for ${activeTimeframe}`);
        } catch (innerErr) {
          console.error("❌ Error in requestAnimationFrame:", innerErr);
        }
      });
    } catch (err) {
      console.error("❌ Error updating charts:", err);
    }
  }, [
    convertedCandles,
    convertedWT2,
    vwapData,
    vwapHigherData,
    htfIndicatorLine,
    htfIndicator12hLine,
    buySignals,
    sellSignals,
    crossTimeframeSignals,
    convertedEMAs,
    whitespaceData,
    activeTimeframe,
    chartsInitialized,
    updateDivergenceLinesWT2,
    updateDivergenceLinesPrice,
  ]);

  //specialized useEffect hooks. handle incremental updates after main chart update. Performance optimizations that prevent re-running expensive operations unnecessarily.
  // Markers Update Effect start
  useEffect(() => {
    if (!chartsInitialized || !candleSeriesRef.current || !wt2SeriesRef.current)
      return;

    // Update price chart markers (cross-TF signals)
    const allMarkers = [
      ...crossTimeframeSignals["4h"],
      ...crossTimeframeSignals["12h"],
    ].sort((a, b) => (a.time as number) - (b.time as number));

    candleSeriesRef.current.setMarkers(allMarkers);

    // Update WT2 markers (own signals only)
    const wt2Markers = [...buySignals, ...sellSignals].sort(
      (a, b) => (a.time as number) - (b.time as number)
    );

    wt2SeriesRef.current.setMarkers(wt2Markers);

    console.log(
      `✓ Updated markers: ${allMarkers.length} on price, ${wt2Markers.length} on WT2`
    );
  }, [chartsInitialized, buySignals, sellSignals, crossTimeframeSignals]); // Markers Update Effect end

  // EMA visibility
  useEffect(() => {
    if (!chartsInitialized) return;

    const allOff = !showAllEMAs;

    if (activeTimeframe === "1w") {
      ema50SeriesRef.current?.applyOptions({ visible: !allOff && showEMA50 });
      ema100SeriesRef.current?.applyOptions({ visible: false });
      ema200SeriesRef.current?.applyOptions({ visible: false });
    } else {
      ema50SeriesRef.current?.applyOptions({ visible: false });
      ema100SeriesRef.current?.applyOptions({ visible: !allOff && showEMA100 });
      ema200SeriesRef.current?.applyOptions({ visible: !allOff && showEMA200 });
    }

    ema1h100SeriesRef.current?.applyOptions({
      visible: !allOff && show1hEMA100,
    });
    ema1h200SeriesRef.current?.applyOptions({
      visible: !allOff && show1hEMA200,
    });
    ema4h100SeriesRef.current?.applyOptions({
      visible: !allOff && show4hEMA100,
    });
    ema4h200SeriesRef.current?.applyOptions({
      visible: !allOff && show4hEMA200,
    });
    ema12h100SeriesRef.current?.applyOptions({
      visible: !allOff && show12hEMA100,
    });
    ema12h200SeriesRef.current?.applyOptions({
      visible: !allOff && show12hEMA200,
    });
  }, [
    showAllEMAs,
    showEMA50,
    showEMA100,
    showEMA200,
    show1hEMA100,
    show1hEMA200,
    show4hEMA100,
    show4hEMA200,
    show12hEMA100,
    show12hEMA200,
    activeTimeframe,
    chartsInitialized,
  ]);

  // Divergence visibility (updates both charts)
  useEffect(() => {
    if (!chartsInitialized) return;

    updateDivergenceLinesWT2();
    updateDivergenceLinesPrice();
  }, [
    chartsInitialized,
    showDivergenceOnPrice,
    showRegularBullish,
    showRegularBearish,
    showHiddenBullish,
    showHiddenBearish,
    minDMI,
    updateDivergenceLinesWT2,
    updateDivergenceLinesPrice,
  ]);

  // Data Fetch Trigger
  useEffect(() => {
    if (!chartsInitialized) return;

    console.log(`🔄 Loading ${activeSymbol} ${activeTimeframe}`);
    fetchRawData(activeSymbol, activeTimeframe);
  }, [activeSymbol, activeTimeframe, chartsInitialized, fetchRawData]);

  //Toggle All EMAs Helper
  const toggleAllEMAs = () => {
    const newState = !showAllEMAs;
    setShowAllEMAs(newState);

    if (!newState) {
      setShowEMA50(false);
      setShowEMA100(false);
      setShowEMA200(false);
      setShow1hEMA100(false);
      setShow1hEMA200(false);
      setShow4hEMA100(false);
      setShow4hEMA200(false);
      setShow12hEMA100(false);
      setShow12hEMA200(false);
    } else {
      setShow1hEMA100(true);
      setShow1hEMA200(true);
      setShow4hEMA100(true);
      setShow4hEMA200(true);
      setShow12hEMA100(true);
      setShow12hEMA200(true);
    }
  }; //specialized useEffect hooks end

  // Initialize charts
  useEffect(() => {
    if (!priceChartContainerRef.current || !indicatorChartContainerRef.current)
      return;

    console.log("🎨 Initializing charts...");

    // Price chart + EMAs
    const chartWidth = priceChartContainerRef.current.clientWidth;
    const priceChartHeight = Math.floor(window.innerHeight * 0.4);
    const indicatorChartHeight = Math.floor(window.innerHeight * 0.4);

    const priceChart = createChart(priceChartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#222" },
        textColor: "#DDD",
      },
      width: chartWidth,
      height: priceChartHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 6,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      grid: {
        vertLines: { color: "#333" },
        horzLines: { color: "#333" },
      },
      rightPriceScale: {
        visible: true,
      },
      localization: {
        priceFormatter: (price: number) => {
          // Smart formatting by price magnitude
          if (price >= 1000) return price.toFixed(2); // BTC
          if (price >= 1) return price.toFixed(4); // ETH
          if (price >= 0.01) return price.toFixed(6); // Most alts
          return price.toFixed(8); // Microcaps
        },
      },
    });

    priceChartRef.current = priceChart;

    const candleSeries = priceChart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    candleSeriesRef.current = candleSeries;

    // 9 EMA series (own timeframe + HTF)
    ema50SeriesRef.current = priceChart.addLineSeries({
      color: EMA_COLORS.own.ema50,
      lineWidth: 2,
      title: "Own EMA 50",
      lineStyle: LineStyle.Solid,
      visible: false,
    });

    ema100SeriesRef.current = priceChart.addLineSeries({
      color: EMA_COLORS.own.ema100,
      lineWidth: 2,
      title: "Own EMA 100",
      lineStyle: LineStyle.Solid,
      visible: false,
    });

    ema200SeriesRef.current = priceChart.addLineSeries({
      color: EMA_COLORS.own.ema200,
      lineWidth: 2,
      title: "Own EMA 200",
      lineStyle: LineStyle.Dashed,
      visible: false,
    });

    ema1h100SeriesRef.current = priceChart.addLineSeries({
      color: EMA_COLORS["1h"].ema100,
      lineWidth: 2,
      title: "1h EMA 100",
      lineStyle: LineStyle.Solid,
      visible: true,
    });

    ema1h200SeriesRef.current = priceChart.addLineSeries({
      color: EMA_COLORS["1h"].ema200,
      lineWidth: 2,
      title: "1h EMA 200",
      lineStyle: LineStyle.Dashed,
      visible: true,
    });

    ema4h100SeriesRef.current = priceChart.addLineSeries({
      color: EMA_COLORS["4h"].ema100,
      lineWidth: 2,
      title: "4h EMA 100",
      lineStyle: LineStyle.Solid,
      visible: true,
    });

    ema4h200SeriesRef.current = priceChart.addLineSeries({
      color: EMA_COLORS["4h"].ema200,
      lineWidth: 2,
      title: "4h EMA 200",
      lineStyle: LineStyle.Dashed,
      visible: true,
    });

    ema12h100SeriesRef.current = priceChart.addLineSeries({
      color: EMA_COLORS["12h"].ema100,
      lineWidth: 2,
      title: "12h EMA 100",
      lineStyle: LineStyle.Solid,
      visible: true,
    });

    ema12h200SeriesRef.current = priceChart.addLineSeries({
      color: EMA_COLORS["12h"].ema200,
      lineWidth: 2,
      title: "12h EMA 200",
      lineStyle: LineStyle.Dashed,
      visible: true,
    });

    // Indicator chart (WT2 + reference lines, second chart that scrolls in sync)
    const indicatorChart = createChart(indicatorChartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#222" },
        textColor: "#DDD",
      },
      width: chartWidth,
      height: indicatorChartHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 6,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      grid: {
        vertLines: { color: "#333" },
        horzLines: { color: "#333" },
      },
      rightPriceScale: {
        visible: true,
      },
    });

    indicatorChartRef.current = indicatorChart;

    whitespaceSeriesRef.current = indicatorChart.addLineSeries({
      color: "transparent",
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      autoscaleInfoProvider: () => ({
        priceRange: {
          minValue: -100,
          maxValue: 100,
        },
      }),
    }); //Invisible series that controls the chart's Y-axis scaling. Without it, if WT2 values are all near 0, the chart would zoom in too tight.

    // HTF Indicator Line - 4H WT2
    htfIndicatorLineRef.current = indicatorChart.addLineSeries({
      lineWidth: 4,
      lastValueVisible: false,
      priceLineVisible: false,
      lineType: 2, // Step line
      title: "4H WT2",
    });

    // HTF Indicator Line - 12H WT2
    htfIndicator12hLineRef.current = indicatorChart.addLineSeries({
      lineWidth: 4,
      lastValueVisible: false,
      priceLineVisible: false,
      lineType: 2, // Step line
      title: "12H WT2",
      color: "#0a0808ea",
    });

    wt2SeriesRef.current = indicatorChart.addLineSeries({
      color: "#2962FF",
      lineWidth: 2,
      lineStyle: LineStyle.Solid, // Smooth line
      lastValueVisible: true, // Shows current value on right
      priceLineVisible: false, // No horizontal line
      autoscaleInfoProvider: () => ({
        priceRange: {
          minValue: -100,
          maxValue: 100,
        },
      }),
    });

    // VWAP (current timeframe) - LINE not AREA lineStyle: LineStyle.Dashed,
    vwapSeriesRef.current = indicatorChart.addLineSeries({
      color: "rgba(217, 224, 169, 0.95)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      lastValueVisible: true,
      priceLineVisible: false,
      title: "VWAP",
    });

    // VWAP Higher (higher timeframe) - LINE not AREA
    vwapHigherSeriesRef.current = indicatorChart.addLineSeries({
      color: "rgba(228, 44, 216, 0.95)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      lastValueVisible: true,
      priceLineVisible: false,
      title: "VWAP Higher",
    });

    const overboughtLine = indicatorChart.addLineSeries({
      color: "rgba(239, 83, 80, 0.5)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const oversoldLine = indicatorChart.addLineSeries({
      color: "rgba(38, 166, 154, 0.5)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const zeroLine = indicatorChart.addLineSeries({
      color: "rgba(255, 255, 255, 0.97)",
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    referenceLinesRef.current = {
      overboughtLine,
      oversoldLine,
      zeroLine,
    };

    // Bi-Directional Time Sync
    let isSyncing = false;

    const syncTimeScale = (sourceChart: IChartApi, targetChart: IChartApi) => {
      sourceChart
        .timeScale()
        .subscribeVisibleLogicalRangeChange((timeRange) => {
          if (isSyncing || !timeRange) return;
          isSyncing = true;
          try {
            targetChart.timeScale().setVisibleLogicalRange(timeRange);
          } finally {
            isSyncing = false;
          }
        });
    };

    // both directions
    syncTimeScale(priceChart, indicatorChart);
    syncTimeScale(indicatorChart, priceChart);

    // Initial sync - ensure both charts start aligned
    const initialSync = () => {
      const priceRange = priceChart.timeScale().getVisibleLogicalRange();
      if (priceRange) {
        indicatorChart.timeScale().setVisibleLogicalRange(priceRange);
      }
    };

    // Store sync function for later use
    initialSync();

    //Crosshair Line (Visual Connector)
    const updateCrosshairLine = (
      chartSource: "price" | "indicator",
      x: number | null
    ) => {
      if (!crosshairLineRef.current || !chartsWrapperRef.current) return;

      if (x === null) {
        crosshairLineRef.current.style.display = "none";
      } else {
        crosshairLineRef.current.style.display = "block";
        const wrapperRect = chartsWrapperRef.current.getBoundingClientRect();
        const sourceContainer =
          chartSource === "price"
            ? priceChartContainerRef.current
            : indicatorChartContainerRef.current;

        if (!sourceContainer) return;

        const sourceRect = sourceContainer.getBoundingClientRect();
        const relativeX = sourceRect.left - wrapperRect.left + x;
        crosshairLineRef.current.style.left = `${relativeX}px`;
      }
    };

    priceChart.subscribeCrosshairMove((param) => {
      if (!param.point) {
        updateCrosshairLine("price", null);
        return;
      }
      updateCrosshairLine("price", param.point.x);
    });

    indicatorChart.subscribeCrosshairMove((param) => {
      if (!param.point) {
        updateCrosshairLine("indicator", null);
        return;
      }
      updateCrosshairLine("indicator", param.point.x);
    });

    //Responsive Resize Handler (Without it, charts break completely on mobile, tablets, or any window resize.)
    const handleResize = () => {
      if (
        priceChartContainerRef.current &&
        indicatorChartContainerRef.current &&
        priceChartRef.current &&
        indicatorChartRef.current
      ) {
        const newWidth = priceChartContainerRef.current.clientWidth;
        const newPriceHeight = Math.floor(window.innerHeight * 0.4);
        const newIndicatorHeight = Math.floor(window.innerHeight * 0.4);

        priceChartRef.current.applyOptions({
          width: newWidth,
          height: newPriceHeight,
        });

        indicatorChartRef.current.applyOptions({
          width: newWidth,
          height: newIndicatorHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize); //Responsive Resize Handler end

    console.log("✓ Charts initialized");
    setChartsInitialized(true);

    // Cleanup. Prevents memory leaks: Removes every series, destroys charts, clears refs when component unmounts.
    return () => {
      console.log("🗑️ Cleaning up charts");
      window.removeEventListener("resize", handleResize);

      divergenceWT2SeriesRef.current.forEach((series) => {
        indicatorChart.removeSeries(series);
      });
      divergenceWT2SeriesRef.current.clear();

      divergencePriceSeriesRef.current.forEach((series) => {
        priceChart.removeSeries(series);
      });
      divergencePriceSeriesRef.current.clear();

      if (priceChartRef.current) {
        priceChartRef.current.remove();
        priceChartRef.current = null;
      }

      if (indicatorChartRef.current) {
        indicatorChartRef.current.remove();
        indicatorChartRef.current = null;
      }

      candleSeriesRef.current = null;
      wt2SeriesRef.current = null;
      whitespaceSeriesRef.current = null;
      ema50SeriesRef.current = null;
      ema100SeriesRef.current = null;
      ema200SeriesRef.current = null;
      ema1h100SeriesRef.current = null;
      ema1h200SeriesRef.current = null;
      ema4h100SeriesRef.current = null;
      ema4h200SeriesRef.current = null;
      ema12h100SeriesRef.current = null;
      ema12h200SeriesRef.current = null;
      htfIndicatorLineRef.current = null;
      htfIndicator12hLineRef.current = null;
      vwapSeriesRef.current = null;
      vwapHigherSeriesRef.current = null;

      setChartsInitialized(false);
    };
  }, []); //Cleanup finished

  
  //JSX Return
  return (
    <ProtectedPage requiredRole="superadmin">
      <div className="flex flex-col min-h-screen bg-gray-900 text-white overflow-hidden mt-9">
        {/* Top Control Bar */}
        <div className=" mt-9 bg-gray-800 border-b border-gray-700 px-3 py-1.5 flex items-center gap-2 text-[10px]">
          {/* Symbol Selector start*/}
          <select
            value={activeSymbol}
            onChange={(e) => setActiveSymbol(e.target.value)}
            disabled={loading}
            className="px-2 py-0.5 rounded text-[10px] bg-gray-700 text-white border-none font-bold"
          >
            {availableSymbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>

          {/* Timeframe Buttons */}
          {!mounted
            ? // Placeholder buttons during SSR/hydration - all neutral style
              TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  disabled
                  className="px-2 py-0.5 rounded text-[10px] font-bold transition bg-gray-700 text-gray-400"
                >
                  {tf.toUpperCase()}
                </button>
              ))
            : // Real buttons after mount - with correct active state from localStorage
              TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveTimeframe(tf)}
                  className={
                    activeTimeframe === tf
                      ? "px-2 py-0.5 rounded text-[10px] font-bold transition bg-blue-600 text-white" // ACTIVE
                      : "px-2 py-0.5 rounded text-[10px] font-bold transition bg-gray-700 text-gray-400" // INACTIVE
                  }
                >
                  {tf.toUpperCase()}
                </button>
              ))}

          {/* Pair Label */}
          <span className="text-sm font-bold ml-2">Xen_Rok</span>

          {/* Loading Indicator */}
          {loading && (
            <div className="ml-2 flex items-center gap-1">
              <div className="w-5 h-5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin"></div>
              <span className="text-yellow-400 text-xs font-bold tracking-wider animate-pulse">
                LOADING
              </span>
            </div>
          )}
          {/* Spacer */}
          <div className="flex-1"></div>

          {/* ALL EMAS Toggle */}
          <button
            onClick={toggleAllEMAs}
            className={`px-3 py-0.5 rounded text-[10px] font-bold ${
              showAllEMAs
                ? "bg-fuchsia-600 text-white"
                : "bg-gray-700 text-gray-400"
            }`}
          >
            ALL EMAS {showAllEMAs ? "ON" : "OFF"}
          </button>

          {/* Controls Toggle */}
          <button
            onClick={() => setShowControls(!showControls)}
            className="ml-2 px-2 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            {showControls ? "▼" : "▶"} Controls
          </button>

          {/* Timezone Selector */}
          <select
            value={selectedTimezone}
            onChange={(e) => setSelectedTimezone(parseInt(e.target.value))}
            className="px-1 py-0 text-[10px] bg-gray-700 text-white rounded border-none"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.offset} value={tz.offset}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {/* Expandable Controls Panel */}
        {showControls && (
          <div className="bg-gray-800 border-b border-gray-700 px-3 py-2 flex items-center gap-3 text-[10px]">
            {/* EMAs Section */}
            <span className="text-gray-400">EMAs:</span>

            {/* 1H */}
            <span className="text-gray-400">1H</span>
            <button
              onClick={() => setShow1hEMA100(!show1hEMA100)}
              className={`px-1 py-0 rounded ${
                show1hEMA100 && showAllEMAs
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              100
            </button>
            <button
              onClick={() => setShow1hEMA200(!show1hEMA200)}
              className={`px-1 py-0 rounded ${
                show1hEMA200 && showAllEMAs
                  ? "bg-green-700 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              200
            </button>

            {/* 4H */}
            <span className="text-gray-400">4H</span>
            <button
              onClick={() => setShow4hEMA100(!show4hEMA100)}
              className={`px-1 py-0 rounded ${
                show4hEMA100 && showAllEMAs
                  ? "bg-yellow-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              100
            </button>
            <button
              onClick={() => setShow4hEMA200(!show4hEMA200)}
              className={`px-1 py-0 rounded ${
                show4hEMA200 && showAllEMAs
                  ? "bg-orange-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              200
            </button>

            {/* 12H */}
            <span className="text-gray-400">12H</span>
            <button
              onClick={() => setShow12hEMA100(!show12hEMA100)}
              className={`px-1 py-0 rounded ${
                show12hEMA100 && showAllEMAs
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              100
            </button>
            <button
              onClick={() => setShow12hEMA200(!show12hEMA200)}
              className={`px-1 py-0 rounded ${
                show12hEMA200 && showAllEMAs
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              200
            </button>

            {/* Own */}
            <span className="text-gray-400">Own</span>
            {activeTimeframe === "1w" ? (
              <button
                onClick={() => setShowEMA50(!showEMA50)}
                className={`px-1 py-0 rounded ${
                  showEMA50 && showAllEMAs
                    ? "bg-pink-600 text-white"
                    : "bg-gray-700 text-gray-500"
                }`}
              >
                50
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowEMA100(!showEMA100)}
                  className={`px-1 py-0 rounded ${
                    showEMA100 && showAllEMAs
                      ? "bg-pink-600 text-white"
                      : "bg-gray-700 text-gray-500"
                  }`}
                >
                  100
                </button>
                <button
                  onClick={() => setShowEMA200(!showEMA200)}
                  className={`px-1 py-0 rounded ${
                    showEMA200 && showAllEMAs
                      ? "bg-pink-700 text-white"
                      : "bg-gray-700 text-gray-500"
                  }`}
                >
                  200
                </button>
              </>
            )}

            {/* Divergences */}
            <span className="text-gray-400 ml-3">
              Div ({filteredDivergenceStats.filtered}/
              {filteredDivergenceStats.total}):
            </span>
            <button
              onClick={() => setShowRegularBullish(!showRegularBullish)}
              className={`px-1 py-0 rounded ${
                showRegularBullish
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              Reg+
            </button>
            <button
              onClick={() => setShowRegularBearish(!showRegularBearish)}
              className={`px-1 py-0 rounded ${
                showRegularBearish
                  ? "bg-red-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              Reg-
            </button>
            <button
              onClick={() => setShowHiddenBullish(!showHiddenBullish)}
              className={`px-1 py-0 rounded ${
                showHiddenBullish
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              Hid+
            </button>
            <button
              onClick={() => setShowHiddenBearish(!showHiddenBearish)}
              className={`px-1 py-0 rounded ${
                showHiddenBearish
                  ? "bg-orange-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              Hid-
            </button>

            {/* Min DMI Input Field */}
            <span className="text-gray-400 ml-3">Min DMI:</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={minDMI}
              onChange={(e) => setMinDMI(parseFloat(e.target.value) || 0)}
              className="w-12 bg-gray-700 text-white text-[10px] rounded px-1 py-0 border-none"
            />

            {/* Cross-TF */}
            <span className="text-gray-400 ml-3">Cross-TF:</span>
            <button
              onClick={() => setShow4hSignals(!show4hSignals)}
              className={`px-2 py-0 rounded ${
                show4hSignals
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              4H
            </button>
            <button
              onClick={() => setShow12hSignals(!show12hSignals)}
              className={`px-2 py-0 rounded ${
                show12hSignals
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              12H
            </button>

            {/* Div on Price Checkbox */}
            <label className="flex items-center gap-1 cursor-pointer ml-3">
              <input
                type="checkbox"
                checked={showDivergenceOnPrice}
                onChange={(e) => setShowDivergenceOnPrice(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-gray-300">Div on Price</span>
            </label>
          </div>
        )}

        {/* Chart Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-gray-900 px-2 py-1 text-xs text-gray-400 shrink-0">
            {activeTimeframe.toUpperCase()} - UTC
            {selectedTimezone >= 0 ? "+" : ""}
            {selectedTimezone}
          </div>

          {/*<div ref={chartsWrapperRef} className="flex-1 relative">*/}
          <div
            ref={chartsWrapperRef}
            className="flex-1 overflow-hidden relative"
          >
            <div
              ref={crosshairLineRef}
              className="absolute top-0 bottom-0 w-px bg-gray-500 pointer-events-none z-10"
              style={{ display: "none" }}
            />
            <div ref={priceChartContainerRef} />
            <div ref={indicatorChartContainerRef} />
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
