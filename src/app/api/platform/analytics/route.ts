import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const privateHeaders = {
  "Cache-Control": "private, no-store",
};

export async function GET() {
  try {
    // 1. Verify the authenticated Supabase user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: privateHeaders }
      );
    }

    // 2. Verify active platform membership server-side.
    const admin = createAdminClient();

    const { data: platformUser, error: platformError } =
      await admin
        .from("platform_users")
        .select("id, is_active")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (platformError) {
      console.error(
        "Platform analytics membership check failed:",
        platformError
      );

      return NextResponse.json(
        { error: "Unable to verify platform access" },
        { status: 500, headers: privateHeaders }
      );
    }

    if (!platformUser || !platformUser.is_active) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: privateHeaders }
      );
    }

    // 3. Calculate the rolling 30-calendar-day reporting period.
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const [restaurantsResult, ordersResult] = await Promise.all([
      admin
        .from("restaurants")
        .select("id, name, is_active"),

      admin
        .from("orders")
        .select("id, restaurant_id, status, created_at")
        .gte("created_at", since.toISOString())
        .lte("created_at", now.toISOString())
        .order("created_at", { ascending: true }),
    ]);

    if (restaurantsResult.error || ordersResult.error) {
      console.error("Platform analytics query failed:", {
        restaurantsError: restaurantsResult.error,
        ordersError: ordersResult.error,
      });

      return NextResponse.json(
        { error: "Failed to load platform analytics" },
        { status: 500, headers: privateHeaders }
      );
    }

    const restaurants = restaurantsResult.data ?? [];
    const orders = ordersResult.data ?? [];

    // Prepare all 30 calendar days, including days with zero orders.
    const dailyMap = new Map<string, number>();

    for (let i = 0; i < 30; i++) {
      const day = new Date(since);
      day.setDate(since.getDate() + i);
      dailyMap.set(day.toISOString().slice(0, 10), 0);
    }

    const restaurantOrderCounts = new Map<number, number>();

    for (const order of orders) {
      const day = new Date(order.created_at)
        .toISOString()
        .slice(0, 10);

      if (dailyMap.has(day)) {
        dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
      }

      restaurantOrderCounts.set(
        order.restaurant_id,
        (restaurantOrderCounts.get(order.restaurant_id) ?? 0) + 1
      );
    }

    const restaurantPerformance = restaurants
      .map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        isActive: restaurant.is_active,
        orders: restaurantOrderCounts.get(restaurant.id) ?? 0,
      }))
      .sort((a, b) => b.orders - a.orders);

    const statusCounts: Record<string, number> = {};

    for (const order of orders) {
      const status = order.status || "UNKNOWN";
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    }

    return NextResponse.json(
      {
        summary: {
          totalRestaurants: restaurants.length,
          activeRestaurants: restaurants.filter((r) => r.is_active).length,
          ordersLast30Days: orders.length,
        },
        dailyOrders: Array.from(dailyMap, ([date, count]) => ({
          date,
          count,
        })),
        statusCounts,
        restaurantPerformance: restaurantPerformance.slice(0, 10),
        period: {
          start: since.toISOString(),
          end: now.toISOString(),
        },
      },
      {
        status: 200,
        headers: privateHeaders,
      }
    );
  } catch (error) {
    console.error("Platform analytics error:", error);

    return NextResponse.json(
      { error: "Failed to load platform analytics" },
      { status: 500, headers: privateHeaders }
    );
  }
}
