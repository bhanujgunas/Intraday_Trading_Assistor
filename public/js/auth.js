// auth.js — FINAL CLEAN VERSION

let supabase = null;
let _session = null;
let _user = null;

// 🔹 Get Supabase client (lazy + async)
async function getSB() {
  if (supabase) return supabase;

  const res = await fetch('/.netlify/functions/config');
  if (!res.ok) throw new Error("Failed to load config");

  const { supabaseUrl, supabaseAnonKey } = await res.json();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase config");
  }

  supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return supabase;
}

// 🔹 Auth state helpers
function getSession() { return _session; }
function getUser() { return _user; }
function getToken() { return _session ? _session.access_token : null; }
function getUserId() { return _user ? _user.id : null; }
function isLoggedIn() { return !!_session; }

// 🔹 Login
async function signInWithGoogle() {
  const sb = await getSB();

  return sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
}

// 🔹 Logout
async function signOut() {
  const sb = await getSB();
  await sb.auth.signOut();

  _session = null;
  _user = null;
}

// 🔹 Init auth (IMPORTANT)
async function initAuth(onAuth, onSignOut) {
  const sb = await getSB();

  // Get existing session
  const { data } = await sb.auth.getSession();

  if (data.session) {
    _session = data.session;
    _user = data.session.user;
    onAuth(_user, _session);
  } else {
    onSignOut();
  }

  // Listen for changes
  sb.auth.onAuthStateChange((event, session) => {
    _session = session;
    _user = session ? session.user : null;

    if (session) onAuth(_user, session);
    else onSignOut();
  });
}

// 🔹 Authenticated fetch
async function authFetch(url, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) headers["Authorization"] = "Bearer " + token;

  return fetch(url, { ...options, headers });
}

// 🔹 Global export
window.Auth = {
  getSession,
  getUser,
  getToken,
  getUserId,
  isLoggedIn,
  signInWithGoogle,
  signOut,
  initAuth,
  authFetch,
};