import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const privateHeaders = {
  "Cache-Control": "private, no-store",
};

async function requirePlatformOwner() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false as const, error: "unauthorized" };
  }

  const admin = createAdminClient();

  const { data: platformUser, error } = await admin
    .from("platform_users")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Platform membership check failed:", error);
    return { authorized: false as const, error: "internal" };
  }

  if (!platformUser || !platformUser.is_active) {
    return { authorized: false as const, error: "unauthorized" };
  }

  return { authorized: true as const };
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: privateHeaders }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requirePlatformOwner();

    if (!access.authorized) {
      return jsonError(
        access.error === "internal"
          ? "Unable to verify platform access."
          : "Unauthorized.",
        access.error === "internal" ? 500 : 401
      );
    }

    const { id } = await context.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return jsonError("Invalid owner ID.", 400);
    }

    const ownerId = Number(id);

    if (!Number.isSafeInteger(ownerId)) {
      return jsonError("Invalid owner ID.", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      !("new_password" in body) ||
      typeof body.new_password !== "string"
    ) {
      return jsonError("A valid new password is required.", 400);
    }

    const newPassword = body.new_password;

    if (newPassword.length < 8 || newPassword.length > 128) {
      return jsonError(
        "Password must be between 8 and 128 characters.",
        400
      );
    }

    const admin = createAdminClient();

    const { data: owner, error: ownerError } = await admin
      .from("users")
      .select("id, auth_user_id, role_id")
      .eq("id", ownerId)
      .eq("role_id", 3)
      .maybeSingle();

    if (ownerError) {
      console.error("Failed to find owner:", ownerError);
      return jsonError("Failed to find restaurant owner.", 500);
    }

    if (!owner) {
      return jsonError("Restaurant owner not found.", 404);
    }

    if (!owner.auth_user_id) {
      return jsonError(
        "This owner does not have a linked Supabase Auth account.",
        400
      );
    }

    const { error: updateError } =
      await admin.auth.admin.updateUserById(owner.auth_user_id, {
        password: newPassword,
      });

    if (updateError) {
      console.error("Failed to reset owner password:", updateError);

      return jsonError(
        "Failed to reset owner password. Check the password requirements and try again.",
        400
      );
    }

    return NextResponse.json(
      { message: "Password reset successfully." },
      { status: 200, headers: privateHeaders }
    );
  } catch (error) {
    console.error("Reset owner password error:", error);

    return jsonError("Failed to reset owner password.", 500);
  }
}
