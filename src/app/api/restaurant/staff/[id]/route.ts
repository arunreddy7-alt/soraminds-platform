//Edit/Delete staff

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function getContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: currentUser } =
    await supabase
      .from("users")
      .select(
        "id, restaurant_id, role_id, is_active"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (
    !currentUser ||
    !currentUser.is_active
  ) {
    return null;
  }

  const { data: role } =
    await supabase
      .from("roles")
      .select("name")
      .eq("id", currentUser.role_id)
      .maybeSingle();

  if (!role) return null;

  let canManage =
    role.name === "OWNER";

  if (!canManage) {
    const { data: permission } =
      await supabase
        .from("permissions")
        .select("access")
        .eq(
          "role_id",
          currentUser.role_id
        )
        .eq(
          "module",
          "staff"
        )
        .maybeSingle();

    canManage =
      permission?.access ===
      "FULL";
  }

  return {
    currentUser,
    canManage,
  };
}

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const context =
      await getContext();

    if (!context) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    if (!context.canManage) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage staff.",
        },
        { status: 403 }
      );
    }

    const { id } =
      await params;

    const staffId =
      Number(id);

    const body =
      await request.json();

    const admin =
      getAdminClient();

    const {
      data: member,
      error: memberError,
    } =
      await admin
        .from("users")
        .select(
          "id, restaurant_id, role_id, auth_user_id, email"
        )
        .eq("id", staffId)
        .eq(
          "restaurant_id",
          context.currentUser
            .restaurant_id
        )
        .maybeSingle();

    if (
      memberError ||
      !member
    ) {
      return NextResponse.json(
        {
          error:
            "Staff member not found.",
        },
        { status: 404 }
      );
    }

    const fullName =
      String(
        body.full_name || ""
      ).trim();

    const email =
      String(
        body.email || ""
      )
        .trim()
        .toLowerCase();

    const phone =
      body.phone || null;

    const roleId =
      Number(body.role_id);

    if (
      !fullName ||
      !email ||
      !roleId
    ) {
      return NextResponse.json(
        {
          error:
            "Name, email and role are required.",
        },
        { status: 400 }
      );
    }

    const {
      data: role,
    } = await admin
      .from("roles")
      .select("id, name")
      .eq("id", roleId)
      .maybeSingle();

    if (!role) {
      return NextResponse.json(
        {
          error:
            "Invalid role.",
        },
        { status: 400 }
      );
    }

    if (
      role.name === "OWNER"
    ) {
      return NextResponse.json(
        {
          error:
            "Owner cannot be assigned through Staff.",
        },
        { status: 400 }
      );
    }

    const {
      data: duplicate,
    } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .neq("id", staffId)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "Another user already uses this email.",
        },
        { status: 409 }
      );
    }

    const updateData: Record<
      string,
      unknown
    > = {
      full_name: fullName,
      email,
      phone,
      role_id: roleId,
      updated_at:
        new Date().toISOString(),
    };

    if (
      body.password &&
      String(body.password).trim()
    ) {
      if (!member.auth_user_id) {
        return NextResponse.json(
          {
            error:
              "This staff member is not linked to Supabase Auth.",
          },
          { status: 400 }
        );
      }

      const {
        error: passwordError,
      } =
        await admin.auth.admin.updateUserById(
          member.auth_user_id,
          {
            password: String(
              body.password
            ),
          }
        );

      if (passwordError) {
        return NextResponse.json(
          {
            error:
              passwordError.message,
          },
          { status: 400 }
        );
      }
    }

    if (
      member.auth_user_id
    ) {
      const {
        error: authUpdateError,
      } =
        await admin.auth.admin.updateUserById(
          member.auth_user_id,
          {
            email,
            user_metadata: {
              full_name:
                fullName,
            },
          }
        );

      if (authUpdateError) {
        return NextResponse.json(
          {
            error:
              authUpdateError.message,
          },
          { status: 400 }
        );
      }
    }

    const {
      data: updated,
      error: updateError,
    } =
      await admin
        .from("users")
        .update(updateData)
        .eq("id", staffId)
        .eq(
          "restaurant_id",
          context.currentUser
            .restaurant_id
        )
        .select(
          "id, restaurant_id, role_id, full_name, email, phone, is_active, auth_user_id"
        )
        .single();

    if (updateError) {
      return NextResponse.json(
        {
          error:
            updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      staff: updated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server error.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const context =
      await getContext();

    if (!context) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    if (!context.canManage) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage staff.",
        },
        { status: 403 }
      );
    }

    const { id } =
      await params;

    const staffId =
      Number(id);

    const admin =
      getAdminClient();

    const {
      data: member,
      error,
    } = await admin
      .from("users")
      .select(
        "id, restaurant_id, role_id, auth_user_id"
      )
      .eq("id", staffId)
      .eq(
        "restaurant_id",
        context.currentUser
          .restaurant_id
      )
      .maybeSingle();

    if (error || !member) {
      return NextResponse.json(
        {
          error:
            "Staff member not found.",
        },
        { status: 404 }
      );
    }

    const {
      data: role,
    } = await admin
      .from("roles")
      .select("name")
      .eq("id", member.role_id)
      .maybeSingle();

    if (
      role?.name === "OWNER"
    ) {
      return NextResponse.json(
        {
          error:
            "The restaurant owner cannot be deleted from Staff.",
        },
        { status: 400 }
      );
    }

    const {
      error: deleteError,
    } = await admin
      .from("users")
      .delete()
      .eq("id", staffId)
      .eq(
        "restaurant_id",
        context.currentUser
          .restaurant_id
      );

    if (deleteError) {
      return NextResponse.json(
        {
          error:
            deleteError.message,
        },
        { status: 500 }
      );
    }

    if (
      member.auth_user_id
    ) {
      const {
        error:
          authDeleteError,
      } =
        await admin.auth.admin.deleteUser(
          member.auth_user_id
        );

      if (authDeleteError) {
        console.error(
          "Auth user deletion failed:",
          authDeleteError
        );
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server error.",
      },
      { status: 500 }
    );
  }
}