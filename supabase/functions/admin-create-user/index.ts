// Creates a login for a new employee. Admin only.
// Replaces browser-side auth.signUp so public sign-up can stay disabled.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_DOMAIN = "@stratonally.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Not signed in" }, 401);

  // Identify the caller with their own token, then check the admin role.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json({ error: "Not signed in" }, 401);

  const { data: isAdmin, error: roleError } = await callerClient.rpc("has_role", {
    _user_id: callerData.user.id,
    _role: "admin",
  });
  if (roleError || isAdmin !== true) return json({ error: "Only admins can create users" }, 403);

  let payload: { email?: string; password?: string; fullName?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  const password = payload.password ?? "";
  const fullName = (payload.fullName ?? "").trim();

  if (!email.endsWith(ALLOWED_DOMAIN)) return json({ error: `Email must end with ${ALLOWED_DOMAIN}` }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
  if (!fullName) return json({ error: "Full name is required" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, created_by_admin: true, created_by: callerData.user.id },
  });
  if (createError || !created.user) {
    return json({ error: createError?.message ?? "Failed to create user" }, 400);
  }

  return json({ user: { id: created.user.id, email: created.user.email } });
});
