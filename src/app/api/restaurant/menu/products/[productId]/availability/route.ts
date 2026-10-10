
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireMenuManager() {
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

  if (staffError || !staff || !staff.is_active) {
    return { error: "Active staff account required", status: 403 as const };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, is_active")
    .eq("id", staff.restaurant_id)
    .maybeSingle();

  if (restaurantError || !restaurant || !restaurant.is_active) {
    return { error: "Restaurant is inactive", status: 403 as const };
  }

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("name")
    .eq("id", staff.role_id)
    .maybeSingle();

  if (roleError || !role) {
    return { error: "Invalid staff role", status: 403 as const };
  }

  if (role.name !== "OWNER") {
    const { data: permission, error: permissionError } = await admin
      .from("permissions")
      .select("access")
      .eq("role_id", staff.role_id)
      .eq("module", "menu")
      .maybeSingle();

    if (
      permissionError ||
      !permission ||
      permission.access !== "FULL"
    ) {
      return { error: "Menu management permission required", status: 403 as const };
    }
  }

  return { admin, restaurantId: staff.restaurant_id };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const auth = await requireMenuManager();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { productId: rawProductId } = await params;
    const productId = Number(rawProductId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "Invalid product ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (typeof body.is_available !== "boolean") {
      return NextResponse.json(
        { error: "is_available must be a boolean" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.admin
      .from("products")
      .update({
        is_available: body.is_available,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("restaurant_id", auth.restaurantId)
      .select("id, is_available")
      .maybeSingle();

    if (error) {
      console.error("Update product availability failed:", error);
      return NextResponse.json(
        { error: "Failed to update product availability" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ product: data });
  } catch (error) {
    console.error("Product availability error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
