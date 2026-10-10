
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
    return {
      error: "Active staff account required",
      status: 403 as const,
    };
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
      return {
        error: "Menu management permission required",
        status: 403 as const,
      };
    }
  }

  return { admin, restaurantId: staff.restaurant_id };
}

export async function POST(request: Request) {
  try {
    const auth = await requireMenuManager();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const productId = Number(body.product_id);
    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const price = Number(body.price);
    const mrp =
      body.mrp == null || body.mrp === ""
        ? null
        : Number(body.mrp);

    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !name ||
      !Number.isFinite(price) ||
      price < 0 ||
      (mrp !== null && (!Number.isFinite(mrp) || mrp < 0))
    ) {
      return NextResponse.json(
        { error: "Invalid variant details" },
        { status: 400 }
      );
    }

    const { data: product, error: productError } = await auth.admin
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("restaurant_id", auth.restaurantId)
      .maybeSingle();

    if (productError) {
      return NextResponse.json(
        { error: "Failed to verify product" },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const { data: existingVariants, error: variantsError } =
      await auth.admin
        .from("product_variants")
        .select("sort_order")
        .eq("product_id", productId)
        .order("sort_order", { ascending: false })
        .limit(1);

    if (variantsError) {
      return NextResponse.json(
        { error: "Failed to prepare variant" },
        { status: 500 }
      );
    }

    const sortOrder =
      (existingVariants?.[0]?.sort_order ?? -1) + 1;

    const { data: variant, error: insertError } = await auth.admin
      .from("product_variants")
      
.insert({
  product_id: productId,
  name,
  price,
  mrp,
  sort_order: sortOrder,
  is_available: true,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

      .select()
      .single();

    if (insertError) {
      console.error("Create variant failed:", insertError);
      return NextResponse.json(
        { error: "Failed to create variant" },
        { status: 500 }
      );
    }

    return NextResponse.json({ variant }, { status: 201 });
  } catch (error) {
    console.error("Create variant error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
