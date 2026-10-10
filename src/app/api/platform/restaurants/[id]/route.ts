import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const privateHeaders = {
  "Cache-Control": "private, no-store",
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: privateHeaders,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function requirePlatformOwner() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: jsonError("Unauthorized.", 401) };
  }

  const admin = createAdminClient();

  const { data: platformUser, error } = await admin
    .from("platform_users")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Platform membership lookup failed:", error);
    return {
      error: jsonError("Unable to verify platform access.", 500),
    };
  }

  if (!platformUser || !platformUser.is_active) {
    return { error: jsonError("Forbidden.", 403) };
  }

  return { admin };
}

async function getRestaurantId(context: {
  params: Promise<{ id: string }>;
}): Promise<number | null> {
  const { id } = await context.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return null;
  }

  const restaurantId = Number(id);

  return Number.isSafeInteger(restaurantId)
    ? restaurantId
    : null;
}

/* --------------------------------
   GET RESTAURANT
--------------------------------- */

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformOwner();

    if ("error" in auth) {
      return auth.error;
    }

    const restaurantId = await getRestaurantId(context);

    if (restaurantId === null) {
      return jsonError("Invalid restaurant ID.", 400);
    }

    const { data: restaurant, error } = await auth.admin
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
      console.error("Restaurant fetch failed:", error);
      return jsonError("Failed to load restaurant.", 500);
    }

    if (!restaurant) {
      return jsonError("Restaurant not found.", 404);
    }

    return NextResponse.json(restaurant, {
      headers: privateHeaders,
    });
  } catch (error) {
    console.error("Restaurant GET failed:", error);
    return jsonError("Something went wrong.", 500);
  }
}

/* --------------------------------
   UPDATE RESTAURANT
--------------------------------- */

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformOwner();

    if ("error" in auth) {
      return auth.error;
    }

    const restaurantId = await getRestaurantId(context);

    if (restaurantId === null) {
      return jsonError("Invalid restaurant ID.", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    if (!isRecord(body)) {
      return jsonError("Request body must be an object.", 400);
    }

    const updates: Record<string, unknown> = {};

    for (const field of [
      "is_active",
      "is_open",
      "accept_orders",
    ] as const) {
      if (field in body) {
        if (typeof body[field] !== "boolean") {
          return jsonError(`${field} must be a boolean.`, 400);
        }

        updates[field] = body[field];
      }
    }

    if ("name" in body) {
      if (typeof body.name !== "string") {
        return jsonError("Restaurant name must be a string.", 400);
      }

      const name = body.name.trim();

      if (!name || name.length > 150) {
        return jsonError(
          "Restaurant name must contain 1–150 characters.",
          400
        );
      }

      updates.name = name;
    }

    if ("slug" in body) {
      if (typeof body.slug !== "string") {
        return jsonError("Restaurant slug must be a string.", 400);
      }

      const slug = body.slug.trim().toLowerCase();

      if (
        slug.length > 100 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      ) {
        return jsonError(
          "Slug must contain lowercase letters, numbers, and single hyphens between segments.",
          400
        );
      }

      updates.slug = slug;
    }

    for (const field of ["phone", "cuisine", "address"] as const) {
      if (field in body) {
        if (
          body[field] !== null &&
          typeof body[field] !== "string"
        ) {
          return jsonError(`${field} must be a string or null.`, 400);
        }

        const value =
          typeof body[field] === "string"
            ? body[field].trim()
            : "";

        const maxLength =
          field === "phone" ? 30 :
          field === "cuisine" ? 100 : 500;

        if (value.length > maxLength) {
          return jsonError(
            `${field} cannot exceed ${maxLength} characters.`,
            400
          );
        }

        updates[field] = value || null;
      }
    }

    if ("accent_color" in body) {
      if (typeof body.accent_color !== "string") {
        return jsonError("Accent color must be a string.", 400);
      }

      const color = body.accent_color.trim();

      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return jsonError(
          "Accent color must be a valid six-digit hex color.",
          400
        );
      }

      updates.accent_color = color;
    }

    if ("features" in body) {
      if (!isRecord(body.features)) {
        return jsonError("Features must be an object.", 400);
      }

      const entries = Object.entries(body.features);

      if (
        entries.length > 50 ||
        entries.some(
          ([key, value]) =>
            !/^[a-zA-Z0-9_-]{1,100}$/.test(key) ||
            typeof value !== "boolean"
        )
      ) {
        return jsonError(
          "Features must contain at most 50 named boolean values.",
          400
        );
      }

      updates.features = body.features;
    }

    if (Object.keys(updates).length === 0) {
      return jsonError("No valid fields to update.", 400);
    }

    updates.updated_at = new Date().toISOString();

    const { data: restaurant, error } = await auth.admin
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
      .maybeSingle();

    if (error) {
      console.error("Restaurant update failed:", error);

      if (error.code === "23505") {
        return jsonError(
          "That restaurant slug is already in use.",
          409
        );
      }

      return jsonError("Failed to update restaurant.", 500);
    }

    if (!restaurant) {
      return jsonError("Restaurant not found.", 404);
    }

    return NextResponse.json(restaurant, {
      headers: privateHeaders,
    });
  } catch (error) {
    console.error("Restaurant PATCH failed:", error);
    return jsonError("Something went wrong.", 500);
  }
}

/* --------------------------------
   SAFELY DELETE RESTAURANT
--------------------------------- */

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformOwner();

    if ("error" in auth) {
      return auth.error;
    }

    const restaurantId = await getRestaurantId(context);

    if (restaurantId === null) {
      return jsonError("Invalid restaurant ID.", 400);
    }

    const { data, error } = await auth.admin.rpc(
      "delete_restaurant_safely",
      { p_restaurant_id: restaurantId }
    );

    if (error) {
      console.error("Restaurant deletion RPC failed:", error);
      return jsonError("Failed to delete restaurant safely.", 500);
    }

    if (!isRecord(data) || data.ok !== true) {
      if (isRecord(data) && data.code === "NOT_FOUND") {
        return jsonError("Restaurant not found.", 404);
      }

      if (isRecord(data) && data.code === "ORDERS_EXIST") {
        return NextResponse.json(
          {
            error:
              "This restaurant has existing orders and cannot be permanently deleted. Deactivate it to preserve order history.",
            orderCount:
              typeof data.order_count === "number"
                ? data.order_count
                : undefined,
          },
          { status: 409, headers: privateHeaders }
        );
      }

      console.error("Restaurant deletion RPC returned an unexpected result.");
      return jsonError("Restaurant deletion was not completed.", 500);
    }

    const authUserIds: string[] = Array.isArray(data.auth_user_ids)
      ? data.auth_user_ids.filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0
        )
      : [];

    let failedAuthDeletions = 0;

    for (const authUserId of authUserIds) {
      const { error: deleteError } =
        await auth.admin.auth.admin.deleteUser(authUserId);

      if (deleteError) {
        failedAuthDeletions += 1;
        console.error(
          "Restaurant Auth cleanup failed:",
          deleteError
        );
      }
    }

    return NextResponse.json(
      {
        message: failedAuthDeletions
          ? "Restaurant deleted. Some linked Auth accounts need cleanup."
          : "Restaurant deleted successfully.",
        authCleanupPending: failedAuthDeletions > 0,
      },
      { headers: privateHeaders }
    );
  } catch (error) {
    console.error("Restaurant DELETE failed:", error);
    return jsonError("Something went wrong.", 500);
  }
}