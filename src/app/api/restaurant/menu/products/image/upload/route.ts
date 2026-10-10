
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // Authenticate the logged-in user
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

    // Find the restaurant staff account
    const { data: staff, error: staffError } = await admin
      .from("users")
      .select("id, restaurant_id, role_id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (staffError || !staff || !staff.is_active) {
      return NextResponse.json(
        { error: "Active staff account not found" },
        { status: 403 }
      );
    }

    // Verify the restaurant is active
    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .select("id, is_active")
      .eq("id", staff.restaurant_id)
      .maybeSingle();

    if (
      restaurantError ||
      !restaurant ||
      restaurant.is_active !== true
    ) {
      return NextResponse.json(
        { error: "Restaurant is inactive or unavailable" },
        { status: 403 }
      );
    }

    // Verify the user's role
    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("name")
      .eq("id", staff.role_id)
      .maybeSingle();

    if (roleError || !role) {
      return NextResponse.json(
        { error: "User role not found" },
        { status: 403 }
      );
    }

    // Only OWNER or staff with FULL menu access can upload images
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
        return NextResponse.json(
          { error: "You do not have permission to upload menu images" },
          { status: 403 }
        );
      }
    }

    // Validate the uploaded file
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Please select an image" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image must be 5 MB or smaller" },
        { status: 400 }
      );
    }

    // Upload to the restaurant's own storage folder
    const extension =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : "webp";

    const fileName = `${crypto.randomUUID()}.${extension}`;
    const storagePath = `${staff.restaurant_id}/${fileName}`;

    const { error: uploadError } = await admin.storage
      .from("menu-images")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Menu image upload failed:", uploadError.message);

      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = admin.storage
      .from("menu-images")
      .getPublicUrl(storagePath);

    return NextResponse.json(
      { image_url: publicUrlData.publicUrl },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Menu image upload error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
