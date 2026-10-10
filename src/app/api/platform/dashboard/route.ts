import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    // Verify the platform owner
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { data: platformUser, error: platformError } =
      await supabase
        .from("platform_users")
        .select("id, is_active")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (
      platformError ||
      !platformUser ||
      !platformUser.is_active
    ) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    // Use the service-role client only on the server
    const admin = createAdminClient();

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

    const failedResult = results.find(
      (result) => result.error
    );

    if (failedResult?.error) {
      console.error(
        "Platform dashboard query failed:",
        failedResult.error
      );

      return NextResponse.json(
        { error: "Failed to load dashboard statistics." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      stats: {
        totalRestaurants: restaurantsResult.count ?? 0,
        activeRestaurants: activeRestaurantsResult.count ?? 0,
        totalOrders: ordersResult.count ?? 0,
        totalStaff: staffResult.count ?? 0,
      },
      recentRestaurants: recentRestaurantsResult.data ?? [],
    });
  } catch (error) {
    console.error("Platform dashboard error:", error);

    return NextResponse.json(
      { error: "Failed to load platform dashboard." },
      { status: 500 }
    );
  }
}