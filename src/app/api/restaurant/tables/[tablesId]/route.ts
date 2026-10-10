
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function authorizeStaff() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized. Please sign in again." },
        { status: 401 }
      ),
    };
  }

  const admin = createAdminClient();

  const { data: staff, error: staffError } = await admin
    .from("users")
    .select("id, restaurant_id, role_id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (staffError) {
    console.error("Tables staff lookup failed:", staffError);
    return {
      error: NextResponse.json(
        { error: "Unable to verify staff account." },
        { status: 500 }
      ),
    };
  }

  if (!staff || !staff.is_active || !staff.restaurant_id) {
    return {
      error: NextResponse.json(
        { error: "Active restaurant staff account required." },
        { status: 403 }
      ),
    };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, is_active")
    .eq("id", staff.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    console.error("Tables restaurant lookup failed:", restaurantError);
    return {
      error: NextResponse.json(
        { error: "Unable to verify restaurant." },
        { status: 500 }
      ),
    };
  }

  if (!restaurant || !restaurant.is_active) {
    return {
      error: NextResponse.json(
        { error: "Restaurant is inactive." },
        { status: 403 }
      ),
    };
  }

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("name")
    .eq("id", staff.role_id)
    .maybeSingle();

  if (roleError) {
    console.error("Tables role lookup failed:", roleError);
    return {
      error: NextResponse.json(
        { error: "Unable to verify staff role." },
        { status: 500 }
      ),
    };
  }

  if (!role) {
    return {
      error: NextResponse.json(
        { error: "Staff role is invalid." },
        { status: 403 }
      ),
    };
  }

  const isOwner = role.name?.toUpperCase() === "OWNER";

  if (!isOwner) {
    const { data: permission, error: permissionError } = await admin
      .from("permissions")
      .select("access")
      .eq("role_id", staff.role_id)
      .eq("module", "tables")
      .maybeSingle();

    if (permissionError) {
      console.error("Tables permission lookup failed:", permissionError);
      return {
        error: NextResponse.json(
          { error: "Unable to verify permissions." },
          { status: 500 }
        ),
      };
    }

    if (permission?.access?.toUpperCase() !== "FULL") {
      return {
        error: NextResponse.json(
          { error: "Full table-management permission is required." },
          { status: 403 }
        ),
      };
    }
  }

  return { admin, restaurantId: staff.restaurant_id };
}

type RouteContext = {
  params: Promise<{ tablesId: string }>;
};
async function getTableId(context: RouteContext) {
  const { tablesId } = await context.params;



  if (!/^[1-9]\d*$/.test(tablesId)) {
    return null;
  }

  const id = Number(tablesId);

  return Number.isSafeInteger(id) ? id : null;
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await authorizeStaff();
    if ("error" in auth) return auth.error;

    const tableId = await getTableId(context);

    if (tableId === null) {
      return NextResponse.json(
        { error: "Invalid table ID." },
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

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const updates: Record<string, string | number> = {};

    if ("table_number" in input) {
      if (typeof input.table_number !== "string") {
        return NextResponse.json(
          { error: "Table number must be text." },
          { status: 400 }
        );
      }

      const tableNumber = input.table_number.trim();

      if (!tableNumber || tableNumber.length > 50) {
        return NextResponse.json(
          { error: "Table number must be between 1 and 50 characters." },
          { status: 400 }
        );
      }

      updates.table_number = tableNumber;
    }

    if ("seats" in input) {
      if (
        typeof input.seats !== "number" ||
        !Number.isSafeInteger(input.seats) ||
        input.seats < 1 ||
        input.seats > 100
      ) {
        return NextResponse.json(
          { error: "Seats must be a whole number between 1 and 100." },
          { status: 400 }
        );
      }

      updates.seats = input.seats;
    }

    if ("status" in input) {
      if (
        typeof input.status !== "string" ||
        !["FREE", "OCCUPIED", "RESERVED"].includes(input.status)
      ) {
        return NextResponse.json(
          { error: "Invalid table status." },
          { status: 400 }
        );
      }

      updates.status = input.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid table changes provided." },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await auth.admin
      .from("tables")
      .update(updates)
      .eq("id", tableId)
      .eq("restaurant_id", auth.restaurantId)
      .select(
        "id, restaurant_id, table_number, seats, status, created_at, updated_at"
      )
      .maybeSingle();

    if (error) {
      console.error("Tables PATCH failed:", error);
      return NextResponse.json(
        { error: "Unable to update table." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Table not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ table: data });
  } catch (error) {
    console.error("Unexpected tables PATCH error:", error);
    return NextResponse.json(
      { error: "Unexpected error while updating table." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const auth = await authorizeStaff();
    if ("error" in auth) return auth.error;

    const tableId = await getTableId(context);

    if (tableId === null) {
      return NextResponse.json(
        { error: "Invalid table ID." },
        { status: 400 }
      );
    }

    const { data, error } = await auth.admin
      .from("tables")
      .delete()
      .eq("id", tableId)
      .eq("restaurant_id", auth.restaurantId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Tables DELETE failed:", error);
      return NextResponse.json(
        { error: "Unable to delete table. It may be linked to an active session or existing records." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Table not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected tables DELETE error:", error);
    return NextResponse.json(
      { error: "Unexpected error while deleting table." },
      { status: 500 }
    );
  }
}