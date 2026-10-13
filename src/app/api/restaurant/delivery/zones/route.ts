import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const privateHeaders = {
  "Cache-Control": "private, no-store",
};

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
    console.error("Delivery zone staff lookup failed:", error);
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
    console.error("Delivery zone restaurant lookup failed:", restaurantError);
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

function parseZoneInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be an object" };
  }

  const input = body as Record<string, unknown>;
  const allowed = [
    "name",
    "pincodes",
    "delivery_fee",
    "estimated_delivery_minutes",
    "is_active",
  ];

  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    return { error: "Unknown delivery zone field" };
  }

  const result: Record<string, unknown> = {};

  if ("name" in input) {
    if (
      typeof input.name !== "string" ||
      input.name.trim().length < 2 ||
      input.name.trim().length > 100
    ) {
      return { error: "Zone name must be between 2 and 100 characters" };
    }

    result.name = input.name.trim();
  }

  if ("pincodes" in input) {
    if (
      !Array.isArray(input.pincodes) ||
      input.pincodes.length === 0 ||
      input.pincodes.length > 200 ||
      !input.pincodes.every(
        (pincode) =>
          typeof pincode === "string" &&
          /^[0-9]{6}$/.test(pincode.trim())
      )
    ) {
      return {
        error: "Enter at least one valid six-digit pincode",
      };
    }

    const pincodes = [
      ...new Set(
        (input.pincodes as string[]).map((pincode) => pincode.trim())
      ),
    ];

    result.pincodes = pincodes;
  }

  if ("delivery_fee" in input) {
    if (
      typeof input.delivery_fee !== "number" ||
      !Number.isFinite(input.delivery_fee) ||
      input.delivery_fee < 0
    ) {
      return { error: "Delivery fee must be zero or greater" };
    }

    result.delivery_fee = input.delivery_fee;
  }

  if ("estimated_delivery_minutes" in input) {
    if (
      typeof input.estimated_delivery_minutes !== "number" ||
      !Number.isInteger(input.estimated_delivery_minutes) ||
      input.estimated_delivery_minutes < 1 ||
      input.estimated_delivery_minutes > 1440
    ) {
      return {
        error: "Estimated delivery time must be between 1 and 1440 minutes",
      };
    }

    result.estimated_delivery_minutes =
      input.estimated_delivery_minutes;
  }

  if ("is_active" in input) {
    if (typeof input.is_active !== "boolean") {
      return { error: "is_active must be a boolean" };
    }

    result.is_active = input.is_active;
  }

  return { data: result };
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
      .from("restaurant_delivery_zones")
      .select("*")
      .eq("restaurant_id", access.restaurant.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Delivery zones fetch failed:", error);

      return NextResponse.json(
        { error: "Failed to load delivery zones" },
        { status: 500, headers: privateHeaders }
      );
    }

    return NextResponse.json(
      { zones: data ?? [] },
      { headers: privateHeaders }
    );
  } catch (error) {
    console.error("Delivery zones GET failed:", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500, headers: privateHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await getRestaurantAccess();

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status, headers: privateHeaders }
      );
    }

    const body: unknown = await request.json();
    const parsed = parseZoneInput(body);

    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400, headers: privateHeaders }
      );
    }

    const input = parsed.data;

    if (
      !("name" in input) ||
      !("pincodes" in input) ||
      !("delivery_fee" in input) ||
      !("estimated_delivery_minutes" in input)
    ) {
      return NextResponse.json(
        {
          error:
            "Name, pincodes, delivery fee, and estimated delivery time are required",
        },
        { status: 400, headers: privateHeaders }
      );
    }

    const { data: existing, error: lookupError } = await access.admin
      .from("restaurant_delivery_zones")
      .select("id, pincodes")
      .eq("restaurant_id", access.restaurant.id);

    if (lookupError) {
      console.error("Delivery zone lookup failed:", lookupError);

      return NextResponse.json(
        { error: "Failed to validate delivery zones" },
        { status: 500, headers: privateHeaders }
      );
    }

    const existingPincodes = new Set(
      (existing ?? []).flatMap((zone) =>
        Array.isArray(zone.pincodes) ? zone.pincodes : []
      )
    );

    const duplicates = (input.pincodes as string[]).filter((pincode) =>
      existingPincodes.has(pincode)
    );

    if (duplicates.length > 0) {
      return NextResponse.json(
        {
          error: `These pincodes already belong to another zone: ${duplicates.join(", ")}`,
        },
        { status: 409, headers: privateHeaders }
      );
    }

    const { data, error } = await access.admin
      .from("restaurant_delivery_zones")
      .insert({
        restaurant_id: access.restaurant.id,
        name: input.name,
        pincodes: input.pincodes,
        delivery_fee: input.delivery_fee,
        estimated_delivery_minutes: input.estimated_delivery_minutes,
        is_active: "is_active" in input ? input.is_active : true,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Delivery zone creation failed:", error);

      return NextResponse.json(
        { error: "Failed to create delivery zone" },
        { status: 500, headers: privateHeaders }
      );
    }

    return NextResponse.json(
      { zone: data },
      { status: 201, headers: privateHeaders }
    );
  } catch (error) {
    console.error("Delivery zones POST failed:", error);

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

    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be an object" },
        { status: 400, headers: privateHeaders }
      );
    }

    const raw = body as Record<string, unknown>;
    const id = raw.id;

    if (
      typeof id !== "number" ||
      !Number.isInteger(id) ||
      id < 1
    ) {
      return NextResponse.json(
        { error: "A valid zone id is required" },
        { status: 400, headers: privateHeaders }
      );
    }

    const parsed = parseZoneInput(
      Object.fromEntries(
        Object.entries(raw).filter(([key]) => key !== "id")
      )
    );

    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400, headers: privateHeaders }
      );
    }

    const updates = parsed.data;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update" },
        { status: 400, headers: privateHeaders }
      );
    }

    if ("pincodes" in updates) {
      const { data: otherZones, error: lookupError } = await access.admin
        .from("restaurant_delivery_zones")
        .select("id, pincodes")
        .eq("restaurant_id", access.restaurant.id)
        .neq("id", id);

      if (lookupError) {
        console.error("Delivery zone lookup failed:", lookupError);

        return NextResponse.json(
          { error: "Failed to validate delivery zones" },
          { status: 500, headers: privateHeaders }
        );
      }

      const existingPincodes = new Set(
        (otherZones ?? []).flatMap((zone) =>
          Array.isArray(zone.pincodes) ? zone.pincodes : []
        )
      );

      const duplicates = (updates.pincodes as string[]).filter(
        (pincode) => existingPincodes.has(pincode)
      );

      if (duplicates.length > 0) {
        return NextResponse.json(
          {
            error: `These pincodes already belong to another zone: ${duplicates.join(", ")}`,
          },
          { status: 409, headers: privateHeaders }
        );
      }
    }

    const { data, error } = await access.admin
      .from("restaurant_delivery_zones")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("restaurant_id", access.restaurant.id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Delivery zone update failed:", error);

      return NextResponse.json(
        { error: "Failed to update delivery zone" },
        { status: 500, headers: privateHeaders }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Delivery zone not found" },
        { status: 404, headers: privateHeaders }
      );
    }

    return NextResponse.json(
      { zone: data },
      { headers: privateHeaders }
    );
  } catch (error) {
    console.error("Delivery zones PATCH failed:", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500, headers: privateHeaders }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await getRestaurantAccess();

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status, headers: privateHeaders }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "A valid zone id is required" },
        { status: 400, headers: privateHeaders }
      );
    }

    const { data, error } = await access.admin
      .from("restaurant_delivery_zones")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", access.restaurant.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Delivery zone delete failed:", error);

      return NextResponse.json(
        { error: "Failed to delete delivery zone" },
        { status: 500, headers: privateHeaders }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Delivery zone not found" },
        { status: 404, headers: privateHeaders }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: privateHeaders }
    );
  } catch (error) {
    console.error("Delivery zones DELETE failed:", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500, headers: privateHeaders }
    );
  }
}
