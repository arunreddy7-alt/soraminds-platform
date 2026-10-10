
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // 1. Authenticate the user.
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

    // 2. Verify the staff account.
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

    // 3. Ensure the product belongs to this restaurant.
    const { productId: rawProductId } = await params;
    const productId = Number(rawProductId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "Invalid product ID" },
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

    // 4. Validate the uploaded file.
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image must be between 1 byte and 5 MB" },
        { status: 400 }
      );
    }

    const extension = ALLOWED_TYPES[file.type];

    if (!extension) {
      return NextResponse.json(
        { error: "Only JPEG, PNG and WEBP images are allowed" },
        { status: 400 }
      );
    }

    // Verify file signatures instead of trusting MIME type alone.
    const bytes = new Uint8Array(await file.arrayBuffer());

    const isJpeg =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;

    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;

    const isWebp =
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

    if (
      !(isJpeg && extension === "jpg") &&
      !(isPng && extension === "png") &&
      !(isWebp && extension === "webp")
    ) {
      return NextResponse.json(
        { error: "Image content does not match its file type" },
        { status: 400 }
      );
    }

    // 5. Upload to a product-specific path using server credentials.
    const storagePath =
      `restaurants/${staff.restaurant_id}/products/${productId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from("menu-images")
      .upload(storagePath, bytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Image storage upload failed:", uploadError);

      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = admin.storage
      .from("menu-images")
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      image_url: publicUrlData.publicUrl,
    });
  } catch (error) {
    console.error("Secure image upload failed:", error);

    return NextResponse.json(
      { error: "Image upload failed" },
      { status: 500 }
    );
  }
}
