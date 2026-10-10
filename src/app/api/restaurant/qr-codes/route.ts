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
    console.error("QR staff lookup failed:", staffError);
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
    console.error("QR restaurant lookup failed:", restaurantError);
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

  if (roleError || !role) {
    console.error("QR role lookup failed:", roleError);
    return {
      error: NextResponse.json(
        { error: "Unable to verify staff role." },
        { status: roleError ? 500 : 403 }
      ),
    };
  }

  const isOwner = role.name?.toUpperCase() === "OWNER";

  if (!isOwner) {
    const { data: permission, error: permissionError } = await admin
      .from("permissions")
      .select("access")
      .eq("role_id", staff.role_id)
      .eq("module", "qr_codes")
      .maybeSingle();

    if (permissionError) {
      console.error("QR permission lookup failed:", permissionError);
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
          { error: "You do not have permission to manage QR codes." },
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
  };
}

export async function GET() {
  try {
    const auth = await authorizeStaff(false);
    if ("error" in auth) return auth.error;

    const restaurantId = auth.staff.restaurant_id;

    const [
      { data: tables, error: tablesError },
      { data: qrCodes, error: qrError },
    ] = await Promise.all([
      auth.admin
        .from("tables")
        .select("id, table_number, seats, status")
        .eq("restaurant_id", restaurantId)
        .order("table_number", { ascending: true }),

      auth.admin
        .from("qr_codes")
        .select(
          "id, restaurant_id, table_id, code, is_active, created_at, updated_at"
        )
        .eq("restaurant_id", restaurantId)
        .order("id", { ascending: true }),
    ]);

    if (tablesError || qrError) {
      console.error("QR GET failed:", {
        tablesError,
        qrError,
      });

      return NextResponse.json(
        { error: "Unable to load QR codes and tables." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        tables: tables ?? [],
        qrCodes: qrCodes ?? [],
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error("Unexpected QR GET error:", error);

    return NextResponse.json(
      { error: "Unexpected error while loading QR codes." },
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
    const restaurantId = auth.staff.restaurant_id;

    if (
      input.type !== "DINE_IN" &&
      input.type !== "TAKEAWAY"
    ) {
      return NextResponse.json(
        { error: "Type must be DINE_IN or TAKEAWAY." },
        { status: 400 }
      );
    }

    let tableId: number | null = null;

    if (input.type === "DINE_IN") {
      if (
        typeof input.table_id !== "number" ||
        !Number.isSafeInteger(input.table_id) ||
        input.table_id <= 0
      ) {
        return NextResponse.json(
          { error: "A valid table_id is required." },
          { status: 400 }
        );
      }

      tableId = input.table_id;

      const { data: table, error: tableError } = await auth.admin
        .from("tables")
        .select("id")
        .eq("id", tableId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (tableError) {
        console.error("QR table lookup failed:", tableError);
        return NextResponse.json(
          { error: "Unable to verify table." },
          { status: 500 }
        );
      }

      if (!table) {
        return NextResponse.json(
          { error: "Table not found for this restaurant." },
          { status: 404 }
        );
      }
    }

    // Return the existing QR instead of creating a duplicate.
    const existingQuery = auth.admin
      .from("qr_codes")
      .select(
        "id, restaurant_id, table_id, code, is_active, created_at, updated_at"
      )
      .eq("restaurant_id", restaurantId);

    const { data: existing, error: existingError } =
      tableId === null
        ? await existingQuery.is("table_id", null).maybeSingle()
        : await existingQuery.eq("table_id", tableId).maybeSingle();

    if (existingError) {
      console.error("QR duplicate lookup failed:", existingError);
      return NextResponse.json(
        { error: "Unable to check for an existing QR code." },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { qrCode: existing, alreadyExisted: true },
        { status: 200 }
      );
    }

    const code = crypto.randomUUID().replace(/-/g, "");
    const now = new Date().toISOString();

    const { data: created, error: insertError } = await auth.admin
      .from("qr_codes")
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        code,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select(
        "id, restaurant_id, table_id, code, is_active, created_at, updated_at"
      )
      .single();

    if (insertError) {
      console.error("QR insert failed:", insertError);

      return NextResponse.json(
        { error: "Unable to create QR code." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { qrCode: created, alreadyExisted: false },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected QR POST error:", error);

    return NextResponse.json(
      { error: "Unexpected error while creating QR code." },
      { status: 500 }
    );
  }
}