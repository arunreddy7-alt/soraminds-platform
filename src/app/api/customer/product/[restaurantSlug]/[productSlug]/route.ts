import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      restaurantSlug: string;
      productSlug: string;
    }>;
  }
) {
  try {
    const {
      restaurantSlug,
      productSlug,
    } = await params;

    const supabase = await createClient();

    // Find restaurant
    const {
      data: restaurant,
      error: restaurantError,
    } = await supabase
      .from("restaurants")
      .select(
        `
        id,
        name,
        slug,
        accent_color,
        is_open,
        accept_orders,
        is_active
      `
      )
      .eq("slug", restaurantSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (restaurantError) {
      console.error(
        "Restaurant error:",
        restaurantError
      );

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

    // Find product
    const {
      data: product,
      error: productError,
    } = await supabase
      .from("products")
      .select(
        `
        id,
        restaurant_id,
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
      .eq("slug", productSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (productError) {
      console.error(
        "Product error:",
        productError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load product.",
        },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        {
          error: "Product not found.",
        },
        { status: 404 }
      );
    }

    // Get active + available variants
    const {
      data: variants,
      error: variantsError,
    } = await supabase
      .from("product_variants")
      .select(
        `
        id,
        product_id,
        name,
        description,
        price,
        mrp,
        image_url,
        discount_percent,
        sort_order,
        is_available,
        is_active
      `
      )
      .eq("product_id", product.id)
      .eq("is_active", true)
      .eq("is_available", true)
      .order("sort_order", {
        ascending: true,
      });

    if (variantsError) {
      console.error(
        "Variants error:",
        variantsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load product variants.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      restaurant,
      product,
      variants: variants || [],
    });
  } catch (error) {
    console.error(
      "Product API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load product.",
      },
      { status: 500 }
    );
  }
}