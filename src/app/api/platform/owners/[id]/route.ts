import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requirePlatformOwner() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: platformUser, error } = await supabase
    .from("platform_users")
    .select("id, is_active, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    error ||
    !platformUser ||
    !platformUser.is_active
  ) {
    return null;
  }

  return platformUser;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const platformUser = await requirePlatformOwner();

    if (!platformUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const ownerId = Number(id);

    if (!Number.isInteger(ownerId)) {
      return NextResponse.json(
        { error: "Invalid owner ID." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: owner, error } = await admin
      .from("users")
      .select(
        "id, restaurant_id, full_name, email, phone, is_active, auth_user_id, role_id, created_at, updated_at"
      )
      .eq("id", ownerId)
      .eq("role_id", 3)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!owner) {
      return NextResponse.json(
        { error: "Restaurant owner not found." },
        { status: 404 }
      );
    }

    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name, slug")
      .eq("id", owner.restaurant_id)
      .maybeSingle();

    return NextResponse.json({
      owner: {
        ...owner,
        restaurant_name:
          restaurant?.name || "Unknown Restaurant",
        restaurant_slug:
          restaurant?.slug || "—",
      },
    });
  } catch (error) {
    console.error(
      "Get owner error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load owner.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const platformUser = await requirePlatformOwner();

    if (!platformUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const ownerId = Number(id);

    if (!Number.isInteger(ownerId)) {
      return NextResponse.json(
        { error: "Invalid owner ID." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: owner, error: ownerError } =
      await admin
        .from("users")
        .select(
          "id, restaurant_id, auth_user_id, role_id"
        )
        .eq("id", ownerId)
        .eq("role_id", 3)
        .maybeSingle();

    if (ownerError) {
      return NextResponse.json(
        { error: ownerError.message },
        { status: 500 }
      );
    }

    if (!owner) {
      return NextResponse.json(
        {
          error: "Restaurant owner not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Remove access from the restaurant user table.
     * Restaurant data is NOT deleted.
     */
    const { error: deleteUserError } =
      await admin
        .from("users")
        .delete()
        .eq("id", owner.id);

    if (deleteUserError) {
      console.error(
        "Failed to remove owner:",
        deleteUserError
      );

      return NextResponse.json(
        {
          error:
            deleteUserError.message,
        },
        { status: 500 }
      );
    }

    /*
     * Remove the Supabase Auth login.
     */
    if (owner.auth_user_id) {
      const { error: authDeleteError } =
        await admin.auth.admin.deleteUser(
          owner.auth_user_id
        );

      if (authDeleteError) {
        console.error(
          "Owner database record removed, but Auth account could not be deleted:",
          authDeleteError
        );
      }
    }

    return NextResponse.json({
      message:
        "Restaurant owner removed successfully.",
    });
  } catch (error) {
    console.error(
      "Remove owner error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to remove restaurant owner.",
      },
      { status: 500 }
    );
  }
}