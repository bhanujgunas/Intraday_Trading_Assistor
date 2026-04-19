// auth.js — Supabase Google OAuth (no ES modules — global Auth object)

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.indexOf(".") !== -1;
  } catch (e) {
    return false;
  }
}
function isValidKey(key) {
  return typeof key === "string" && key.length > 20 && !key.includes("REPLACE_WITH_YOUR_SUPABASE");
}
function configError() {
  const msg = "Invalid Supabase configuration: set window.ENV_SUPABASE_URL and window.ENV_SUPABASE_ANON_KEY to your Supabase project values.";
  console.error(msg, { SUPABASE_URL, SUPABASE_ANON_KEY });
  alert("Supabase configuration is missing or invalid. Please set your Supabase URL and anon key before using the app.");
  throw new Error(msg);
}

var _sb = null;
function getSB() {
  if (!_sb) {
    if (!isValidUrl(SUPABASE_URL) || !isValidKey(SUPABASE_ANON_KEY)) {
      configError();
    }
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
  }
  return _sb;
}

var _session = null;
var _user    = null;

function getSession()  { return _session; }
function getUser()     { return _user; }
function getToken()    { return _session ? _session.access_token : null; }
function getUserId()   { return _user ? _user.id : null; }
function isLoggedIn()  { return !!_session; }

function signInWithGoogle() {
  return getSB().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
}

function signOut() {
  return getSB().auth.signOut().then(function() {
    _session = null;
    _user    = null;
  });
}

function initAuth(onAuth, onSignOut) {
  var sb = getSB();
  sb.auth.getSession().then(function(result) {
    var session = result.data.session;
    if (session) {
      _session = session;
      _user    = session.user;
      onAuth(_user, _session);
    } else {
      onSignOut();
    }
  });
  sb.auth.onAuthStateChange(function(event, session) {
    _session = session;
    _user    = session ? session.user : null;
    if (session) onAuth(_user, session);
    else onSignOut();
  });
}

function authFetch(url, options) {
  options = options || {};
  var token = getToken();
  var headers = Object.assign({}, { "Content-Type": "application/json" }, options.headers || {});
  if (token) headers["Authorization"] = "Bearer " + token;
  return fetch(url, Object.assign({}, options, { headers: headers }));
}

window.Auth = {
  getSession:       getSession,
  getUser:          getUser,
  getToken:         getToken,
  getUserId:        getUserId,
  isLoggedIn:       isLoggedIn,
  signInWithGoogle: signInWithGoogle,
  signOut:          signOut,
  initAuth:         initAuth,
  authFetch:        authFetch,
};