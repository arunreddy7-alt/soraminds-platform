//list/create

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

async function getRestaurantContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

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
    !currentUser.restaurant_id ||
    !currentUser.is_active
  ) {
    return null;
  }

  const { data: role } =
    await supabase
      .from("roles")
      .select("id, name")
      .eq("id", currentUser.role_id)
      .maybeSingle();

  if (!role) {
    return null;
  }

  if (role.name === "OWNER") {
    return {
      user,
      currentUser,
      role,
      canManage: true,
    };
  }

  const { data: permission } =
    await supabase
      .from("permissions")
      .select("access")
      .eq(
        "role_id",
        currentUser.role_id
      )
      .eq("module", "staff")
      .maybeSingle();

  return {
    user,
    currentUser,
    role,
    canManage:
      permission?.access === "FULL",
  };
}

export async function GET() {
  try {
    const context =
      await getRestaurantContext();

    if (!context) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const admin =
      getAdminClient();

    const { data, error } =
      await admin
        .from("users")
        .select(
          `
          id,
          restaurant_id,
          role_id,
          full_name,
          email,
          phone,
          is_active,
          created_at,
          roles!inner(name)
        `
        )
        .eq(
          "restaurant_id",
          context.currentUser
            .restaurant_id
        )
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        { status: 500 }
      );
    }

    const staff =
      (data || []).map(
        (member: any) => ({
          id: member.id,
          restaurant_id:
            member.restaurant_id,
          role_id: member.role_id,
          full_name:
            member.full_name,
          email: member.email,
          phone: member.phone,
          is_active:
            member.is_active,
          created_at:
            member.created_at,
          role_name:
            member.roles?.name ||
            "Unknown",
        })
      );

    return NextResponse.json({
      staff,
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

export async function POST(
  request: Request
) {
  try {
    const context =
      await getRestaurantContext();

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

    const body =
      await request.json();

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

    const password =
      String(
        body.password || ""
      );

    const roleId =
      Number(body.role_id);

    if (
      !fullName ||
      !email ||
      !password ||
      !roleId
    ) {
      return NextResponse.json(
        {
          error:
            "Name, email, password and role are required.",
        },
        { status: 400 }
      );
    }

    const admin =
      getAdminClient();

    const {
      data: role,
      error: roleError,
    } = await admin
      .from("roles")
      .select("id, name")
      .eq("id", roleId)
      .maybeSingle();

    if (
      roleError ||
      !role
    ) {
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
            "A restaurant owner cannot be created from Staff.",
        },
        { status: 400 }
      );
    }

    const {
      data: existingUser,
    } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "A user with this email already exists.",
        },
        { status: 409 }
      );
    }

    const {
      data: authData,
      error: authError,
    } =
      await admin.auth.admin.createUser(
        {
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name:
              fullName,
          },
        }
      );

    if (
      authError ||
      !authData.user
    ) {
      return NextResponse.json(
        {
          error:
            authError?.message ||
            "Unable to create authentication account.",
        },
        { status: 400 }
      );
    }

    const {
      data: staffMember,
      error: staffError,
    } = await admin
      .from("users")
      .insert({
        restaurant_id:
          context.currentUser
            .restaurant_id,
        role_id: roleId,
        full_name: fullName,
        email,
        phone,
        password_hash:
          "SUPABASE_AUTH",
        is_active: true,
        auth_user_id:
          authData.user.id,
      })
      .select(
        "id, restaurant_id, role_id, full_name, email, phone, is_active, auth_user_id"
      )
      .single();

    if (staffError) {
      await admin.auth.admin.deleteUser(
        authData.user.id
      );

      return NextResponse.json(
        {
          error:
            staffError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        staff: staffMember,
      },
      { status: 201 }
    );
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