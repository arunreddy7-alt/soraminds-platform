import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const restaurantSlug =
      typeof body.restaurantSlug === "string"
        ? body.restaurantSlug.trim()
        : "";

    const groupCode =
      typeof body.groupCode === "string"
        ? body.groupCode.trim().toUpperCase()
        : "";

    if (!restaurantSlug) {
      return NextResponse.json(
        { error: "Restaurant is required." },
        { status: 400 }
      );
    }

    if (!groupCode) {
      return NextResponse.json(
        { error: "Table code is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Find restaurant
    const { data: restaurant, error: restaurantError } =
      await supabase
        .from("restaurants")
        .select(
          "id, slug, name, is_active, is_open, accept_orders"
        )
        .eq("slug", restaurantSlug)
        .maybeSingle();

    if (restaurantError) {
      throw new Error(restaurantError.message);
    }

    if (!restaurant || !restaurant.is_active) {
      return NextResponse.json(
        { error: "Restaurant not found or inactive." },
        { status: 404 }
      );
    }

    // Find active table session by group code
    const { data: session, error: sessionError } =
      await supabase
        .from("table_sessions")
        .select(
          `
          id,
          restaurant_id,
          table_id,
          status,
          started_at,
          ended_at,
          group_code
        `
        )
        .eq("restaurant_id", restaurant.id)
        .eq("group_code", groupCode)
        .eq("status", "ACTIVE")
        .maybeSingle();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Invalid or expired table code. Please check the code and try again.",
        },
        { status: 404 }
      );
    }

    // Get table information
    const { data: table, error: tableError } =
      await supabase
        .from("tables")
        .select("id, table_number, seats, status")
        .eq("id", session.table_id)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();

    if (tableError) {
      throw new Error(tableError.message);
    }

    if (!table) {
      return NextResponse.json(
        { error: "The table for this session no longer exists." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,

      session: {
        id: session.id,
        restaurant_id: session.restaurant_id,
        table_id: session.table_id,
        status: session.status,
        started_at: session.started_at,
        ended_at: session.ended_at,
        group_code: session.group_code,
      },

      table: {
        id: table.id,
        tableNumber: table.table_number,
        seats: table.seats,
        status: table.status,
      },

      restaurant: {
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
      },
    });
  } catch (error) {
    console.error("Join table error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to join table.",
      },
      { status: 500 }
    );
  }
}