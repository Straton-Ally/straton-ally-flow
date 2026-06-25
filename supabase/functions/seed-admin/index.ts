import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminEmail = Deno.env.get("SEED_ADMIN_EMAIL");
    const adminPassword = Deno.env.get("SEED_ADMIN_PASSWORD");
    const adminFullName = Deno.env.get("SEED_ADMIN_FULL_NAME") ?? "System Admin";
    const adminEmployeeId = Deno.env.get("SEED_ADMIN_EMPLOYEE_ID") ?? "ADMIN001";

    if (!adminEmail || !adminPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before running seed-admin",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if admin user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const adminExists = existingUsers?.users?.some(
      (u) => u.email === adminEmail
    );

    if (adminExists) {
      return new Response(
        JSON.stringify({ success: false, message: "Admin user already exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminFullName,
      },
    });

    if (createError) {
      throw createError;
    }

    // The profile is created automatically by the trigger
    // Now add admin role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: "admin",
      });

    if (roleError) {
      throw roleError;
    }

    // Create employee record for admin
    const { error: empError } = await supabase
      .from("employees")
      .insert({
        user_id: newUser.user.id,
        employee_id: adminEmployeeId,
        designation: "System Administrator",
        joining_date: new Date().toISOString().split("T")[0],
      });

    if (empError) {
      console.error("Employee creation error:", empError);
      // Non-critical, continue
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin user created successfully",
        email: adminEmail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
