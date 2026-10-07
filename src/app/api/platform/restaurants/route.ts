import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type CreateRestaurantRequest = {
  name: string;
  slug: string;
  phone?: string;
  cuisine?: string;
  address?: string;
  accent_color?: string;
  is_open?: boolean;
  accept_orders?: boolean;

  owner_full_name: string;
  owner_email: string;
  owner_password: string;
};

export async function POST(request: Request) {
  try {
    // -----------------------------------------
    // 1. Verify logged-in Supabase user
    // -----------------------------------------

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // -----------------------------------------
    // 2. Verify Platform Owner
    // -----------------------------------------

    const { data: platformUser, error: platformError } =
      await supabase
        .from("platform_users")
        .select(
          "id, full_name, email, is_active, auth_user_id"
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (
      platformError ||
      !platformUser ||
      !platformUser.is_active
    ) {
      return NextResponse.json(
        {
          error: "Forbidden",
        },
        { status: 403 }
      );
    }

    // -----------------------------------------
    // 3. Read request body
    // -----------------------------------------

    const body =
      (await request.json()) as CreateRestaurantRequest;

    const {
      name,
      slug,
      phone,
      cuisine,
      address,
      accent_color,
      is_open,
      accept_orders,
      owner_full_name,
      owner_email,
      owner_password,
    } = body;

    // -----------------------------------------
    // 4. Validate required fields
    // -----------------------------------------

    if (
      !name?.trim() ||
      !slug?.trim() ||
      !owner_full_name?.trim() ||
      !owner_email?.trim() ||
      !owner_password
    ) {
      return NextResponse.json(
        {
          error:
            "Restaurant name, slug, owner name, owner email and owner password are required.",
        },
        { status: 400 }
      );
    }

    if (owner_password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Owner password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 5. Normalize values
    // -----------------------------------------

    const restaurantName = name.trim();

    const restaurantSlug = slug
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    const ownerName = owner_full_name.trim();
    const ownerEmail = owner_email.trim().toLowerCase();

    // -----------------------------------------
    // 6. Create admin client
    // -----------------------------------------

    const admin = createAdminClient();

    // -----------------------------------------
    // 7. Check duplicate restaurant slug
    // -----------------------------------------

    const { data: existingRestaurant } = await admin
      .from("restaurants")
      .select("id")
      .eq("slug", restaurantSlug)
      .maybeSingle();

    if (existingRestaurant) {
      return NextResponse.json(
        {
          error:
            "A restaurant with this slug already exists.",
        },
        { status: 409 }
      );
    }

    // -----------------------------------------
    // 8. Check duplicate owner email
    // -----------------------------------------

    const { data: existingOwner } = await admin
      .from("users")
      .select("id")
      .eq("email", ownerEmail)
      .maybeSingle();

    if (existingOwner) {
      return NextResponse.json(
        {
          error:
            "A user with this email already exists.",
        },
        { status: 409 }
      );
    }

    // -----------------------------------------
    // 9. Create restaurant
    // -----------------------------------------

    const { data: restaurant, error: restaurantError } =
      await admin
        .from("restaurants")
        .insert({
  name: restaurantName,
  slug: restaurantSlug,
  phone: phone?.trim() || null,
  cuisine: cuisine?.trim() || null,
  address: address?.trim() || null,
  accent_color: accent_color || "#E53935",
  is_open: is_open ?? true,
  accept_orders: accept_orders ?? true,
  is_active: true,

  // Advanced features are OFF by default
  features: {
    delivery: false,
    vip_lounge: false,
    bar: false,
    live_entertainment: false,
  },
})
        .select()
        .single();

    if (restaurantError || !restaurant) {
      console.error(
        "Restaurant creation error:",
        restaurantError
      );

      return NextResponse.json(
        {
          error:
            restaurantError?.message ||
            "Failed to create restaurant.",
        },
        { status: 500 }
      );
    }

    // -----------------------------------------
    // 10. Create Supabase Auth owner
    // -----------------------------------------

    const {
      data: authData,
      error: authCreateError,
    } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: owner_password,
      email_confirm: true,
      user_metadata: {
        full_name: ownerName,
        restaurant_id: restaurant.id,
        role: "OWNER",
      },
    });

    if (authCreateError || !authData.user) {
      // Roll back restaurant
      await admin
        .from("restaurants")
        .delete()
        .eq("id", restaurant.id);

      console.error(
        "Auth owner creation error:",
        authCreateError
      );

      return NextResponse.json(
        {
          error:
            authCreateError?.message ||
            "Failed to create restaurant owner account.",
        },
        { status: 500 }
      );
    }

    // -----------------------------------------
    // 11. Create restaurant owner record
    // -----------------------------------------

    const { data: owner, error: ownerError } =
      await admin
        .from("users")
        .insert({
          restaurant_id: restaurant.id,
          role_id: 3,
          full_name: ownerName,
          email: ownerEmail,
          phone: null,
          password_hash: "SUPABASE_AUTH",
          is_active: true,
          auth_user_id: authData.user.id,
        })
        .select(
          "id, restaurant_id, role_id, full_name, email, phone, is_active, auth_user_id"
        )
        .single();

    if (ownerError || !owner) {
      // Roll back Auth user
      await admin.auth.admin.deleteUser(
        authData.user.id
      );

      // Roll back restaurant
      await admin
        .from("restaurants")
        .delete()
        .eq("id", restaurant.id);

      console.error(
        "Owner database creation error:",
        ownerError
      );

      return NextResponse.json(
        {
          error:
            ownerError?.message ||
            "Failed to create restaurant owner.",
        },
        { status: 500 }
      );
    }

    // -----------------------------------------
    // 12. Success
    // -----------------------------------------

    return NextResponse.json(
      {
        message:
          "Restaurant and owner created successfully.",
        restaurant,
        owner,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create restaurant unexpected error:",
      error
    );

    return NextResponse.json(
      {
        error: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}