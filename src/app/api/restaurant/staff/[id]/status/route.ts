//Staff status update

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

export async function PATCH(
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
    const supabase =
      await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const {
      data: currentUser,
    } = await supabase
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
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const { data: role } =
      await supabase
        .from("roles")
        .select("name")
        .eq("id", currentUser.role_id)
        .maybeSingle();

    if (!role) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    let canManage =
      role.name === "OWNER";

    if (!canManage) {
      const {
        data: permission,
      } = await supabase
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

    if (!canManage) {
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

    const body =
      await request.json();

    const admin =
      getAdminClient();

    const {
      data: member,
    } = await admin
      .from("users")
      .select(
        "id, restaurant_id, role_id, auth_user_id"
      )
      .eq("id", Number(id))
      .eq(
        "restaurant_id",
        currentUser.restaurant_id
      )
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Staff member not found.",
        },
        { status: 404 }
      );
    }

    const { data: memberRole } =
      await admin
        .from("roles")
        .select("name")
        .eq("id", member.role_id)
        .maybeSingle();

    if (
      memberRole?.name === "OWNER"
    ) {
      return NextResponse.json(
        {
          error:
            "Owner status cannot be changed here.",
        },
        { status: 400 }
      );
    }

    const isActive =
      Boolean(
        body.is_active
      );

    const {
      data: updated,
      error,
    } = await admin
      .from("users")
      .update({
        is_active: isActive,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", Number(id))
      .eq(
        "restaurant_id",
        currentUser.restaurant_id
      )
      .select(
        "id, is_active"
      )
      .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
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