
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    // Verify the signed-in Supabase user.
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

    // Use the admin client only on the server.
    const admin = createAdminClient();

    const { data: staff, error: staffError } =
      await admin
        .from("users")
        .select("id, restaurant_id, role_id, is_active")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (staffError) {
      console.error("Restaurant staff lookup failed:", staffError);

      return NextResponse.json(
        { error: "Unable to verify restaurant access" },
        { status: 500 }
      );
    }

    if (!staff) {
  console.error(
    "[restaurant/me] No staff record for authenticated user:",
    user.id
  );

  return NextResponse.json(
    { error: "No restaurant staff record found" },
    { status: 403 }
  );
}

if (!staff.is_active) {
  console.error(
    "[restaurant/me] Staff account is inactive:",
    staff.id
  );

  return NextResponse.json(
    { error: "Staff account is inactive" },
    { status: 403 }
  );
}

if (!staff.restaurant_id) {
  console.error(
    "[restaurant/me] Staff record has no restaurant:",
    staff.id
  );

  return NextResponse.json(
    { error: "Staff account has no restaurant assigned" },
    { status: 403 }
  );
}

    const { data: restaurant, error: restaurantError } =
      await admin
        .from("restaurants")
        .select("id, is_active")
        .eq("id", staff.restaurant_id)
        .maybeSingle();

    if (restaurantError) {
      console.error("Restaurant lookup failed:", restaurantError);

      return NextResponse.json(
        { error: "Unable to verify restaurant" },
        { status: 500 }
      );
    }

    // Restaurant check
if (!restaurant || !restaurant.is_active) {
  console.error(
    "[restaurant/me] Restaurant missing or inactive:",
    staff.restaurant_id
  );

  return NextResponse.json(
    { error: "Restaurant is missing or inactive" },
    { status: 403 }
  );
}

    const { data: role, error: roleError } =
      await admin
        .from("roles")
        .select("id, name")
        .eq("id", staff.role_id)
        .maybeSingle();

    if (roleError) {
      console.error("Role lookup failed:", roleError);

      return NextResponse.json(
        { error: "Unable to verify staff role" },
        { status: 500 }
      );
    }

    // Role check
if (!role) {
  console.error(
    "[restaurant/me] Role not found:",
    staff.role_id
  );

  return NextResponse.json(
    { error: "Staff role not found" },
    { status: 403 }
  );
}

    let permissions: {
      module: string;
      access: string;
    }[] = [];

    if (role.name !== "OWNER") {
      const { data, error: permissionError } =
        await admin
          .from("permissions")
          .select("module, access")
          .eq("role_id", staff.role_id);

      if (permissionError) {
        console.error(
          "Permission lookup failed:",
          permissionError
        );

        return NextResponse.json(
          { error: "Unable to load permissions" },
          { status: 500 }
        );
      }

      permissions = data ?? [];
    }

    // Return only the information required by the layout.
    return NextResponse.json(
      {
        staff: {
          id: staff.id,
          restaurant_id: staff.restaurant_id,
          role_id: staff.role_id,
        },
        restaurant,
        role,
        permissions,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Restaurant session lookup failed:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
