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

function parseOwnerId(id: string) {
  if (!/^[1-9]\d*$/.test(id)) return null;

  const value = Number(id);
  return Number.isSafeInteger(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  let newlyCreatedAuthUserId: string | null = null;
  let admin: ReturnType<typeof createAdminClient> | null = null;

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
    const ownerId = parseOwnerId(id);

    if (ownerId === null) {
      return jsonError("Invalid owner ID.", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    if (!isRecord(body)) {
      return jsonError("Invalid request body.", 400);
    }

    if (
      typeof body.new_owner_full_name !== "string" ||
      typeof body.new_owner_email !== "string" ||
      typeof body.new_owner_password !== "string"
    ) {
      return jsonError("Invalid owner details.", 400);
    }

    const newOwnerName = body.new_owner_full_name.trim();
    const newOwnerEmail = body.new_owner_email.trim().toLowerCase();
    const newOwnerPassword = body.new_owner_password;

    if (newOwnerName.length < 2 || newOwnerName.length > 150) {
      return jsonError("Owner name must be between 2 and 150 characters.", 400);
    }

    if (
      newOwnerEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newOwnerEmail)
    ) {
      return jsonError("Enter a valid owner email address.", 400);
    }

    if (
      newOwnerPassword.length < 8 ||
      newOwnerPassword.length > 128
    ) {
      return jsonError("Password must be between 8 and 128 characters.", 400);
    }

    admin = createAdminClient();

    const { data: currentOwner, error: ownerError } = await admin
      .from("users")
      .select(
        "id, restaurant_id, full_name, email, phone, auth_user_id, is_active, role_id"
      )
      .eq("id", ownerId)
      .eq("role_id", 3)
      .maybeSingle();

    if (ownerError) {
      console.error("Failed to load current owner:", ownerError);
      return jsonError("Failed to load current owner.", 500);
    }

    if (!currentOwner) {
      return jsonError("Restaurant owner not found.", 404);
    }

    const { data: existingUser, error: existingUserError } = await admin
      .from("users")
      .select("id")
      .eq("email", newOwnerEmail)
      .maybeSingle();

    if (existingUserError) {
      console.error("Failed to check owner email:", existingUserError);
      return jsonError("Unable to verify owner email.", 500);
    }

    if (existingUser && existingUser.id !== currentOwner.id) {
      return jsonError("An account with this email already exists.", 409);
    }

    // Supabase Auth enforces Auth-email uniqueness when creating the user.
    // Avoid listing a limited page of Auth users to check email availability.
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: newOwnerEmail,
        password: newOwnerPassword,
        email_confirm: true,
        user_metadata: {
          full_name: newOwnerName,
          restaurant_id: currentOwner.restaurant_id,
          role: "OWNER",
        },
      });

    if (authError || !authData.user) {
      console.error("Failed to create replacement owner:", authError);
      return jsonError(
        "Unable to create the replacement owner. Check that the email is available.",
        409
      );
    }

    newlyCreatedAuthUserId = authData.user.id;

    const { data: updatedOwner, error: updateError } = await admin
      .from("users")
      .update({
        full_name: newOwnerName,
        email: newOwnerEmail,
        auth_user_id: authData.user.id,
        password_hash: "SUPABASE_AUTH",
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentOwner.id)
      .eq("role_id", 3)
      .select(
        "id, restaurant_id, full_name, email, phone, is_active, role_id"
      )
      .maybeSingle();

    if (updateError || !updatedOwner) {
      console.error("Failed to update owner record:", updateError);

      const { error: rollbackError } =
        await admin.auth.admin.deleteUser(authData.user.id);

      if (rollbackError) {
        console.error(
          "Failed to clean up replacement Auth account:",
          rollbackError
        );
      } else {
        newlyCreatedAuthUserId = null;
      }

      return jsonError("Failed to update the restaurant owner.", 500);
    }

    // The new Auth account is now linked. Remove the old login afterward.
    let oldAuthCleanupFailed = false;

    if (
      currentOwner.auth_user_id &&
      currentOwner.auth_user_id !== authData.user.id
    ) {
      const { error: deleteOldAuthError } =
        await admin.auth.admin.deleteUser(currentOwner.auth_user_id);

      if (deleteOldAuthError) {
        oldAuthCleanupFailed = true;

        console.error(
          "Replacement owner linked, but old Auth cleanup failed:",
          deleteOldAuthError
        );
      }
    }

    newlyCreatedAuthUserId = null;

    return NextResponse.json(
      {
        message: oldAuthCleanupFailed
          ? "Owner changed, but the previous Auth account requires cleanup."
          : "Restaurant owner changed successfully.",
        owner: updatedOwner,
        ...(oldAuthCleanupFailed
          ? { warning: "Previous account cleanup is required." }
          : {}),
      },
      { status: 200, headers: privateHeaders }
    );
  } catch (error) {
    console.error("Change restaurant owner error:", error);

    // Best-effort cleanup if an unexpected failure occurred before the
    // replacement account was linked successfully.
    if (admin && newlyCreatedAuthUserId) {
      const { error: cleanupError } =
        await admin.auth.admin.deleteUser(newlyCreatedAuthUserId);

      if (cleanupError) {
        console.error("Replacement account cleanup failed:", cleanupError);
      }
    }

    return jsonError("Failed to change restaurant owner.", 500);
  }
}
