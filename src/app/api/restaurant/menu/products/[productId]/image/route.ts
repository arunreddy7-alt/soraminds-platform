
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
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

    const { data: staff, error: staffError } = await admin
      .from("users")
      .select("id, restaurant_id, role_id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (staffError || !staff || !staff.is_active) {
      return NextResponse.json(
        { error: "Active staff account required" },
        { status: 403 }
      );
    }

    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .select("id, is_active")
      .eq("id", staff.restaurant_id)
      .maybeSingle();

    if (restaurantError || !restaurant || !restaurant.is_active) {
      return NextResponse.json(
        { error: "Restaurant is inactive" },
        { status: 403 }
      );
    }

    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("name")
      .eq("id", staff.role_id)
      .maybeSingle();

    if (roleError || !role) {
      return NextResponse.json(
        { error: "Invalid staff role" },
        { status: 403 }
      );
    }

    if (role.name !== "OWNER") {
      const { data: permission, error: permissionError } =
        await admin
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
        return NextResponse.json(
          { error: "Menu management permission required" },
          { status: 403 }
        );
      }
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
    const imageUrl = body.image_url;

    if (
      typeof imageUrl !== "string" ||
      !imageUrl.trim() ||
      imageUrl.length > 2048
    ) {
      return NextResponse.json(
        { error: "A valid image URL is required" },
        { status: 400 }
      );
    }

    // Only allow images from the configured public menu-images bucket.
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid image URL" },
        { status: 400 }
      );
    }

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("restaurant_id", staff.restaurant_id)
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

    const { data: storageConfig, error: configError } =
      await admin.storage.getBucket("menu-images");

    if (configError || !storageConfig) {
      return NextResponse.json(
        { error: "Menu image storage is unavailable" },
        { status: 500 }
      );
    }

    // Match the configured Supabase project host.
    const { data: projectUrl } = await admin
      .from("restaurants")
      .select("id")
      .eq("id", staff.restaurant_id)
      .maybeSingle();

    // Validate the URL against the actual Supabase project URL
    // using the project's configured environment variable.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Storage configuration is missing" },
        { status: 500 }
      );
    }

    const expectedOrigin = new URL(supabaseUrl).origin;

    const expectedPathPrefix =
      `/storage/v1/object/public/menu-images/restaurants/${staff.restaurant_id}/products/${productId}/`;

    if (
      parsedUrl.origin !== expectedOrigin ||
      !parsedUrl.pathname.startsWith(expectedPathPrefix)
    ) {
      return NextResponse.json(
        { error: "Image must belong to this product's menu image folder" },
        { status: 400 }
      );
    }

    const { error: updateError } = await admin
      .from("products")
      .update({
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("restaurant_id", staff.restaurant_id);

    if (updateError) {
      console.error("Update product image failed:", updateError);

      return NextResponse.json(
        { error: "Failed to update product image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update product image error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
