import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const MODULES = [
  "dashboard",
  "orders",
  "customers",
  "menu",
  "combos",
  "promotions",
  "coupons",
  "tables",
  "qr_codes",
  "reviews",
  "analytics",
  "reports",
  "staff",
  "settings",
  "inventory",
  "payments",
];

const ACCESS_OPTIONS = ["FULL", "VIEW", "NONE"] as const;

type PermissionAccess = (typeof ACCESS_OPTIONS)[number];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server configuration is missing.");
  }

  return createAdminClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getOwnerContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: currentUser, error: userError } = await supabase
    .from("users")
    .select("id, restaurant_id, role_id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (userError || !currentUser || !currentUser.is_active) {
    return null;
  }

  const admin = getAdminClient();

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("name")
    .eq("id", currentUser.role_id)
    .maybeSingle();

  if (roleError || role?.name !== "OWNER") {
    return null;
  }

  return { currentUser };
}

async function getRoleId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const parsed = Number(id);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getOwnerContext();

    if (!context) {
      return NextResponse.json(
        { error: "Only the restaurant owner can manage permissions." },
        { status: 403 }
      );
    }

    const roleId = await getRoleId(params);

    if (roleId === null) {
      return NextResponse.json(
        { error: "Invalid role ID." },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("id, name")
      .eq("id", roleId)
      .maybeSingle();

    if (roleError) {
      return NextResponse.json(
        { error: roleError.message },
        { status: 500 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: "Role not found." },
        { status: 404 }
      );
    }

    const { data, error } = await admin
      .from("permissions")
      .select("id, role_id, module, access, created_at")
      .eq("role_id", roleId)
      .order("module", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { permissions: data ?? [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Server error.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getOwnerContext();

    if (!context) {
      return NextResponse.json(
        { error: "Only the restaurant owner can manage permissions." },
        { status: 403 }
      );
    }

    const roleId = await getRoleId(params);

    if (roleId === null) {
      return NextResponse.json(
        { error: "Invalid role ID." },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      !Array.isArray(
        (body as { permissions?: unknown }).permissions
      )
    ) {
      return NextResponse.json(
        { error: "A permissions array is required." },
        { status: 400 }
      );
    }

    const submitted = (
      body as {
        permissions: Array<{
          module?: unknown;
          access?: unknown;
        }>;
      }
    ).permissions;

    const submittedModules = new Set<string>();

    for (const item of submitted) {
      if (
        !item ||
        typeof item.module !== "string" ||
        !MODULES.includes(item.module) ||
        typeof item.access !== "string" ||
        !ACCESS_OPTIONS.includes(item.access as PermissionAccess) ||
        submittedModules.has(item.module)
      ) {
        return NextResponse.json(
          { error: "Invalid or duplicate permission entry." },
          { status: 400 }
        );
      }

      submittedModules.add(item.module);
    }

    const admin = getAdminClient();

    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("id, name")
      .eq("id", roleId)
      .maybeSingle();

    if (roleError) {
      return NextResponse.json(
        { error: roleError.message },
        { status: 500 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: "Role not found." },
        { status: 404 }
      );
    }

    if (role.name === "OWNER") {
      return NextResponse.json(
        { error: "Owner permissions are protected." },
        { status: 400 }
      );
    }

    const cleanedPermissions = MODULES.map((module) => {
  const item = submitted.find((p) => p.module === module);

  return {
    role_id: roleId,
    module,
    access: item ? (item.access as PermissionAccess) : "NONE",
    created_at: new Date().toISOString(),
  };
});

    // Requires a unique index on (role_id, module).
    const { data, error } = await admin
      .from("permissions")
      .upsert(cleanedPermissions, {
        onConflict: "role_id,module",
      })
      .select("id, role_id, module, access, created_at");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, permissions: data ?? [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Server error.",
      },
      { status: 500 }
    );
  }
}