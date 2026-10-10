import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ qrId: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function authorizeStaff() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: jsonError("Unauthorized", 401) };
  }

  const admin = createAdminClient();

  const { data: staff, error: staffError } = await admin
    .from("users")
    .select("id, restaurant_id, role_id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (staffError) {
    console.error("QR staff lookup failed:", staffError);
    return { error: jsonError("Unable to verify staff access", 500) };
  }

  if (!staff || !staff.is_active) {
    return { error: jsonError("Staff account is inactive or unavailable", 403) };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, is_active")
    .eq("id", staff.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    console.error("QR restaurant lookup failed:", restaurantError);
    return { error: jsonError("Unable to verify restaurant", 500) };
  }

  if (!restaurant || !restaurant.is_active) {
    return { error: jsonError("Restaurant is inactive or unavailable", 403) };
  }

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("name")
    .eq("id", staff.role_id)
    .maybeSingle();

  if (roleError) {
    console.error("QR role lookup failed:", roleError);
    return { error: jsonError("Unable to verify staff role", 500) };
  }

  if (!role) {
    return { error: jsonError("Staff role is unavailable", 403) };
  }

  if (role.name !== "OWNER") {
    const { data: permission, error: permissionError } = await admin
      .from("permissions")
      .select("access")
      .eq("role_id", staff.role_id)
      .eq("module", "qr_codes")
      .maybeSingle();

    if (permissionError) {
      console.error("QR permission lookup failed:", permissionError);
      return { error: jsonError("Unable to verify QR permissions", 500) };
    }

    if (permission?.access !== "FULL") {
      return {
        error: jsonError("You do not have permission to manage QR codes", 403),
      };
    }
  }

  return {
    admin,
    restaurantId: staff.restaurant_id,
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authorizeStaff();

    if ("error" in auth) {
      return auth.error;
    }

    const { admin, restaurantId } = auth;
    const { qrId: rawQrId } = await context.params;
    const qrId = Number(rawQrId);

    if (!Number.isSafeInteger(qrId) || qrId <= 0) {
      return jsonError("Invalid QR code ID", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid request body", 400);
    }

    const payload = body as Record<string, unknown>;

    // Confirm this QR code belongs to the authenticated staff member's restaurant.
    const { data: existingQR, error: lookupError } = await admin
      .from("qr_codes")
      .select("id, restaurant_id, table_id, code, is_active")
      .eq("id", qrId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (lookupError) {
      console.error("QR lookup failed:", lookupError);
      return jsonError("Unable to retrieve QR code", 500);
    }

    if (!existingQR) {
      return jsonError("QR code not found", 404);
    }

    let updates: Record<string, unknown>;

    if (payload.action === "regenerate") {
      updates = {
        code: crypto.randomUUID().replace(/-/g, ""),
        is_active: true,
        updated_at: new Date().toISOString(),
      };
    } else if (payload.action === "toggle") {
      if (typeof payload.is_active !== "boolean") {
        return jsonError("is_active must be a boolean", 400);
      }

      updates = {
        is_active: payload.is_active,
        updated_at: new Date().toISOString(),
      };
    } else {
      return jsonError("Unsupported action", 400);
    }

    const { data: updatedQR, error: updateError } = await admin
      .from("qr_codes")
      .update(updates)
      .eq("id", qrId)
      .eq("restaurant_id", restaurantId)
      .select("id, restaurant_id, table_id, code, is_active")
      .maybeSingle();

    if (updateError) {
      console.error("QR update failed:", updateError);
      return jsonError("Failed to update QR code", 500);
    }

    if (!updatedQR) {
      return jsonError("QR code could not be updated", 404);
    }

    return NextResponse.json(
      { success: true, qrCode: updatedQR },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("QR PATCH handler failed:", error);
    return jsonError("Internal server error", 500);
  }
}