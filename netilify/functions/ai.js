// netlify/functions/ai.js
// Claude API proxy — API key stays server-side, never exposed
// POST /api/ai  body: { mode: "scanner"|"analyst", payload: {...} }

export const config = { runtime: "nodejs18.x" };

const ANTHROPIC = "https://api.anthropic.com/v1/messages";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function buildScannerPrompt(symbols, prices, capital, riskPct) {
  const lines = symbols.map(sym => {
    const p = prices[sym];
    if (!p?.live) return `${sym}: price unavailable`;
    return `${sym}: ₹${p.ltp} (${p.chgPct >= 0 ? "+" : ""}${p.chgPct}%, Hi:₹${p.dayHi} Lo:₹${p.dayLo}, Vol:${(p.volume/1e5).toFixed(1)}L Avg:${(p.avgVolume/1e5).toFixed(1)}L VolRatio:${p.volRatio}x)`;
  }).join("\n");

  return `You are a senior NSE intraday trader. Indian market, Groww broker, MIS only.

LIVE NSE DATA:
${lines}

Capital: ₹${capital} | Risk per trade: ${riskPct}% (₹${((capital * riskPct) / 100).toFixed(0)})

Score each stock 0-100 for TODAY's intraday. Consider: price position in day range, volume ratio (>1.3 bullish, <0.7 avoid), momentum, volatility, sector.

Return ONLY a valid JSON array, no markdown:
[{"sym":"RELIANCE","score":82,"entry":2845.00,"target":2878.00,"sl":2822.00,"rr":"1:1.5","trend":"BULLISH","rsi_estimate":64,"reason":"2-sentence specific analysis","news_sentiment":"POSITIVE","vol_signal":"HIGH","avoid_reason":""}]

Give genuinely differentiated scores. Low volume = score below 45. Strong setup = score above 75.`;
}

function buildAnalystPrompt(symbol, price, capital, question) {
  const priceCtx = price?.live
    ? `Live: ₹${price.ltp} | Change: ${price.chgPct >= 0 ? "+" : ""}${price.chgPct}% (₹${price.chgAbs}) | Hi: ₹${price.dayHi} | Lo: ₹${price.dayLo} | Vol: ${(price.volume/1e5).toFixed(1)}L | VolRatio: ${price.volRatio}x`
    : "Live price unavailable.";

  return `You are a senior NSE intraday analyst. Groww broker, MIS only. IST timezone.

STOCK: ${symbol} (NSE)
${priceCtx}
CAPITAL: ₹${capital}
QUESTION: ${question || "Full intraday analysis for today."}

Structure your response exactly as:

**TECHNICAL SETUP**
Trend: [BULLISH/BEARISH/SIDEWAYS] | Support: ₹X | Resistance: ₹X | RSI≈X | Volume: [HIGH/MOD/LOW]

**TRADE PLAN**
Entry: ₹X–₹X | Target 1: ₹X (+X%) | Target 2: ₹X (+X%) | Stop Loss: ₹X (-X%)
Quantity: X shares (₹${capital} × 15%) | Investment: ₹X

**GROWW CHARGES (NSE MIS)**
Brokerage: ₹X | STT: ₹X | Exchange+SEBI+Stamp: ₹X | GST: ₹X | Total: ₹X
Net at T1: ₹X | Net at T2: ₹X

**RISK & TIMING**
R:R = 1:X | Max loss if SL hits: ₹X | Confidence: X/100
Entry window: HH:MM–HH:MM IST | Exit by: 3:10 PM IST

**VERDICT**
[BUY / WAIT / SKIP] — one sentence reason`;
}

export default async function handler(req) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), { status: 500, headers });

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers }); }

  const { mode, payload } = body;
  let prompt = "";
  if (mode === "scanner") prompt = buildScannerPrompt(payload.symbols, payload.prices, payload.capital, payload.riskPct);
  else if (mode === "analyst") prompt = buildAnalystPrompt(payload.symbol, payload.price, payload.capital, payload.question);
  else return new Response(JSON.stringify({ error: "mode must be scanner or analyst" }), { status: 400, headers });

  try {
    const aiRes = await fetch(ANTHROPIC, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(30000),
    });
    if (!aiRes.ok) {
      const err = await aiRes.text();
      return new Response(JSON.stringify({ error: `Claude API ${aiRes.status}`, detail: err }), { status: 502, headers });
    }
    const aiData = await aiRes.json();
    const text = aiData.content?.find(c => c.type === "text")?.text || "";
    return new Response(JSON.stringify({ text, mode }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502, headers });
  }
}
