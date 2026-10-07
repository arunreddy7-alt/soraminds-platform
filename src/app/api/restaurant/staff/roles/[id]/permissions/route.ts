// role permissions management for staff

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const MODULES = [
  "orders",
  "menu",
  "coupons",
  "tables",
  "reports",
  "staff",
  "promotions",
  "reviews",
  "qr_codes",
];

const ACCESS_OPTIONS = [
  "FULL",
  "VIEW",
  "NONE",
];

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

async function getOwnerContext() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

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
    return null;
  }

  const { data: role } =
    await supabase
      .from("roles")
      .select("name")
      .eq("id", currentUser.role_id)
      .maybeSingle();

  if (
    !role ||
    role.name !== "OWNER"
  ) {
    return null;
  }

  return {
    currentUser,
  };
}

export async function GET(
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
      await getOwnerContext();

    if (!context) {
      return NextResponse.json(
        {
          error:
            "Only the restaurant owner can manage permissions.",
        },
        { status: 403 }
      );
    }

    const { id } =
      await params;

    const roleId =
      Number(id);

    const admin =
      getAdminClient();

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
            "Role not found.",
        },
        { status: 404 }
      );
    }

    const {
      data,
      error,
    } = await admin
      .from("permissions")
      .select(
        "id, role_id, module, access, created_at"
      )
      .eq("role_id", roleId)
      .order("module", {
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

    return NextResponse.json({
      permissions: data || [],
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
      await getOwnerContext();

    if (!context) {
      return NextResponse.json(
        {
          error:
            "Only the restaurant owner can manage permissions.",
        },
        { status: 403 }
      );
    }

    const { id } =
      await params;

    const roleId =
      Number(id);

    const body =
      await request.json();

    const permissions =
      Array.isArray(
        body.permissions
      )
        ? body.permissions
        : [];

    const admin =
      getAdminClient();

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
            "Role not found.",
        },
        { status: 404 }
      );
    }

    if (
      role.name === "OWNER"
    ) {
      return NextResponse.json(
        {
          error:
            "Owner permissions are protected.",
        },
        { status: 400 }
      );
    }

    const cleanedPermissions =
      MODULES.map(
        (module) => {
          const item =
            permissions.find(
              (permission: any) =>
                permission.module ===
                module
            );

          const access =
            ACCESS_OPTIONS.includes(
              item?.access
            )
              ? item.access
              : "NONE";

          return {
            role_id: roleId,
            module,
            access,
            created_at:
              new Date().toISOString(),
          };
        }
      );

    const {
      error: deleteError,
    } = await admin
      .from("permissions")
      .delete()
      .eq("role_id", roleId);

    if (deleteError) {
      return NextResponse.json(
        {
          error:
            deleteError.message,
        },
        { status: 500 }
      );
    }

    const {
      data,
      error,
    } = await admin
      .from("permissions")
      .insert(
        cleanedPermissions
      )
      .select(
        "id, role_id, module, access, created_at"
      );

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
      permissions:
        data || [],
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