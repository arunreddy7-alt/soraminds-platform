import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type StaffContext = {
  id: number;
  restaurant_id: number;
  role_id: number;
};

async function authorizeStaff(requireFullAccess = false) {
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

    const access = permission?.access?.toUpperCase();

    const allowed = requireFullAccess
      ? access === "FULL"
      : access === "FULL" || access === "VIEW";

    if (!allowed) {
      return {
        error: NextResponse.json(
          { error: "You do not have permission to access tables." },
          { status: 403 }
        ),
      };
    }
  }

  return {
  admin,
  staff: {
    id: staff.id,
    restaurant_id: staff.restaurant_id,
    role_id: staff.role_id,
  } satisfies StaffContext,
}}

export async function GET() {
  try {
    const auth = await authorizeStaff(false);
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.admin
      .from("tables")
      .select(
        "id, restaurant_id, table_number, seats, status, created_at, updated_at"
      )
      .eq("restaurant_id", auth.staff.restaurant_id)
      .order("table_number", { ascending: true });

    if (error) {
      console.error("Tables GET failed:", error);
      return NextResponse.json(
        { error: "Unable to load tables." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { tables: data ?? [] },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error("Unexpected tables GET error:", error);
    return NextResponse.json(
      { error: "Unexpected error while loading tables." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeStaff(true);
    if ("error" in auth) return auth.error;

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
    const tableNumber =
      typeof input.table_number === "string"
        ? input.table_number.trim()
        : "";
    const seats = input.seats;

    if (!tableNumber || tableNumber.length > 50) {
      return NextResponse.json(
        { error: "Table number must be between 1 and 50 characters." },
        { status: 400 }
      );
    }

    if (
      typeof seats !== "number" ||
      !Number.isSafeInteger(seats) ||
      seats < 1 ||
      seats > 100
    ) {
      return NextResponse.json(
        { error: "Seats must be a whole number between 1 and 100." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await auth.admin
      .from("tables")
      .insert({
        restaurant_id: auth.staff.restaurant_id,
        table_number: tableNumber,
        seats,
        status: "FREE",
        created_at: now,
        updated_at: now,
      })
      .select(
        "id, restaurant_id, table_number, seats, status, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("Tables POST failed:", error);
      return NextResponse.json(
        { error: "Unable to create table." },
        { status: 500 }
      );
    }

    return NextResponse.json({ table: data }, { status: 201 });
  } catch (error) {
    console.error("Unexpected tables POST error:", error);
    return NextResponse.json(
      { error: "Unexpected error while creating table." },
      { status: 500 }
    );
  }
}