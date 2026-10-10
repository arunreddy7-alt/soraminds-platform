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

function accessDenied(error: string) {
  return NextResponse.json(
    {
      error:
        error === "internal"
          ? "Unable to verify platform access."
          : "Unauthorized.",
    },
    {
      status: error === "internal" ? 500 : 401,
      headers: privateHeaders,
    }
  );
}

function parseOwnerId(id: string) {
  if (!/^[1-9]\d*$/.test(id)) {
    return null;
  }

  const ownerId = Number(id);

  return Number.isSafeInteger(ownerId) ? ownerId : null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requirePlatformOwner();

    if (!access.authorized) {
      return accessDenied(access.error);
    }

    const { id } = await context.params;
    const ownerId = parseOwnerId(id);

    if (ownerId === null) {
      return NextResponse.json(
        { error: "Invalid owner ID." },
        { status: 400, headers: privateHeaders }
      );
    }

    const admin = createAdminClient();

    const { data: owner, error } = await admin
      .from("users")
      .select(
        "id, restaurant_id, full_name, email, phone, is_active, role_id, created_at, updated_at"
      )
      .eq("id", ownerId)
      .eq("role_id", 3)
      .maybeSingle();

    if (error) {
      console.error("Failed to load owner:", error);

      return NextResponse.json(
        { error: "Failed to load owner." },
        { status: 500, headers: privateHeaders }
      );
    }

    if (!owner) {
      return NextResponse.json(
        { error: "Restaurant owner not found." },
        { status: 404, headers: privateHeaders }
      );
    }

    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .select("id, name, slug")
      .eq("id", owner.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      console.error("Failed to load owner restaurant:", restaurantError);

      return NextResponse.json(
        { error: "Failed to load owner details." },
        { status: 500, headers: privateHeaders }
      );
    }

    return NextResponse.json(
      {
        owner: {
          ...owner,
          restaurant_name: restaurant?.name ?? "Unknown Restaurant",
          restaurant_slug: restaurant?.slug ?? "—",
        },
      },
      { status: 200, headers: privateHeaders }
    );
  } catch (error) {
    console.error("Get owner error:", error);

    return NextResponse.json(
      { error: "Failed to load owner." },
      { status: 500, headers: privateHeaders }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requirePlatformOwner();

    if (!access.authorized) {
      return accessDenied(access.error);
    }

    const { id } = await context.params;
    const ownerId = parseOwnerId(id);

    if (ownerId === null) {
      return NextResponse.json(
        { error: "Invalid owner ID." },
        { status: 400, headers: privateHeaders }
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

      return NextResponse.json(
        { error: "Failed to find restaurant owner." },
        { status: 500, headers: privateHeaders }
      );
    }

    if (!owner) {
      return NextResponse.json(
        { error: "Restaurant owner not found." },
        { status: 404, headers: privateHeaders }
      );
    }

    // Remove the Auth account first so a failure doesn't leave the
    // database record deleted while the owner can still sign in.
    if (owner.auth_user_id) {
      const { error: authDeleteError } =
        await admin.auth.admin.deleteUser(owner.auth_user_id);

      if (authDeleteError) {
        console.error("Failed to delete owner Auth account:", authDeleteError);

        return NextResponse.json(
          { error: "Unable to remove owner login. No database record was deleted." },
          { status: 500, headers: privateHeaders }
        );
      }
    }

    const { data: deletedOwner, error: deleteUserError } = await admin
      .from("users")
      .delete()
      .eq("id", owner.id)
      .eq("role_id", 3)
      .select("id")
      .maybeSingle();

    if (deleteUserError || !deletedOwner) {
      console.error("Failed to remove owner database record:", deleteUserError);

      return NextResponse.json(
        {
          error:
            "The login was removed, but the owner database record could not be removed. Please review the owner record.",
        },
        { status: 500, headers: privateHeaders }
      );
    }

    return NextResponse.json(
      { message: "Restaurant owner removed successfully." },
      { status: 200, headers: privateHeaders }
    );
  } catch (error) {
    console.error("Remove owner error:", error);

    return NextResponse.json(
      { error: "Failed to remove restaurant owner." },
      { status: 500, headers: privateHeaders }
    );
  }
}
