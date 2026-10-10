import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const privateHeaders = {
  "Cache-Control": "private, no-store",
};

type CreateRestaurantRequest = {
  name: string;
  slug: string;
  phone?: string;
  cuisine?: string;
  address?: string;
  accent_color?: string;
  is_open?: boolean;
  accept_orders?: boolean;
  owner_full_name: string;
  owner_email: string;
  owner_password: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: privateHeaders }
  );
}

async function requirePlatformOwner() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false as const, reason: "unauthorized" };
  }

  const admin = createAdminClient();

  const { data: platformUser, error } = await admin
    .from("platform_users")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Platform membership check failed:", error);
    return { authorized: false as const, reason: "internal" };
  }

  if (!platformUser || !platformUser.is_active) {
    return { authorized: false as const, reason: "unauthorized" };
  }

  return { authorized: true as const };
}

export async function POST(request: Request) {
  try {
    // 1. Verify the authenticated platform user.
    const access = await requirePlatformOwner();

    if (!access.authorized) {
      return jsonError(
        access.reason === "internal"
          ? "Unable to verify platform access."
          : "Unauthorized.",
        access.reason === "internal" ? 500 : 401
      );
    }

    // 2. Parse and validate the request body.
    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    if (!isRecord(rawBody)) {
      return jsonError("Invalid request body.", 400);
    }

    const body = rawBody as Partial<CreateRestaurantRequest>;

    const requiredFields = [
      body.name,
      body.slug,
      body.owner_full_name,
      body.owner_email,
      body.owner_password,
    ];

    if (
      requiredFields.some(
        (value) => typeof value !== "string" || !value.trim()
      )
    ) {
      return jsonError(
        "Restaurant name, slug, owner name, owner email and owner password are required.",
        400
      );
    }

    const optionalStrings = [
      body.phone,
      body.cuisine,
      body.address,
      body.accent_color,
    ];

    if (
      optionalStrings.some(
        (value) => value !== undefined && typeof value !== "string"
      )
    ) {
      return jsonError("Invalid optional field type.", 400);
    }

    if (
      (body.is_open !== undefined && typeof body.is_open !== "boolean") ||
      (body.accept_orders !== undefined &&
        typeof body.accept_orders !== "boolean")
    ) {
      return jsonError(
        "is_open and accept_orders must be boolean values.",
        400
      );
    }

    const name = body.name!.trim();
    const ownerName = body.owner_full_name!.trim();
    const ownerEmail = body.owner_email!.trim().toLowerCase();
    const ownerPassword = body.owner_password!;

    const restaurantSlug = body.slug!
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    if (name.length > 150) {
      return jsonError("Restaurant name cannot exceed 150 characters.", 400);
    }

    if (ownerName.length < 2 || ownerName.length > 150) {
      return jsonError(
        "Owner name must be between 2 and 150 characters.",
        400
      );
    }

    if (
      ownerEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)
    ) {
      return jsonError("Enter a valid owner email address.", 400);
    }

    if (ownerPassword.length < 8 || ownerPassword.length > 128) {
      return jsonError(
        "Owner password must be between 8 and 128 characters.",
        400
      );
    }

    if (
      restaurantSlug.length > 100 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(restaurantSlug)
    ) {
      return jsonError(
        "Slug must contain only lowercase letters, numbers and single hyphens between words.",
        400
      );
    }

    const phone = body.phone?.trim() || null;
    const cuisine = body.cuisine?.trim() || null;
    const address = body.address?.trim() || null;
    const accentColor = body.accent_color?.trim() || "#E53935";

    if (phone && phone.length > 30) {
      return jsonError("Phone cannot exceed 30 characters.", 400);
    }

    if (cuisine && cuisine.length > 100) {
      return jsonError("Cuisine cannot exceed 100 characters.", 400);
    }

    if (address && address.length > 500) {
      return jsonError("Address cannot exceed 500 characters.", 400);
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      return jsonError(
        "Accent color must be a valid six-digit hex color.",
        400
      );
    }

    // 3. Use the admin client for server-side database operations.
    const admin = createAdminClient();

    // 4. Check restaurant slug availability.
    const { data: existingRestaurant, error: slugCheckError } =
      await admin
        .from("restaurants")
        .select("id")
        .eq("slug", restaurantSlug)
        .maybeSingle();

    if (slugCheckError) {
      console.error("Restaurant slug lookup failed:", slugCheckError);
      return jsonError("Unable to verify restaurant slug.", 500);
    }

    if (existingRestaurant) {
      return jsonError(
        "A restaurant with this slug already exists.",
        409
      );
    }

    // 5. Check owner email in the application user table.
    const { data: existingOwner, error: emailCheckError } = await admin
      .from("users")
      .select("id")
      .eq("email", ownerEmail)
      .maybeSingle();

    if (emailCheckError) {
      console.error("Owner email lookup failed:", emailCheckError);
      return jsonError("Unable to verify owner email.", 500);
    }

    if (existingOwner) {
      return jsonError("A user with this email already exists.", 409);
    }

    // 6. Create the restaurant.
    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .insert({
        name,
        slug: restaurantSlug,
        phone,
        cuisine,
        address,
        accent_color: accentColor,
        is_open: body.is_open ?? true,
        accept_orders: body.accept_orders ?? true,
        is_active: true,
        features: {
          delivery: false,
          vip_lounge: false,
          bar: false,
          live_entertainment: false,
        },
      })
      .select(
        "id, name, slug, phone, cuisine, address, accent_color, is_open, accept_orders, is_active, features, created_at"
      )
      .single();

    if (restaurantError || !restaurant) {
      console.error("Restaurant creation failed:", restaurantError);

      if (restaurantError?.code === "23505") {
        return jsonError(
          "A restaurant with this slug already exists.",
          409
        );
      }

      return jsonError("Failed to create restaurant.", 500);
    }

    // 7. Create the owner's Supabase Auth account.
    const { data: authData, error: authCreateError } =
      await admin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: {
          full_name: ownerName,
          restaurant_id: restaurant.id,
          role: "OWNER",
        },
      });

    if (authCreateError || !authData.user) {
      console.error("Owner Auth creation failed:", authCreateError);

      const { error: rollbackError } = await admin
        .from("restaurants")
        .delete()
        .eq("id", restaurant.id);

      if (rollbackError) {
        console.error("Restaurant rollback failed:", rollbackError);
      }

      return jsonError(
        "Unable to create the owner account. Verify that the email is available.",
        400
      );
    }

    // 8. Create the application owner record.
    const { data: owner, error: ownerError } = await admin
      .from("users")
      .insert({
        restaurant_id: restaurant.id,
        role_id: 3,
        full_name: ownerName,
        email: ownerEmail,
        phone: null,
        password_hash: "SUPABASE_AUTH",
        is_active: true,
        auth_user_id: authData.user.id,
      })
      .select(
        "id, restaurant_id, role_id, full_name, email, phone, is_active"
      )
      .single();

    if (ownerError || !owner) {
      console.error("Owner database creation failed:", ownerError);

      const { error: authRollbackError } =
        await admin.auth.admin.deleteUser(authData.user.id);

      if (authRollbackError) {
        console.error("Owner Auth rollback failed:", authRollbackError);
      }

      const { error: restaurantRollbackError } = await admin
        .from("restaurants")
        .delete()
        .eq("id", restaurant.id);

      if (restaurantRollbackError) {
        console.error(
          "Restaurant rollback failed:",
          restaurantRollbackError
        );
      }

      if (ownerError?.code === "23505") {
        return jsonError(
          "An account with this email already exists.",
          409
        );
      }

      return jsonError("Failed to create restaurant owner.", 500);
    }

    // 9. Return only the fields needed by the frontend.
    return NextResponse.json(
      {
        message: "Restaurant and owner created successfully.",
        restaurant,
        owner,
      },
      { status: 201, headers: privateHeaders }
    );
  } catch (error) {
    console.error("Create restaurant unexpected error:", error);

    return jsonError("Failed to create restaurant.", 500);
  }
}
