import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";


const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AllowedMimeType = keyof typeof ALLOWED_TYPES;

function isAllowedType(type: string): type is AllowedMimeType {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, type);
}

async function hasValidSignature(
  file: File,
  type: AllowedMimeType
): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (type === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (type === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }

  return false;
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate the user.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // 2. Find the authenticated staff account.
    const { data: staff, error: staffError } = await admin
      .from("users")
      .select("id, restaurant_id, role_id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (staffError) {
      console.error("Promotion upload staff lookup failed:", staffError);
      return NextResponse.json(
        { error: "Failed to verify staff account." },
        { status: 500 }
      );
    }

    if (!staff || !staff.is_active) {
      return NextResponse.json(
        { error: "Staff account is inactive or not found." },
        { status: 403 }
      );
    }

    // 3. Verify the restaurant is active.
    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .select("id, is_active")
      .eq("id", staff.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      console.error("Promotion upload restaurant lookup failed:", restaurantError);
      return NextResponse.json(
        { error: "Failed to verify restaurant." },
        { status: 500 }
      );
    }

    if (!restaurant || !restaurant.is_active) {
      return NextResponse.json(
        { error: "Restaurant is inactive or not found." },
        { status: 403 }
      );
    }

    // 4. OWNER bypass; other roles require promotions FULL access.
    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("name")
      .eq("id", staff.role_id)
      .maybeSingle();

    if (roleError) {
      console.error("Promotion upload role lookup failed:", roleError);
      return NextResponse.json(
        { error: "Failed to verify staff role." },
        { status: 500 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: "Staff role not found." },
        { status: 403 }
      );
    }

    if (role.name !== "OWNER") {
      const { data: permission, error: permissionError } = await admin
        .from("permissions")
        .select("access")
        .eq("role_id", staff.role_id)
        .eq("module", "promotions")
        .maybeSingle();

      if (permissionError) {
        console.error("Promotion upload permission lookup failed:", permissionError);
        return NextResponse.json(
          { error: "Failed to verify permissions." },
          { status: 500 }
        );
      }

      if (permission?.access !== "FULL") {
        return NextResponse.json(
          { error: "You do not have permission to upload banner images." },
          { status: 403 }
        );
      }
    }

    // 5. Validate the uploaded file.
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Please select an image file." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image size must not exceed 5 MB." },
        { status: 400 }
      );
    }

    if (!isAllowedType(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed." },
        { status: 400 }
      );
    }

    if (!(await hasValidSignature(file, file.type))) {
      return NextResponse.json(
        { error: "The uploaded file does not match its image type." },
        { status: 400 }
      );
    }

    // 6. Upload using the server-side admin client.
    const extension = ALLOWED_TYPES[file.type];
    const filePath =
      `banners/${staff.restaurant_id}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from("menu-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Banner image upload failed:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload banner image." },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = admin.storage
      .from("menu-images")
      .getPublicUrl(filePath);

    return NextResponse.json(
      {
        success: true,
        image_url: publicUrlData.publicUrl,
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error("Promotion image upload error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while uploading the image." },
      { status: 500 }
    );
  }
}