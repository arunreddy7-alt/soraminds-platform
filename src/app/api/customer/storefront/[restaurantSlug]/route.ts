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

    const { data: restaurant, error } =
      await supabase
        .from("restaurants")
        .select(
          `
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
        `
        )
        .eq("slug", restaurantSlug)
        .eq("is_active", true)
        .maybeSingle();

    if (error) {
      console.error(error);

      return NextResponse.json(
        {
          error:
            "Unable to load restaurant.",
        },
        { status: 500 }
      );
    }

    if (!restaurant) {
      return NextResponse.json(
        {
          error:
            "Restaurant not found.",
        },
        { status: 404 }
      );
    }

    const [
      categoriesResult,
      productsResult,
      combosResult,
      bannersResult,
    ] = await Promise.all([
      supabase
        .from("categories")
        .select(
          `
          id,
          name,
          slug,
          description,
          image_url,
          sort_order,
          is_active
        `
        )
        .eq(
          "restaurant_id",
          restaurant.id
        )
        .eq("is_active", true)
        .order("sort_order", {
          ascending: true,
        }),

      supabase
        .from("products")
        .select(
          `
          id,
          category_id,
          name,
          slug,
          description,
          price,
          mrp,
          image_url,
          is_vegetarian,
          is_available,
          is_active
        `
        )
        .eq(
          "restaurant_id",
          restaurant.id
        )
        .eq("is_active", true)
        .order("name", {
          ascending: true,
        }),

      supabase
        .from("combos")
        .select(
          `
          id,
          name,
          description,
          image_url,
          combo_price,
          original_price,
          is_active
        `
        )
        .eq(
          "restaurant_id",
          restaurant.id
        )
        .eq("is_active", true)
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("banners")
        .select(
          `
          id,
          title,
          description,
          image_url,
          sort_order,
          is_active
        `
        )
        .eq(
          "restaurant_id",
          restaurant.id
        )
        .eq("is_active", true)
        .order("sort_order", {
          ascending: true,
        }),
    ]);

    if (categoriesResult.error) {
      console.error(
        categoriesResult.error
      );
    }

    if (productsResult.error) {
      console.error(
        productsResult.error
      );
    }

    if (combosResult.error) {
      console.error(
        combosResult.error
      );
    }

    if (bannersResult.error) {
      console.error(
        bannersResult.error
      );
    }

    return NextResponse.json({
      restaurant,
      categories:
        categoriesResult.data || [],
      products:
        productsResult.data || [],
      combos:
        combosResult.data || [],
      banners:
        bannersResult.data || [],
    });
  } catch (error) {
    console.error(
      "Storefront API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load restaurant storefront.",
      },
      { status: 500 }
    );
  }
}