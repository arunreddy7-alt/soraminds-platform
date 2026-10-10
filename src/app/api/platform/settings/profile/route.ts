import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Unauthorized.", 401);
    }

    const admin = createAdminClient();
    const { data: member, error } = await admin
      .from("platform_users")
      .select("id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Platform profile authorization failed:", error);
      return jsonError("Unable to verify platform access.", 500);
    }

    if (!member || !member.is_active) {
      return jsonError("Forbidden.", 403);
    }

    return NextResponse.json(
      {
        name:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          "",
        email: user.email ?? "",
      },
      { headers }
    );
  } catch (error) {
    console.error("Platform profile GET failed:", error);
    return jsonError("Something went wrong.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Unauthorized.", 401);
    }

    const admin = createAdminClient();
    const { data: member, error } = await admin
      .from("platform_users")
      .select("id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Platform profile authorization failed:", error);
      return jsonError("Unable to verify platform access.", 500);
    }

    if (!member || !member.is_active) {
      return jsonError("Forbidden.", 403);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      typeof (body as Record<string, unknown>).name !== "string"
    ) {
      return jsonError("A valid name is required.", 400);
    }

    const name = ((body as { name: string }).name).trim();

    if (!name || name.length > 100) {
      return jsonError("Name must contain 1–100 characters.", 400);
    }

    const { data, error: updateError } = await supabase.auth.updateUser({
      data: { full_name: name },
    });

    if (updateError || !data.user) {
      console.error("Platform profile update failed:", updateError);
      return jsonError("Failed to update profile.", 400);
    }

    return NextResponse.json(
      {
        name:
          data.user.user_metadata?.full_name ??
          data.user.user_metadata?.name ??
          name,
        email: data.user.email ?? "",
      },
      { headers }
    );
  } catch (error) {
    console.error("Platform profile PATCH failed:", error);
    return jsonError("Something went wrong.", 500);
  }
}