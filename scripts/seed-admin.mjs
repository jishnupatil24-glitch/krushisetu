// One-time script to create the first admin account (there is no UI for this —
// the app can only ever create supervisor accounts, and only an existing admin
// can do that). Run once, after `schema.sql`, then delete or ignore this file.
//
// Usage (do NOT put SUPABASE_SERVICE_ROLE_KEY in any .env file that ships to
// the browser — CRA bundles every REACT_APP_* var into the client, and this
// key must never reach it):
//
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx ADMIN_EMAIL=admin@krishisetu.com ADMIN_PASSWORD=yourpassword ADMIN_NAME="Admin" node scripts/seed-admin.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || "Admin";

if (!url || !serviceKey || !email || !password) {
  console.error("Missing required env vars. See usage comment at top of this file.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  console.error("Failed to create admin auth user:", error.message);
  process.exit(1);
}

const { error: profileError } = await supabase.from("profiles").insert({
  id: data.user.id,
  name,
  email,
  role: "admin",
});

if (profileError) {
  console.error("Auth user created, but profile insert failed:", profileError.message);
  process.exit(1);
}

console.log(`Admin account ready: ${email}`);
