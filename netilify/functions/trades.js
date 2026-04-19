// netlify/functions/trades.js
// Trades CRUD — uses the user's Supabase JWT (from Google OAuth session)
// The JWT is passed in Authorization header from the frontend
// Supabase RLS enforces per-user data isolation automatically
// GET|POST /api/trades   PUT|DELETE /api/trades?id=X

export const config = { runtime: "nodejs18.x" };

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}
const ok  = (d, s=200) => new Response(JSON.stringify(d), { status: s, headers: corsHeaders() });
const err = (msg, s=400) => new Response(JSON.stringify({ error: msg }), { status: s, headers: corsHeaders() });

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

  // Forward the user's JWT — Supabase RLS handles auth automatically
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return err("Missing Authorization header", 401);

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey    = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return err("Supabase not configured", 500);

  // Use anon key + user JWT — RLS will filter to this user's rows only
  const sbHeaders = {
    "Content-Type": "application/json",
    "apikey": anonKey,
    "Authorization": authHeader,   // user's JWT — RLS enforces their scope
    "Prefer": "return=representation",
  };

  const base = `${supabaseUrl}/rest/v1/trades`;
  const url  = new URL(req.url);
  const id   = url.searchParams.get("id");

  try {
    if (req.method === "GET") {
      const res  = await fetch(`${base}?order=date.desc,created_at.desc&limit=1000`, { headers: sbHeaders });
      const data = await res.json();
      if (!res.ok) return err(JSON.stringify(data), res.status);
      return ok({ trades: data });
    }

    if (req.method === "POST") {
      const body  = await req.json();
      // user_id is set by RLS via auth.uid() — we don't need to send it
      // but Supabase needs it in the row — use a server-side insert via service key if needed
      // For anon+JWT approach: include user_id from body (client sends it from session)
      const trade = {
        user_id:    body.user_id,
        date:       body.date,
        symbol:     body.symbol,
        type:       body.type || "Intraday MIS",
        qty:        body.qty,
        buy_price:  body.buy_price,
        sell_price: body.sell_price ?? null,
        notes:      body.notes || "",
        gross_pnl:  body.gross_pnl ?? null,
        charges:    body.charges || 0,
        net_pnl:    body.net_pnl ?? null,
        status:     body.status || "OPEN",
      };
      const res  = await fetch(base, { method: "POST", headers: sbHeaders, body: JSON.stringify(trade) });
      const data = await res.json();
      if (!res.ok) return err(JSON.stringify(data), res.status);
      return ok({ trade: Array.isArray(data) ? data[0] : data }, 201);
    }

    if (req.method === "PUT") {
      if (!id) return err("id required");
      const body = await req.json();
      const res  = await fetch(`${base}?id=eq.${id}`, { method: "PATCH", headers: sbHeaders, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) return err(JSON.stringify(data), res.status);
      return ok({ trade: Array.isArray(data) ? data[0] : data });
    }

    if (req.method === "DELETE") {
      if (!id) return err("id required");
      const res = await fetch(`${base}?id=eq.${id}`, {
        method: "DELETE", headers: { ...sbHeaders, Prefer: "return=minimal" },
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); return err(JSON.stringify(d), res.status); }
      return ok({ deleted: true, id });
    }

    return err("Method not allowed", 405);
  } catch (e) {
    return err(`Server error: ${e.message}`, 500);
  }
}
