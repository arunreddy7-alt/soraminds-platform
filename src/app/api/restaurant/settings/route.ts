import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You are not authenticated." },
        { status: 401 }
      );
    }

    const { data: restaurantUser, error: userError } =
      await admin
        .from("users")
        .select(
          "id, restaurant_id, role_id, is_active"
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (userError || !restaurantUser) {
      return NextResponse.json(
        { error: "Restaurant user not found." },
        { status: 403 }
      );
    }

    if (!restaurantUser.is_active) {
      return NextResponse.json(
        { error: "Your account is disabled." },
        { status: 403 }
      );
    }

    const { data: role } = await admin
      .from("roles")
      .select("name")
      .eq("id", restaurantUser.role_id)
      .maybeSingle();

    if (!role || role.name !== "OWNER") {
      return NextResponse.json(
        {
          error:
            "Only the restaurant owner can manage settings.",
        },
        { status: 403 }
      );
    }

    const { data: restaurant, error: restaurantError } =
      await admin
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
        .eq("id", restaurantUser.restaurant_id)
        .maybeSingle();

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      restaurant,
    });
  } catch (error) {
    console.error("Settings GET error:", error);

    return NextResponse.json(
      { error: "Unable to load restaurant settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You are not authenticated." },
        { status: 401 }
      );
    }

    const { data: restaurantUser, error: userError } =
      await admin
        .from("users")
        .select(
          "id, restaurant_id, role_id, is_active"
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (userError || !restaurantUser) {
      return NextResponse.json(
        { error: "Restaurant user not found." },
        { status: 403 }
      );
    }

    if (!restaurantUser.is_active) {
      return NextResponse.json(
        { error: "Your account is disabled." },
        { status: 403 }
      );
    }

    const { data: role } = await admin
      .from("roles")
      .select("name")
      .eq("id", restaurantUser.role_id)
      .maybeSingle();

    if (!role || role.name !== "OWNER") {
      return NextResponse.json(
        {
          error:
            "Only the restaurant owner can manage settings.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      name,
      slug,
      phone,
      cuisine,
      address,
      accent_color,
      is_open,
      accept_orders,
      features,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Restaurant name is required." },
        { status: 400 }
      );
    }

    if (!slug?.trim()) {
      return NextResponse.json(
        { error: "Restaurant slug is required." },
        { status: 400 }
      );
    }

    const cleanSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!cleanSlug) {
      return NextResponse.json(
        { error: "Please enter a valid restaurant slug." },
        { status: 400 }
      );
    }

    const allowedFeatures = {
      delivery: Boolean(features?.delivery),
      vip_lounge: Boolean(features?.vip_lounge),
      bar: Boolean(features?.bar),
      live_entertainment: Boolean(
        features?.live_entertainment
      ),
    };

    const { data: existingSlug } = await admin
      .from("restaurants")
      .select("id")
      .eq("slug", cleanSlug)
      .neq("id", restaurantUser.restaurant_id)
      .maybeSingle();

    if (existingSlug) {
      return NextResponse.json(
        {
          error:
            "That restaurant slug is already being used.",
        },
        { status: 409 }
      );
    }

    const { data: restaurant, error: updateError } =
      await admin
        .from("restaurants")
        .update({
          name: name.trim(),
          slug: cleanSlug,
          phone: phone?.trim() || null,
          cuisine: cuisine?.trim() || null,
          address: address?.trim() || null,
          accent_color:
            accent_color?.trim() || "#202228",
          is_open: Boolean(is_open),
          accept_orders: Boolean(accept_orders),
          features: allowedFeatures,
          updated_at: new Date().toISOString(),
        })
        .eq("id", restaurantUser.restaurant_id)
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
        .single();

    if (updateError) {
      console.error(updateError);

      return NextResponse.json(
        {
          error:
            "Unable to update restaurant settings.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      restaurant,
    });
  } catch (error) {
    console.error("Settings PUT error:", error);

    return NextResponse.json(
      { error: "Unable to save restaurant settings." },
      { status: 500 }
    );
  }
}