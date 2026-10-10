import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };

function responseError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return responseError("Unauthorized.", 401);
    }

    const admin = createAdminClient();
    const { data: member, error: memberError } = await admin
      .from("platform_users")
      .select("id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (memberError) {
      console.error("Platform password authorization failed:", memberError);
      return responseError("Unable to verify platform access.", 500);
    }

    if (!member || !member.is_active) {
      return responseError("Forbidden.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return responseError("Invalid JSON body.", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return responseError("Invalid request body.", 400);
    }

    const { currentPassword, newPassword } =
      body as Record<string, unknown>;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      newPassword.length < 8 ||
      newPassword.length > 128
    ) {
      return responseError(
        "Enter your current password and a new password of 8–128 characters.",
        400
      );
    }

    if (currentPassword === newPassword) {
      return responseError(
        "Your new password must be different.",
        400
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      console.error("Supabase URL or anon key is missing.");
      return responseError("Password service is unavailable.", 500);
    }

    const verifier = createSupabaseClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: verified, error: verifyError } =
      await verifier.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

    if (verifyError || verified.user?.id !== user.id) {
      return responseError("Current password is incorrect.", 400);
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("Platform password update failed:", updateError);
      return responseError("Failed to update password.", 400);
    }

    return NextResponse.json(
      { message: "Password changed successfully." },
      { headers }
    );
  } catch (error) {
    console.error("Platform password PATCH failed:", error);
    return responseError("Something went wrong.", 500);
  }
}