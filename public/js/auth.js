// auth.js — Supabase Google OAuth session management
// Uses Supabase JS v2 CDN build

// ── CONFIG ─────────────────────────────────────────────────────
// IMPORTANT: Replace these two values with your actual Supabase project values
// These are the anon/public keys — safe to expose in frontend code
// Get them from: Supabase Dashboard → Project Settings → API
const SUPABASE_URL      = window.ENV_SUPABASE_URL      || "REPLACE_WITH_YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || "REPLACE_WITH_YOUR_SUPABASE_ANON_KEY";

// Supabase client (loaded from CDN in index.html)
let _sb = null;
function getSB() {
  if (!_sb) _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
  return _sb;
}

// ── SESSION STATE ───────────────────────────────────────────────
let _session = null;
let _user    = null;

export function getSession() { return _session; }
export function getUser()    { return _user; }
export function getToken()   { return _session?.access_token || null; }
export function getUserId()  { return _user?.id || null; }
export function isLoggedIn() { return !!_session; }

// ── AUTH ACTIONS ────────────────────────────────────────────────
export async function signInWithGoogle() {
  const { error } = await getSB().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await getSB().auth.signOut();
  _session = null;
  _user    = null;
}

// ── INIT: resolve session on page load ──────────────────────────
export async function initAuth(onAuth, onSignOut) {
  const sb = getSB();

  // Resolve any OAuth redirect or existing session
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    _session = session;
    _user    = session.user;
    onAuth(_user, _session);
  } else {
    onSignOut();
  }

  // Listen for auth state changes (login, token refresh, logout)
  sb.auth.onAuthStateChange((_event, session) => {
    _session = session;
    _user    = session?.user || null;
    if (session) onAuth(_user, session);
    else onSignOut();
  });
}

// ── HELPERS ─────────────────────────────────────────────────────
export function authFetch(url, options = {}) {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
