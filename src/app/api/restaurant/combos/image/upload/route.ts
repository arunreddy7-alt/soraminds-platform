
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function detectImageType(buffer: Buffer): string | null {
  // JPEG
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return "image/png";
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const { data: staff, error: staffError } = await admin
      .from("users")
      .select("id, restaurant_id, role_id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (staffError) {
      console.error("Combo image staff lookup failed:", staffError);

      return NextResponse.json(
        { error: "Unable to verify staff account." },
        { status: 500 }
      );
    }

    if (!staff || !staff.is_active || !staff.restaurant_id) {
      return NextResponse.json(
        { error: "Active staff account required." },
        { status: 403 }
      );
    }

    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .select("id, is_active")
      .eq("id", staff.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      console.error("Combo image restaurant lookup failed:", restaurantError);

      return NextResponse.json(
        { error: "Unable to verify restaurant." },
        { status: 500 }
      );
    }

    if (!restaurant || !restaurant.is_active) {
      return NextResponse.json(
        { error: "Restaurant is inactive." },
        { status: 403 }
      );
    }

    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("name")
      .eq("id", staff.role_id)
      .maybeSingle();

    if (roleError) {
      console.error("Combo image role lookup failed:", roleError);

      return NextResponse.json(
        { error: "Unable to verify staff role." },
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
        .eq("module", "combos")
        .maybeSingle();

      if (permissionError) {
        console.error(
          "Combo image permission lookup failed:",
          permissionError
        );

        return NextResponse.json(
          { error: "Unable to verify permissions." },
          { status: 500 }
        );
      }

      if (permission?.access !== "FULL") {
        return NextResponse.json(
          { error: "Full combo management permission required." },
          { status: 403 }
        );
      }
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid multipart form data." },
        { status: 400 }
      );
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select an image file." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image must be larger than 0 bytes and no bigger than 5 MB." },
        { status: 400 }
      );
    }

    const extension = MIME_EXTENSIONS[file.type];

    if (!extension) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are supported." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const detectedType = detectImageType(buffer);

    if (!detectedType || detectedType !== file.type) {
      return NextResponse.json(
        { error: "The image content does not match its file type." },
        { status: 400 }
      );
    }

    const filePath = `combos/${staff.restaurant_id}/${randomUUID()}.${extension}`;

    const { data: uploadedFile, error: uploadError } = await admin.storage
      .from("menu-images")
      .upload(filePath, buffer, {
        contentType: detectedType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError || !uploadedFile) {
      console.error("Combo image upload failed:", uploadError);

      return NextResponse.json(
        { error: "Failed to upload combo image." },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = admin.storage
      .from("menu-images")
      .getPublicUrl(uploadedFile.path);

    return NextResponse.json(
      {
        success: true,
        image_url: publicUrlData.publicUrl,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Unexpected combo image upload error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while uploading the image." },
      { status: 500 }
    );
  }
}