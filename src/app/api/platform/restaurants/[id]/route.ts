import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requirePlatformOwner() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const { data: platformUser, error: platformError } =
    await supabase
      .from("platform_users")
      .select(
        "id, full_name, email, is_active, auth_user_id"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (
    platformError ||
    !platformUser ||
    !platformUser.is_active
  ) {
    return {
      error: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    platformUser,
  };
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const auth = await requirePlatformOwner();

    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const restaurantId = Number(id);

    if (!Number.isInteger(restaurantId)) {
      return NextResponse.json(
        { error: "Invalid restaurant ID." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: restaurant, error } = await admin
      .from("restaurants")
      .select(`
        id,
        name,
        slug,
        phone,
        cuisine,
        address,
        accent_color,
        is_open,
        accept_orders,
        is_active,
        features,
        created_at,
        updated_at
      `)
      .eq("id", restaurantId)
      .maybeSingle();

    if (error) {
      console.error(
        "Restaurant fetch error:",
        error
      );

      return NextResponse.json(
        { error: "Failed to load restaurant." },
        { status: 500 }
      );
    }

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(restaurant);
  } catch (error) {
    console.error(
      "Restaurant GET error:",
      error
    );

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const auth = await requirePlatformOwner();

    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const restaurantId = Number(id);

    if (!Number.isInteger(restaurantId)) {
      return NextResponse.json(
        { error: "Invalid restaurant ID." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
    }

    if (typeof body.is_open === "boolean") {
      updates.is_open = body.is_open;
    }

    if (typeof body.accept_orders === "boolean") {
      updates.accept_orders =
        body.accept_orders;
    }

    if (typeof body.name === "string") {
      updates.name = body.name.trim();
    }

    if (typeof body.slug === "string") {
      updates.slug = body.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
    }

    if (typeof body.phone === "string") {
      updates.phone = body.phone.trim() || null;
    }

    if (typeof body.cuisine === "string") {
      updates.cuisine =
        body.cuisine.trim() || null;
    }

    if (typeof body.address === "string") {
      updates.address =
        body.address.trim() || null;
    }

    if (typeof body.accent_color === "string") {
      updates.accent_color =
        body.accent_color.trim() || "#E53935";
    }

    if (
      body.features &&
      typeof body.features === "object" &&
      !Array.isArray(body.features)
    ) {
      updates.features = body.features;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error: "No valid fields to update.",
        },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const admin = createAdminClient();

    const { data: restaurant, error } =
      await admin
        .from("restaurants")
        .update(updates)
        .eq("id", restaurantId)
        .select(`
          id,
          name,
          slug,
          phone,
          cuisine,
          address,
          accent_color,
          is_open,
          accept_orders,
          is_active,
          features,
          created_at,
          updated_at
        `)
        .single();

    if (error) {
      console.error(
        "Restaurant update error:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message ||
            "Failed to update restaurant.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(restaurant);
  } catch (error) {
    console.error(
      "Restaurant PATCH error:",
      error
    );

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const auth = await requirePlatformOwner();

    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const restaurantId = Number(id);

    if (!Number.isInteger(restaurantId)) {
      return NextResponse.json(
        { error: "Invalid restaurant ID." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Find restaurant first
    const { data: restaurant, error: restaurantError } =
      await admin
        .from("restaurants")
        .select("id, name")
        .eq("id", restaurantId)
        .maybeSingle();

    if (restaurantError) {
      console.error(
        "Restaurant lookup error:",
        restaurantError
      );

      return NextResponse.json(
        { error: "Failed to find restaurant." },
        { status: 500 }
      );
    }

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found." },
        { status: 404 }
      );
    }

    // Find all restaurant users
    const { data: restaurantUsers, error: usersError } =
      await admin
        .from("users")
        .select("id, auth_user_id")
        .eq("restaurant_id", restaurantId);

    if (usersError) {
      console.error(
        "Restaurant users lookup error:",
        usersError
      );

      return NextResponse.json(
        {
          error:
            "Failed to prepare restaurant deletion.",
        },
        { status: 500 }
      );
    }

    // Delete public.users records
    const { error: deleteUsersError } =
      await admin
        .from("users")
        .delete()
        .eq("restaurant_id", restaurantId);

    if (deleteUsersError) {
      console.error(
        "Restaurant users deletion error:",
        deleteUsersError
      );

      return NextResponse.json(
        {
          error:
            deleteUsersError.message ||
            "Failed to delete restaurant users.",
        },
        { status: 500 }
      );
    }

    // Delete restaurant
    const { error: deleteRestaurantError } =
      await admin
        .from("restaurants")
        .delete()
        .eq("id", restaurantId);

    if (deleteRestaurantError) {
      console.error(
        "Restaurant deletion error:",
        deleteRestaurantError
      );

      return NextResponse.json(
        {
          error:
            deleteRestaurantError.message ||
            "Failed to delete restaurant.",
        },
        { status: 500 }
      );
    }

    // Delete linked Supabase Auth users
    for (const restaurantUser of
      restaurantUsers || []) {
      if (restaurantUser.auth_user_id) {
        const { error: authDeleteError } =
          await admin.auth.admin.deleteUser(
            restaurantUser.auth_user_id
          );

        if (authDeleteError) {
          console.error(
            "Auth user deletion error:",
            authDeleteError
          );
        }
      }
    }

    return NextResponse.json({
      message:
        "Restaurant deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Restaurant DELETE error:",
      error
    );

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}