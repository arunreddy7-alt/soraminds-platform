import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RequestBody = {
  restaurantSlug: string;
  tableId: number;
};

function generateGroupCode(length = 6) {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < length; i++) {
    code += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    const restaurantSlug = body.restaurantSlug?.trim();
    const tableId = Number(body.tableId);

    if (!restaurantSlug) {
      return NextResponse.json(
        { error: "Restaurant is required." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(tableId) || tableId <= 0) {
      return NextResponse.json(
        { error: "Valid table is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Find restaurant
    const { data: restaurant, error: restaurantError } =
      await supabase
        .from("restaurants")
        .select("id, slug, name, is_active, is_open, accept_orders")
        .eq("slug", restaurantSlug)
        .maybeSingle();

    if (restaurantError) {
      console.error(
        "Restaurant lookup error:",
        restaurantError
      );

      return NextResponse.json(
        { error: "Unable to find restaurant." },
        { status: 500 }
      );
    }

    if (!restaurant || !restaurant.is_active) {
      return NextResponse.json(
        { error: "Restaurant not found." },
        { status: 404 }
      );
    }

    // 2. Verify table belongs to this restaurant
    const { data: table, error: tableError } =
      await supabase
        .from("tables")
        .select("id, restaurant_id, table_number, seats, status")
        .eq("id", tableId)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();

    if (tableError) {
      console.error("Table lookup error:", tableError);

      return NextResponse.json(
        { error: "Unable to find table." },
        { status: 500 }
      );
    }

    if (!table) {
      return NextResponse.json(
        { error: "Table not found." },
        { status: 404 }
      );
    }

    // 3. Look for an existing active session
    const { data: existingSession, error: sessionLookupError } =
      await supabase
        .from("table_sessions")
        .select(`
          id,
          restaurant_id,
          table_id,
          status,
          started_at,
          ended_at,
          group_code
        `)
        .eq("restaurant_id", restaurant.id)
        .eq("table_id", table.id)
        .eq("status", "ACTIVE")
        .maybeSingle();

    if (sessionLookupError) {
      console.error(
        "Session lookup error:",
        sessionLookupError
      );

      return NextResponse.json(
        { error: "Unable to check table session." },
        { status: 500 }
      );
    }

    // 4. Existing session → everyone joins the same session
    if (existingSession) {
      return NextResponse.json({
        success: true,
        session: existingSession,
        table: {
          id: table.id,
          tableNumber: table.table_number,
          seats: table.seats,
        },
        restaurant: {
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
        },
        isNew: false,
      });
    }

    // 5. No active session → create one
    let createdSession = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const groupCode = generateGroupCode();

      const { data, error } = await supabase
        .from("table_sessions")
        .insert({
          restaurant_id: restaurant.id,
          table_id: table.id,
          status: "ACTIVE",
          started_at: new Date().toISOString(),
          group_code: groupCode,
        })
        .select(`
          id,
          restaurant_id,
          table_id,
          status,
          started_at,
          ended_at,
          group_code
        `)
        .single();

      if (!error && data) {
        createdSession = data;
        break;
      }

      // Unique group_code collision → try again
      if (
        error?.code !== "23505"
      ) {
        // Could also be the active-session constraint.
        // Re-check for an existing active session.
        const { data: activeSession } =
          await supabase
            .from("table_sessions")
            .select(`
              id,
              restaurant_id,
              table_id,
              status,
              started_at,
              ended_at,
              group_code
            `)
            .eq("restaurant_id", restaurant.id)
            .eq("table_id", table.id)
            .eq("status", "ACTIVE")
            .maybeSingle();

        if (activeSession) {
          return NextResponse.json({
            success: true,
            session: activeSession,
            table: {
              id: table.id,
              tableNumber: table.table_number,
              seats: table.seats,
            },
            restaurant: {
              id: restaurant.id,
              slug: restaurant.slug,
              name: restaurant.name,
            },
            isNew: false,
          });
        }

        console.error(
          "Session creation error:",
          error
        );

        return NextResponse.json(
          { error: "Unable to create table session." },
          { status: 500 }
        );
      }
    }

    if (!createdSession) {
      return NextResponse.json(
        { error: "Unable to create table session." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: createdSession,
      table: {
        id: table.id,
        tableNumber: table.table_number,
        seats: table.seats,
      },
      restaurant: {
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
      },
      isNew: true,
    });
  } catch (error) {
    console.error(
      "Table session API error:",
      error
    );

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}