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

    const newOwnerName = String(
      body.new_owner_full_name || ""
    ).trim();

    const newOwnerEmail = String(
      body.new_owner_email || ""
    )
      .trim()
      .toLowerCase();

    const newOwnerPassword = String(
      body.new_owner_password || ""
    );

    if (newOwnerName.length < 2) {
      return NextResponse.json(
        {
          error:
            "Owner name must be at least 2 characters.",
        },
        { status: 400 }
      );
    }

    if (!newOwnerEmail) {
      return NextResponse.json(
        {
          error: "Owner email is required.",
        },
        { status: 400 }
      );
    }

    if (newOwnerPassword.length < 8) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: currentOwner, error: ownerError } =
      await admin
        .from("users")
        .select(
          "id, restaurant_id, full_name, email, phone, auth_user_id, is_active, role_id"
        )
        .eq("id", ownerId)
        .eq("role_id", 3)
        .maybeSingle();

    if (ownerError) {
      console.error(
        "Failed to load current owner:",
        ownerError
      );

      return NextResponse.json(
        { error: ownerError.message },
        { status: 500 }
      );
    }

    if (!currentOwner) {
      return NextResponse.json(
        {
          error: "Restaurant owner not found.",
        },
        { status: 404 }
      );
    }

    const { data: existingUser } = await admin
      .from("users")
      .select("id, email")
      .eq("email", newOwnerEmail)
      .maybeSingle();

    if (
      existingUser &&
      existingUser.id !== currentOwner.id
    ) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    const {
      data: existingAuthUsers,
      error: authListError,
    } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authListError) {
      return NextResponse.json(
        {
          error: authListError.message,
        },
        { status: 500 }
      );
    }

    const emailAlreadyExists =
      existingAuthUsers.users.some(
        (authUser) =>
          authUser.email?.toLowerCase() ===
            newOwnerEmail &&
          authUser.id !== currentOwner.auth_user_id
      );

    if (emailAlreadyExists) {
      return NextResponse.json(
        {
          error:
            "A Supabase Auth account with this email already exists.",
        },
        { status: 409 }
      );
    }

    /*
     * Create the new Supabase Auth account first.
     */
    const {
      data: authData,
      error: authError,
    } = await admin.auth.admin.createUser({
      email: newOwnerEmail,
      password: newOwnerPassword,
      email_confirm: true,
      user_metadata: {
        full_name: newOwnerName,
        restaurant_id:
          currentOwner.restaurant_id,
        role: "OWNER",
      },
    });

    if (authError || !authData.user) {
      console.error(
        "Failed to create new owner Auth account:",
        authError
      );

      return NextResponse.json(
        {
          error:
            authError?.message ||
            "Failed to create new owner account.",
        },
        { status: 500 }
      );
    }

    /*
     * Update the restaurant owner record.
     */
    const { data: updatedOwner, error: updateError } =
      await admin
        .from("users")
        .update({
          full_name: newOwnerName,
          email: newOwnerEmail,
          auth_user_id: authData.user.id,
          password_hash: "SUPABASE_AUTH",
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentOwner.id)
        .select(
          "id, restaurant_id, full_name, email, phone, is_active, auth_user_id, role_id"
        )
        .single();

    if (updateError || !updatedOwner) {
      /*
       * Roll back the Auth account if DB update fails.
       */
      await admin.auth.admin.deleteUser(
        authData.user.id
      );

      console.error(
        "Failed to update owner record:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            updateError?.message ||
            "Failed to update restaurant owner.",
        },
        { status: 500 }
      );
    }

    /*
     * Remove the old Auth account after the new
     * owner has been successfully linked.
     */
    if (
      currentOwner.auth_user_id &&
      currentOwner.auth_user_id !==
        authData.user.id
    ) {
      const { error: deleteOldAuthError } =
        await admin.auth.admin.deleteUser(
          currentOwner.auth_user_id
        );

      if (deleteOldAuthError) {
        console.error(
          "New owner created, but old Auth account could not be deleted:",
          deleteOldAuthError
        );
      }
    }

    return NextResponse.json({
      message:
        "Restaurant owner changed successfully.",
      owner: updatedOwner,
    });
  } catch (error) {
    console.error(
      "Change restaurant owner error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to change restaurant owner.",
      },
      { status: 500 }
    );
  }
}