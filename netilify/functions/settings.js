// netlify/functions/settings.js
// User settings CRUD — GET /api/settings  POST /api/settings
// Also handles scan_history: POST /api/settings?type=scan  GET /api/settings?type=scan

export const config = { runtime: "nodejs18.x" };

function corsH() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}
const ok  = (d, s=200) => new Response(JSON.stringify(d), { status: s, headers: corsH() });
const err = (m, s=400) => new Response(JSON.stringify({ error: m }), { status: s, headers: corsH() });

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsH() });

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return err("Unauthorized", 401);

  const sbUrl  = process.env.SUPABASE_URL;
  const anonK  = process.env.SUPABASE_ANON_KEY;
  if (!sbUrl || !anonK) return err("Supabase not configured", 500);

  const sbH = {
    "Content-Type": "application/json",
    "apikey": anonK,
    "Authorization": authHeader,
    "Prefer": "return=representation",
  };

  const url  = new URL(req.url);
  const type = url.searchParams.get("type"); // "scan" for scan_history

  try {
    // ── SCAN HISTORY ─────────────────────────────────────────────
    if (type === "scan") {
      if (req.method === "GET") {
        const res  = await fetch(`${sbUrl}/rest/v1/scan_history?order=scanned_at.desc&limit=20`, { headers: sbH });
        const data = await res.json();
        if (!res.ok) return err(JSON.stringify(data), res.status);
        return ok({ history: data });
      }
      if (req.method === "POST") {
        const body = await req.json();
        const res  = await fetch(`${sbUrl}/rest/v1/scan_history`, {
          method: "POST", headers: sbH,
          body: JSON.stringify({ user_id: body.user_id, watchlist: body.watchlist, capital: body.capital, results: body.results }),
        });
        const data = await res.json();
        if (!res.ok) return err(JSON.stringify(data), res.status);
        return ok({ saved: true }, 201);
      }
    }

    // ── USER SETTINGS ─────────────────────────────────────────────
    if (req.method === "GET") {
      const res  = await fetch(`${sbUrl}/rest/v1/user_settings?limit=1`, { headers: sbH });
      const data = await res.json();
      if (!res.ok) return err(JSON.stringify(data), res.status);
      return ok({ settings: data[0] || null });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const row  = {
        user_id:  body.user_id,
        capital:  body.capital  || 50000,
        risk_pct: body.risk_pct || 1.5,
        watchlist:body.watchlist|| "default",
        theme:    body.theme    || "dark",
        extras:   body.extras   || {},
        updated_at: new Date().toISOString(),
      };
      // Upsert (insert or update on conflict)
      const res  = await fetch(`${sbUrl}/rest/v1/user_settings`, {
        method: "POST",
        headers: { ...sbH, Prefer: "return=representation,resolution=merge-duplicates" },
        body: JSON.stringify(row),
      });
      const data = await res.json();
      if (!res.ok) return err(JSON.stringify(data), res.status);
      return ok({ settings: Array.isArray(data) ? data[0] : data });
    }

    return err("Method not allowed", 405);
  } catch (e) {
    return err(`Server error: ${e.message}`, 500);
  }
}
