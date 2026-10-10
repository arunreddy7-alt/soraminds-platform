
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ variantId: string }> }
) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // 2. Verify active staff account
    const { data: staff, error: staffError } = await admin
      .from("users")
      .select("id, restaurant_id, role_id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (staffError) {
      console.error("Staff verification failed:", staffError);

      return NextResponse.json(
        { error: "Unable to verify staff account" },
        { status: 500 }
      );
    }

    if (!staff || !staff.is_active || !staff.restaurant_id) {
      return NextResponse.json(
        { error: "Active staff account required" },
        { status: 403 }
      );
    }

    // 3. Verify active restaurant
    const { data: restaurant, error: restaurantError } =
      await admin
        .from("restaurants")
        .select("id, is_active")
        .eq("id", staff.restaurant_id)
        .maybeSingle();

    if (restaurantError) {
      console.error(
        "Restaurant verification failed:",
        restaurantError
      );

      return NextResponse.json(
        { error: "Unable to verify restaurant" },
        { status: 500 }
      );
    }

    if (!restaurant || !restaurant.is_active) {
      return NextResponse.json(
        { error: "Restaurant is inactive" },
        { status: 403 }
      );
    }

    // 4. Verify role
    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("name")
      .eq("id", staff.role_id)
      .maybeSingle();

    if (roleError) {
      console.error("Role verification failed:", roleError);

      return NextResponse.json(
        { error: "Unable to verify staff role" },
        { status: 500 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: "Invalid staff role" },
        { status: 403 }
      );
    }

    // 5. Check menu management permission
    if (role.name !== "OWNER") {
      const { data: permission, error: permissionError } =
        await admin
          .from("permissions")
          .select("access")
          .eq("role_id", staff.role_id)
          .eq("module", "menu")
          .maybeSingle();

      if (permissionError) {
        console.error(
          "Menu permission lookup failed:",
          permissionError
        );

        return NextResponse.json(
          { error: "Unable to verify menu permissions" },
          { status: 500 }
        );
      }

      if (!permission || permission.access !== "FULL") {
        return NextResponse.json(
          { error: "Menu management permission required" },
          { status: 403 }
        );
      }
    }

    // 6. Validate variant ID
    const { variantId: rawVariantId } = await params;
    const variantId = Number(rawVariantId);

    if (
      !Number.isSafeInteger(variantId) ||
      variantId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid variant ID" },
        { status: 400 }
      );
    }

    // 7. Find variant
    const { data: variant, error: variantError } = await admin
      .from("product_variants")
      .select("id, product_id")
      .eq("id", variantId)
      .maybeSingle();

    if (variantError) {
      console.error(
        "Variant verification failed:",
        variantError
      );

      return NextResponse.json(
        { error: "Failed to verify variant" },
        { status: 500 }
      );
    }

    if (!variant) {
      return NextResponse.json(
        { error: "Variant not found" },
        { status: 404 }
      );
    }

    // 8. Verify the parent product belongs to this restaurant
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id")
      .eq("id", variant.product_id)
      .eq("restaurant_id", staff.restaurant_id)
      .maybeSingle();

    if (productError) {
      console.error(
        "Product ownership verification failed:",
        productError
      );

      return NextResponse.json(
        { error: "Failed to verify product ownership" },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        { error: "Variant not found" },
        { status: 404 }
      );
    }

    // 9. Delete only the verified variant of the verified product
    const { data: deletedVariant, error: deleteError } =
      await admin
        .from("product_variants")
        .delete()
        .eq("id", variantId)
        .eq("product_id", product.id)
        .select("id")
        .maybeSingle();

    if (deleteError) {
      console.error("Variant deletion failed:", deleteError);

      return NextResponse.json(
        { error: "Failed to delete variant" },
        { status: 500 }
      );
    }

    if (!deletedVariant) {
      return NextResponse.json(
        { error: "Variant not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete variant error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
