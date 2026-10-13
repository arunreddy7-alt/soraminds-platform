
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const privateHeaders = {
  "Cache-Control": "private, no-store",
};

const allowedFields = [
  "is_enabled",
  "delivery_fee",
  "free_delivery_minimum",
  "minimum_order_amount",
  "estimated_delivery_minutes",
  "origin_latitude",
  "origin_longitude",
  "fee_0_3_km",
  "fee_3_5_km",
  "fee_5_10_km",
] as const;

type SettingsInput = Record<string, unknown>;

async function getRestaurantAccess() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const admin = createAdminClient();

  const { data: staff, error } = await admin
    .from("users")
    .select("id, restaurant_id, is_active, role_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Delivery staff lookup failed:", error);
    return { error: "Unable to verify access", status: 500 } as const;
  }

  if (!staff || !staff.is_active || !staff.restaurant_id) {
    return { error: "Forbidden", status: 403 } as const;
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, is_active, features")
    .eq("id", staff.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    console.error("Delivery restaurant lookup failed:", restaurantError);
    return { error: "Unable to load restaurant", status: 500 } as const;
  }

  if (!restaurant || !restaurant.is_active) {
    return { error: "Restaurant is inactive", status: 403 } as const;
  }

  const features =
    restaurant.features &&
    typeof restaurant.features === "object" &&
    !Array.isArray(restaurant.features)
      ? (restaurant.features as Record<string, unknown>)
      : {};

  if (features.delivery !== true) {
    return {
      error: "Delivery is not enabled for this restaurant",
      status: 403,
    } as const;
  }

  return { admin, restaurant, staff } as const;
}

export async function GET() {
  try {
    const access = await getRestaurantAccess();

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status, headers: privateHeaders }
      );
    }

    const { data, error } = await access.admin
      .from("restaurant_delivery_settings")
      .select("*")
      .eq("restaurant_id", access.restaurant.id)
      .maybeSingle();

    if (error) {
      console.error("Delivery settings fetch failed:", error);
      return NextResponse.json(
        { error: "Failed to load delivery settings" },
        { status: 500, headers: privateHeaders }
      );
    }

    const defaults = {
      restaurant_id: access.restaurant.id,
      is_enabled: false,
      delivery_fee: 0,
      free_delivery_minimum: null,
      minimum_order_amount: 0,
      estimated_delivery_minutes: 45,
      origin_latitude: null,
      origin_longitude: null,
      fee_0_3_km: 30,
      fee_3_5_km: 50,
      fee_5_10_km: 80,
    };

    return NextResponse.json(
      { settings: { ...defaults, ...(data ?? {}) } },
      { headers: privateHeaders }
    );
  } catch (error) {
    console.error("Delivery settings GET failed:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500, headers: privateHeaders }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getRestaurantAccess();

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status, headers: privateHeaders }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400, headers: privateHeaders }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be an object" },
        { status: 400, headers: privateHeaders }
      );
    }

    const input = body as SettingsInput;

    if (Object.keys(input).length === 0) {
      return NextResponse.json(
        { error: "No settings provided" },
        { status: 400, headers: privateHeaders }
      );
    }

    if (Object.keys(input).some((key) => !allowedFields.includes(key as (typeof allowedFields)[number]))) {
      return NextResponse.json(
        { error: "Unknown settings field" },
        { status: 400, headers: privateHeaders }
      );
    }

    if (
      "is_enabled" in input &&
      typeof input.is_enabled !== "boolean"
    ) {
      return NextResponse.json(
        { error: "is_enabled must be a boolean" },
        { status: 400, headers: privateHeaders }
      );
    }

    const nonNegativeNumberFields = [
      "delivery_fee",
      "minimum_order_amount",
      "fee_0_3_km",
      "fee_3_5_km",
      "fee_5_10_km",
    ];

    for (const field of nonNegativeNumberFields) {
      if (!(field in input)) continue;

      const value = input[field];

      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0
      ) {
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400, headers: privateHeaders }
        );
      }
    }

    if ("estimated_delivery_minutes" in input) {
      const value = input.estimated_delivery_minutes;

      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value < 1
      ) {
        return NextResponse.json(
          { error: "Invalid estimated_delivery_minutes" },
          { status: 400, headers: privateHeaders }
        );
      }
    }

    if (
      "free_delivery_minimum" in input &&
      input.free_delivery_minimum !== null &&
      (
        typeof input.free_delivery_minimum !== "number" ||
        !Number.isFinite(input.free_delivery_minimum) ||
        input.free_delivery_minimum < 0
      )
    ) {
      return NextResponse.json(
        { error: "Invalid free_delivery_minimum" },
        { status: 400, headers: privateHeaders }
      );
    }

    for (const field of [
      "origin_latitude",
      "origin_longitude",
    ] as const) {
      if (!(field in input)) continue;

      const value = input[field];

      if (value === null) continue;

      const valid =
        typeof value === "number" &&
        Number.isFinite(value) &&
        (field === "origin_latitude"
          ? value >= -90 && value <= 90
          : value >= -180 && value <= 180);

      if (!valid) {
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400, headers: privateHeaders }
        );
      }
    }

    const { data: existing, error: existingError } = await access.admin
      .from("restaurant_delivery_settings")
      .select("id")
      .eq("restaurant_id", access.restaurant.id)
      .maybeSingle();

    if (existingError) {
      console.error("Delivery settings lookup failed:", existingError);
      return NextResponse.json(
        { error: "Failed to verify delivery settings" },
        { status: 500, headers: privateHeaders }
      );
    }

    const updates = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const query = existing
      ? access.admin
          .from("restaurant_delivery_settings")
          .update(updates)
          .eq("restaurant_id", access.restaurant.id)
      : access.admin
          .from("restaurant_delivery_settings")
          .insert({
            restaurant_id: access.restaurant.id,
            ...updates,
          });

    const { data, error } = await query.select("*").single();

    if (error) {
      console.error("Delivery settings save failed:", error);

      return NextResponse.json(
        {
          error: "Failed to save delivery settings",
          // Useful during development; remove database details in production.
          details: error.message,
          code: error.code,
        },
        { status: 500, headers: privateHeaders }
      );
    }

    return NextResponse.json(
      { settings: data },
      { headers: privateHeaders }
    );
  } catch (error) {
    console.error("Delivery settings PATCH failed:", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500, headers: privateHeaders }
    );
  }
}
