
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const TYPES: Record<string, { ext: string; type: string }> = {
  "image/jpeg": { ext: "jpg", type: "image/jpeg" },
  "image/png": { ext: "png", type: "image/png" },
  "image/webp": { ext: "webp", type: "image/webp" },
};

export async function POST(request: Request) {
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

    const imageType = TYPES[file.type];

    if (!imageType) {
      return NextResponse.json(
        { error: "Only JPEG, PNG and WEBP images are allowed" },
        { status: 400 }
      );
    }

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
      !(imageType.ext === "jpg" && isJpeg) &&
      !(imageType.ext === "png" && isPng) &&
      !(imageType.ext === "webp" && isWebp)
    ) {
      return NextResponse.json(
        { error: "Image content does not match its file type" },
        { status: 400 }
      );
    }

    const storagePath =
      `restaurants/${staff.restaurant_id}/bulk-import/${crypto.randomUUID()}.${imageType.ext}`;

    const { error: uploadError } = await admin.storage
      .from("menu-images")
      .upload(storagePath, bytes, {
        contentType: imageType.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Bulk image upload failed:", uploadError);

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
    console.error("Bulk image upload error:", error);

    return NextResponse.json(
      { error: "Image upload failed" },
      { status: 500 }
    );
  }
}
