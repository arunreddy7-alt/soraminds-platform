import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
        { error: "Unauthorized." },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store" },
        }
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
        "Platform membership verification failed:",
        platformError
      );

      return NextResponse.json(
        { error: "Unable to verify platform access." },
        {
          status: 500,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    if (!platformUser || !platformUser.is_active) {
      return NextResponse.json(
        { error: "Forbidden." },
        {
          status: 403,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    // 3. Load platform dashboard statistics.
    const [
      restaurantsResult,
      activeRestaurantsResult,
      ordersResult,
      staffResult,
      recentRestaurantsResult,
    ] = await Promise.all([
      admin
        .from("restaurants")
        .select("id", { count: "exact", head: true }),

      admin
        .from("restaurants")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      admin
        .from("orders")
        .select("id", { count: "exact", head: true }),

      admin
        .from("users")
        .select("id", { count: "exact", head: true })
        .neq("role_id", 3),

      admin
        .from("restaurants")
        .select("id, name, slug, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const results = [
      restaurantsResult,
      activeRestaurantsResult,
      ordersResult,
      staffResult,
      recentRestaurantsResult,
    ];

    const failedResult = results.find((result) => result.error);

    if (failedResult?.error) {
      console.error(
        "Platform dashboard query failed:",
        failedResult.error
      );

      return NextResponse.json(
        { error: "Failed to load dashboard statistics." },
        {
          status: 500,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    return NextResponse.json(
      {
        stats: {
          totalRestaurants: restaurantsResult.count ?? 0,
          activeRestaurants: activeRestaurantsResult.count ?? 0,
          totalOrders: ordersResult.count ?? 0,
          totalStaff: staffResult.count ?? 0,
        },
        recentRestaurants: recentRestaurantsResult.data ?? [],
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error("Platform dashboard error:", error);

    return NextResponse.json(
      { error: "Failed to load platform dashboard." },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }
}
