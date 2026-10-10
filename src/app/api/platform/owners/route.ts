import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const privateHeaders = {
  "Cache-Control": "private, no-store",
};

async function requirePlatformOwner() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false as const, error: "unauthorized" };
  }

  const admin = createAdminClient();

  const { data: platformUser, error } = await admin
    .from("platform_users")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Platform membership verification failed:", error);
    return { authorized: false as const, error: "internal" };
  }

  if (!platformUser || !platformUser.is_active) {
    return { authorized: false as const, error: "unauthorized" };
  }

  return { authorized: true as const };
}

export async function GET() {
  try {
    const access = await requirePlatformOwner();

    if (!access.authorized) {
      return NextResponse.json(
        {
          error:
            access.error === "internal"
              ? "Unable to verify platform access."
              : "Unauthorized.",
        },
        {
          status: access.error === "internal" ? 500 : 401,
          headers: privateHeaders,
        }
      );
    }

    const admin = createAdminClient();

    const { data: owners, error: ownersError } = await admin
      .from("users")
      .select(
        "id, restaurant_id, full_name, email, phone, is_active, role_id, created_at"
      )
      .eq("role_id", 3)
      .order("created_at", { ascending: false });

    if (ownersError) {
      console.error("Failed to load owners:", ownersError);

      return NextResponse.json(
        { error: "Failed to load restaurant owners." },
        { status: 500, headers: privateHeaders }
      );
    }

    const ownerRows = owners ?? [];
    const restaurantIds = [
      ...new Set(
        ownerRows
          .map((owner) => owner.restaurant_id)
          .filter((id): id is number => id !== null)
      ),
    ];

    let restaurants: {
      id: number;
      name: string;
      slug: string;
    }[] = [];

    if (restaurantIds.length > 0) {
      const { data: restaurantData, error: restaurantError } =
        await admin
          .from("restaurants")
          .select("id, name, slug")
          .in("id", restaurantIds);

      if (restaurantError) {
        console.error(
          "Failed to load owner restaurants:",
          restaurantError
        );

        return NextResponse.json(
          { error: "Failed to load owner restaurants." },
          { status: 500, headers: privateHeaders }
        );
      }

      restaurants = restaurantData ?? [];
    }

    const restaurantMap = new Map(
      restaurants.map((restaurant) => [
        restaurant.id,
        restaurant,
      ])
    );

    const result = ownerRows.map((owner) => {
      const restaurant = restaurantMap.get(owner.restaurant_id);

      return {
        id: owner.id,
        restaurant_id: owner.restaurant_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
        is_active: owner.is_active,
        role_id: owner.role_id,
        restaurant_name: restaurant?.name ?? "Unknown Restaurant",
        restaurant_slug: restaurant?.slug ?? "—",
      };
    });

    return NextResponse.json(
      { owners: result },
      { status: 200, headers: privateHeaders }
    );
  } catch (error) {
    console.error("Platform owners GET error:", error);

    return NextResponse.json(
      { error: "Failed to load restaurant owners." },
      { status: 500, headers: privateHeaders }
    );
  }
}
