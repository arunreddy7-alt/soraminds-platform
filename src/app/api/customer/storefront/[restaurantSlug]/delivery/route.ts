
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      restaurantSlug: string;
    }>;
  }
) {
  try {
    const { restaurantSlug } = await params;
    const supabase = await createClient();

    // Find the active restaurant and its delivery feature flag.
    const { data: restaurant, error } = await supabase
      .from("restaurants")
      .select(`
        id,
        name,
        slug,
        phone,
        cuisine,
        address,
        accent_color,
        is_open,
        accept_orders,
        features,
        is_active
      `)
      .eq("slug", restaurantSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Delivery restaurant lookup:", error);

      return NextResponse.json(
        { error: "Unable to load restaurant." },
        { status: 500 }
      );
    }

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found." },
        { status: 404 }
      );
    }

    const features = restaurant.features as
      | Record<string, unknown>
      | null;

    if (features?.delivery !== true) {
      return NextResponse.json(
        { error: "Delivery is not available for this restaurant." },
        { status: 403 }
      );
    }

    // Reuse the existing restaurant menu data.
    const [
      categoriesResult,
      productsResult,
      combosResult,
      bannersResult,
    ] = await Promise.all([
      supabase
        .from("categories")
        .select(`
          id, name, slug, description, image_url,
          sort_order, is_active
        `)
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),

      supabase
        .from("products")
        .select(`
          id, category_id, name, slug, description,
          price, mrp, image_url, is_vegetarian,
          is_available, is_active
        `)
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("name", { ascending: true }),

      supabase
        .from("combos")
        .select(`
          id, name, description, image_url,
          combo_price, original_price, is_active
        `)
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),

      supabase
        .from("banners")
        .select(`
          id, title, description, image_url,
          sort_order, is_active
        `)
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    // Don't silently return an incomplete menu if a query fails.
    const queryError =
      categoriesResult.error ||
      productsResult.error ||
      combosResult.error ||
      bannersResult.error;

    if (queryError) {
      console.error("Delivery menu lookup:", queryError);

      return NextResponse.json(
        { error: "Unable to load the delivery menu." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      restaurant,
      categories: categoriesResult.data ?? [],
      products: productsResult.data ?? [],
      combos: combosResult.data ?? [],
      banners: bannersResult.data ?? [],
      orderMode: "DELIVERY",
    });
  } catch (error) {
    console.error("Delivery storefront API error:", error);

    return NextResponse.json(
      { error: "Unable to load delivery storefront." },
      { status: 500 }
    );
  }
}
