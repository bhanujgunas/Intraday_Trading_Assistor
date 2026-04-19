// netlify/functions/prices.js
// Server-side Yahoo Finance proxy — no CORS, retries, 60s cache
// GET /api/prices?symbols=RELIANCE,TCS,HDFCBANK

export const config = { runtime: "nodejs18.x" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchYahoo(symbol, retries = 2) {
  const ticker = `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d&includePrePost=false`;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) { if (i < retries) { await sleep(400 * (i + 1)); continue; } return null; }
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) return null;
      const meta = result.meta;
      const quotes = result.indicators?.quote?.[0] || {};
      const closes = quotes.close || [];
      const ltp = meta.regularMarketPrice || closes.at(-1) || 0;
      const prev = meta.chartPreviousClose || meta.regularMarketPreviousClose || closes.at(-2) || ltp;
      const chgPct = prev ? ((ltp - prev) / prev) * 100 : 0;
      return {
        symbol, ltp: +ltp.toFixed(2), prev: +prev.toFixed(2),
        chgPct: +chgPct.toFixed(2), chgAbs: +(ltp - prev).toFixed(2),
        dayHi: +(meta.regularMarketDayHigh || ltp * 1.01).toFixed(2),
        dayLo: +(meta.regularMarketDayLow  || ltp * 0.99).toFixed(2),
        volume: meta.regularMarketVolume || 0,
        avgVolume: meta.averageDailyVolume10Day || meta.averageDailyVolume3Month || 1,
        volRatio: +((meta.regularMarketVolume || 1) / (meta.averageDailyVolume10Day || 1)).toFixed(2),
        history: closes.filter(Boolean).slice(-5).map(v => +v.toFixed(2)),
        live: true, fetchedAt: new Date().toISOString(),
      };
    } catch (e) { if (i < retries) { await sleep(400 * (i + 1)); continue; } return null; }
  }
  return null;
}

export default async function handler(req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const url = new URL(req.url);
  const symbols = (url.searchParams.get("symbols") || "RELIANCE")
    .split(",").map(s => s.trim().toUpperCase()).slice(0, 20);
  const results = await Promise.all(symbols.map(fetchYahoo));
  const prices = {};
  let liveCount = 0;
  symbols.forEach((sym, i) => {
    if (results[i]) { prices[sym] = results[i]; liveCount++; }
    else prices[sym] = { symbol: sym, live: false, error: "fetch_failed" };
  });
  return new Response(
    JSON.stringify({ prices, liveCount, total: symbols.length, timestamp: new Date().toISOString() }),
    { status: 200, headers }
  );
}
