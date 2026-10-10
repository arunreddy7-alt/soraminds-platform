import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function authorizeStaff(requireFullAccess: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const admin = createAdminClient();

  const { data: staff, error: staffError } = await admin
    .from("users")
    .select("id, restaurant_id, role_id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (staffError) {
    console.error("Promotion staff lookup failed:", staffError);
    return {
      error: "Unable to verify staff account",
      status: 500 as const,
    };
  }

  if (!staff || !staff.is_active || !staff.restaurant_id) {
    return {
      error: "Staff account is inactive or unavailable",
      status: 403 as const,
    };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, name, is_active")
    .eq("id", staff.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    console.error("Promotion restaurant lookup failed:", restaurantError);
    return {
      error: "Unable to verify restaurant",
      status: 500 as const,
    };
  }

  if (!restaurant || !restaurant.is_active) {
    return {
      error: "Restaurant is inactive or unavailable",
      status: 403 as const,
    };
  }

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("name")
    .eq("id", staff.role_id)
    .maybeSingle();

  if (roleError) {
    console.error("Promotion role lookup failed:", roleError);
    return { error: "Unable to verify role", status: 500 as const };
  }

  if (!role) {
    return { error: "Staff role not found", status: 403 as const };
  }

  if (role.name === "OWNER") {
    return { admin, staff, restaurant };
  }

  const { data: permission, error: permissionError } = await admin
    .from("permissions")
    .select("access")
    .eq("role_id", staff.role_id)
    .eq("module", "promotions")
    .maybeSingle();

  if (permissionError) {
    console.error("Promotion permission lookup failed:", permissionError);
    return {
      error: "Unable to verify permissions",
      status: 500 as const,
    };
  }

  const allowed = requireFullAccess
    ? permission?.access === "FULL"
    : permission?.access === "FULL" || permission?.access === "VIEW";

  if (!allowed) {
    return {
      error: "You do not have permission to manage promotions",
      status: 403 as const,
    };
  }

  return { admin, staff, restaurant };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validateBanner(body: Record<string, unknown>) {
  const title =
    typeof body.title === "string" ? body.title.trim() : "";

  const description =
    body.description === null || body.description === undefined
      ? ""
      : typeof body.description === "string"
        ? body.description.trim()
        : null;

  const sortOrder = body.sort_order;

  if (!title || title.length > 200) {
    return {
      error: "Title is required and must be at most 200 characters.",
    };
  }

  if (description === null) {
    return { error: "Description must be a string or null." };
  }

  if (description.length > 2000) {
    return {
      error: "Description must be at most 2000 characters.",
    };
  }

  if (
    typeof sortOrder !== "number" ||
    !Number.isSafeInteger(sortOrder) ||
    sortOrder < 0
  ) {
    return {
      error: "Sort order must be a non-negative whole number.",
    };
  }

  let imageUrl: string | null = null;

  if (
    body.image_url !== null &&
    body.image_url !== undefined &&
    body.image_url !== ""
  ) {
    if (
      typeof body.image_url !== "string" ||
      body.image_url.length > 2048
    ) {
      return { error: "Invalid image URL." };
    }

    try {
      const url = new URL(body.image_url);

      if (url.protocol !== "https:") {
        return { error: "Image URL must use HTTPS." };
      }

      imageUrl = url.toString();
    } catch {
      return { error: "Invalid image URL." };
    }
  }

  return {
    value: {
      title,
      description: description || null,
      image_url: imageUrl,
      sort_order: sortOrder,
    },
  };
}

export async function GET() {
  try {
    const auth = await authorizeStaff(false);

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { data: banners, error } = await auth.admin
      .from("banners")
      .select(
        "id, restaurant_id, title, description, image_url, sort_order, is_active, created_at, updated_at"
      )
      .eq("restaurant_id", auth.staff.restaurant_id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load banners:", error);

      return NextResponse.json(
        { error: "Failed to load promotions" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        restaurantName: auth.restaurant.name,
        banners: banners ?? [],
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error("Promotions GET unexpected error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while loading promotions." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeStaff(true);

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const validated = validateBanner(body);

    if ("error" in validated) {
      return NextResponse.json(
        { error: validated.error },
        { status: 400 }
      );
    }

    const { data, error: insertError } = await auth.admin
      .from("banners")
      .insert({
        ...validated.value,
        restaurant_id: auth.staff.restaurant_id,
        is_active: true,
      })
      .select(
        "id, restaurant_id, title, description, image_url, sort_order, is_active, created_at, updated_at"
      )
      .single();

    if (insertError) {
  console.error(
    "PROMOTIONS CREATE DB ERROR:",
    JSON.stringify(insertError, null, 2)
  );

  return NextResponse.json(
    {
      error: "Failed to create banner",
      diagnostic: {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      },
    },
    { status: 500 }
  );
}

    return NextResponse.json(
      { success: true, bannerId: data.id, banner: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Promotions POST unexpected error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while creating the banner." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorizeStaff(true);

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (
      !isRecord(body) ||
      typeof body.bannerId !== "number" ||
      !Number.isSafeInteger(body.bannerId) ||
      body.bannerId <= 0
    ) {
      return NextResponse.json(
        { error: "Valid bannerId is required" },
        { status: 400 }
      );
    }

    const bannerId = body.bannerId;

    if (body.action === "toggle") {
      if (typeof body.is_active !== "boolean") {
        return NextResponse.json(
          { error: "is_active must be a boolean" },
          { status: 400 }
        );
      }

      const { data, error } = await auth.admin
        .from("banners")
        .update({
          is_active: body.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bannerId)
        .eq("restaurant_id", auth.staff.restaurant_id)
        .select("id, is_active")
        .maybeSingle();

      if (error) {
        console.error("Failed to update banner status:", error);

        return NextResponse.json(
          { error: "Failed to update banner status" },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: "Banner not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, banner: data });
    }

    if (body.action !== "update") {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const validated = validateBanner(body);

    if ("error" in validated) {
      return NextResponse.json(
        { error: validated.error },
        { status: 400 }
      );
    }

    const { data, error } = await auth.admin
      .from("banners")
      .update({
        ...validated.value,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bannerId)
      .eq("restaurant_id", auth.staff.restaurant_id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Failed to update banner:", error);

      return NextResponse.json(
        { error: "Failed to update banner" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Banner not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Promotions PATCH unexpected error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while updating the banner." },
      { status: 500 }
    );
  }
}
