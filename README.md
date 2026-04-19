# IntraRadar — Deployment Guide

## Stack
- **Hosting**: Netlify (free tier — 100GB bandwidth/month)
- **Serverless Functions**: Netlify Functions (Node.js 18)
- **Database**: Supabase (free tier — 500MB, unlimited API calls)
- **AI**: Claude API via Anthropic
- **Market Data**: Yahoo Finance (fetched server-side, no CORS issues)

---

## STEP 1 — Supabase Setup (5 min)

1. Go to https://supabase.com → **Start your project**
2. Create a new project (choose any region — `ap-south-1` Mumbai is closest for India)
3. Wait ~2 min for provisioning
4. Go to **SQL Editor** → paste the entire contents of `supabase/schema.sql` → click **Run**
5. Go to **Project Settings → API**:
   - Copy **Project URL** → this is `SUPABASE_URL`
   - Copy **anon/public** key → this is `SUPABASE_ANON_KEY`
   - Copy **service_role** key → this is `SUPABASE_SERVICE_KEY` (keep this secret!)

---

## STEP 2 — GitHub Repository (3 min)

```bash
cd intraradar
git init
git add .
git commit -m "Initial IntraRadar deployment"
```

Go to https://github.com/new → create a repo called `intraradar`

```bash
git remote add origin https://github.com/YOUR_USERNAME/intraradar.git
git branch -M main
git push -u origin main
```

---

## STEP 3 — Netlify Deployment (5 min)

1. Go to https://netlify.com → **Sign up / Log in**
2. Click **Add new site → Import an existing project**
3. Choose **GitHub** → select your `intraradar` repo
4. Build settings (auto-detected from `netlify.toml`):
   - **Build command**: *(leave blank)*
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
5. Click **Deploy site**

---

## STEP 4 — Set Environment Variables in Netlify (3 min)

In your Netlify site → **Site configuration → Environment variables → Add a variable**

Add all four:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (from console.anthropic.com) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJ...` (service_role key) |
| `SUPABASE_ANON_KEY` | `eyJ...` (anon key) |

After adding env vars → **Deploys → Trigger deploy → Deploy site**

---

## STEP 5 — Verify

Your app will be live at: `https://YOUR-SITE-NAME.netlify.app`

Test each function:
```
https://YOUR-SITE.netlify.app/api/prices?symbols=RELIANCE,TCS
https://YOUR-SITE.netlify.app/api/trades
```

Prices endpoint should return JSON with live NSE data.
Trades endpoint should return `{"trades":[]}` (empty initially).

---

## Local Development

```bash
npm install
cp .env.example .env
# Fill in your actual keys in .env

npx netlify dev
# App runs at http://localhost:8888
# Functions available at http://localhost:8888/api/*
```

---

## Free Tier Limits (you won't hit these for personal use)

| Service | Free Limit |
|---------|------------|
| Netlify Bandwidth | 100 GB/month |
| Netlify Functions | 125,000 invocations/month |
| Netlify Build Minutes | 300 min/month |
| Supabase DB | 500 MB |
| Supabase API Calls | Unlimited |
| Anthropic API | Pay-per-use (~₹0.10 per scan) |

---

## Architecture

```
Browser
  │
  ├── GET /api/prices?symbols=...
  │     └── netlify/functions/prices.js
  │             └── Yahoo Finance (server-side, no CORS)
  │
  ├── POST /api/ai  { mode, payload }
  │     └── netlify/functions/ai.js
  │             └── Anthropic Claude API (API key hidden)
  │
  ├── GET|POST|PUT|DELETE /api/trades
  │     └── netlify/functions/trades.js
  │             └── Supabase PostgreSQL (service key hidden)
  │
  └── Static files (HTML/CSS/JS) from /public/
```

---

## Updating the App

```bash
git add .
git commit -m "Your update message"
git push
# Netlify auto-deploys within ~30 seconds
```

---

## Troubleshooting

**Prices show as estimated (not live)**
→ Check Netlify function logs: Site → Functions → `prices` → View logs
→ Yahoo Finance may throttle — prices update on each scan

**Trades not saving to cloud**
→ Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set correctly in Netlify env vars
→ Trades save locally as fallback even if cloud fails

**AI analysis not working**
→ Verify `ANTHROPIC_API_KEY` in Netlify env vars
→ Check function logs: Site → Functions → `ai` → View logs

**CORS errors in browser console**
→ Make sure you're accessing the app via the Netlify URL, not opening index.html directly
→ All API calls must go through `/api/*` routes, not called directly from browser
