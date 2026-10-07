import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requirePlatformOwner() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: platformUser, error } = await supabase
    .from("platform_users")
    .select("id, is_active, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    error ||
    !platformUser ||
    !platformUser.is_active
  ) {
    return null;
  }

  return platformUser;
}

export async function GET() {
  try {
    const platformUser = await requirePlatformOwner();

    if (!platformUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const { data: owners, error: ownersError } =
      await admin
        .from("users")
        .select(
          "id, restaurant_id, full_name, email, phone, is_active, auth_user_id, role_id"
        )
        .eq("role_id", 3)
        .order("created_at", {
          ascending: false,
        });

    if (ownersError) {
      console.error(
        "Failed to load owners:",
        ownersError
      );

      return NextResponse.json(
        {
          error: ownersError.message,
        },
        { status: 500 }
      );
    }

    const restaurantIds = [
      ...new Set(
        (owners || [])
          .map((owner) => owner.restaurant_id)
          .filter(Boolean)
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
          {
            error: restaurantError.message,
          },
          { status: 500 }
        );
      }

      restaurants = restaurantData || [];
    }

    const restaurantMap = new Map(
      restaurants.map((restaurant) => [
        restaurant.id,
        restaurant,
      ])
    );

    const result = (owners || []).map((owner) => {
      const restaurant = restaurantMap.get(
        owner.restaurant_id
      );

      return {
        id: owner.id,
        restaurant_id: owner.restaurant_id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
        is_active: owner.is_active,
        auth_user_id: owner.auth_user_id,
        role_id: owner.role_id,
        restaurant_name:
          restaurant?.name || "Unknown Restaurant",
        restaurant_slug:
          restaurant?.slug || "—",
      };
    });

    return NextResponse.json({
      owners: result,
    });
  } catch (error) {
    console.error(
      "Platform owners GET error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load restaurant owners.",
      },
      { status: 500 }
    );
  }
}