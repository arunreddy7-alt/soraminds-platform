import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requirePlatformOwner() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: platformUser, error } = await supabase
    .from("platform_users")
    .select("id, is_active, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    error ||
    !platformUser ||
    !platformUser.is_active
  ) {
    return null;
  }

  return platformUser;
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const platformUser = await requirePlatformOwner();

    if (!platformUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const ownerId = Number(id);

    if (!Number.isInteger(ownerId)) {
      return NextResponse.json(
        { error: "Invalid owner ID." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const newPassword = String(
      body.new_password || ""
    );

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: owner, error: ownerError } =
      await admin
        .from("users")
        .select(
          "id, restaurant_id, full_name, email, auth_user_id, is_active, role_id"
        )
        .eq("id", ownerId)
        .eq("role_id", 3)
        .maybeSingle();

    if (ownerError) {
      console.error(
        "Failed to find owner:",
        ownerError
      );

      return NextResponse.json(
        { error: ownerError.message },
        { status: 500 }
      );
    }

    if (!owner) {
      return NextResponse.json(
        { error: "Restaurant owner not found." },
        { status: 404 }
      );
    }

    if (!owner.auth_user_id) {
      return NextResponse.json(
        {
          error:
            "This owner does not have a linked Supabase Auth account.",
        },
        { status: 400 }
      );
    }

    const { error: authError } =
      await admin.auth.admin.updateUserById(
        owner.auth_user_id,
        {
          password: newPassword,
        }
      );

    if (authError) {
      console.error(
        "Failed to reset owner password:",
        authError
      );

      return NextResponse.json(
        {
          error: authError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error(
      "Reset owner password error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to reset owner password.",
      },
      { status: 500 }
    );
  }
}