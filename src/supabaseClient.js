// Supabase client + auth/DB config. Replaces the old firebase.js.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Isolated client used only to sign up a NEW user (e.g. admin creating a
// supervisor account) without disturbing the currently logged-in session on
// `supabase` above. Supabase's signUp() always swaps the session on the
// client it's called on, so a second client with its own storage key keeps
// the admin's session untouched.
export function createIsolatedAuthClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { storageKey: "sb-temp-auth", persistSession: false, autoRefreshToken: false },
  });
}

// Firestore docs were camelCase; Postgres columns are snake_case.
// These keep every existing camelCase reference in the dashboards working
// unchanged — apply toCamel to rows coming out of Supabase, toSnake to
// objects going in. Both are shallow on purpose: jsonb columns like
// labourAttendance/unavailability use dynamic keys (ids, "date_slot"
// strings) that must NOT be re-cased.
export function toCamel(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}

export function toSnake(obj) {
  if (!obj) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())] = v;
  }
  return out;
}
