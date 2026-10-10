import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ComboItemInput = {
  product_id: number;
  quantity: number;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function authorizeStaff(requireFullAccess: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: errorResponse("Unauthorized", 401) };
  }

  const admin = createAdminClient();

  const { data: staff, error: staffError } = await admin
    .from("users")
    .select("id, restaurant_id, role_id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (staffError) {
    console.error("Combo staff lookup failed:", staffError);
    return { error: errorResponse("Unable to verify staff access", 500) };
  }

  if (!staff || !staff.is_active) {
    return { error: errorResponse("Staff account is inactive", 403) };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, name, is_active")
    .eq("id", staff.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    console.error("Combo restaurant lookup failed:", restaurantError);
    return { error: errorResponse("Unable to verify restaurant", 500) };
  }

  if (!restaurant || !restaurant.is_active) {
    return { error: errorResponse("Restaurant is inactive", 403) };
  }

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("name")
    .eq("id", staff.role_id)
    .maybeSingle();

  if (roleError) {
    console.error("Combo role lookup failed:", roleError);
    return { error: errorResponse("Unable to verify staff role", 500) };
  }

  if (!role) {
    return { error: errorResponse("Staff role not found", 403) };
  }

  if (role.name !== "OWNER") {
    const { data: permission, error: permissionError } = await admin
      .from("permissions")
      .select("access")
      .eq("role_id", staff.role_id)
      .eq("module", "combos")
      .maybeSingle();

    if (permissionError) {
      console.error("Combo permission lookup failed:", permissionError);
      return { error: errorResponse("Unable to verify permissions", 500) };
    }

    if (
      permission?.access !== "FULL" &&
      !(permission?.access === "VIEW" && !requireFullAccess)
    ) {
      return { error: errorResponse("Insufficient combo permissions", 403) };
    }
  }

  return {
    admin,
    restaurantId: staff.restaurant_id,
    restaurantName: restaurant.name,
  };
}

export async function GET() {
  try {
    const auth = await authorizeStaff(false);

    if ("error" in auth) return auth.error;

    const { admin, restaurantId, restaurantName } = auth;

    const [productsResult, combosResult] = await Promise.all([
      admin
        .from("products")
        .select(
          "id, restaurant_id, name, price, image_url, is_available, is_active"
        )
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("name"),

      admin
        .from("combos")
        .select(`
          id,
          restaurant_id,
          name,
          description,
          image_url,
          combo_price,
          original_price,
          is_active,
          created_at,
          updated_at,
          combo_items (
            id,
            combo_id,
            product_id,
            quantity,
            is_active
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false }),
    ]);

    if (productsResult.error || combosResult.error) {
      console.error(
        "Combo data lookup failed:",
        productsResult.error || combosResult.error
      );

      return errorResponse("Unable to load combo data", 500);
    }

    return NextResponse.json(
      {
        restaurantName,
        products: productsResult.data ?? [],
        combos: combosResult.data ?? [],
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error("Combo GET failed:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeStaff(true);

    if ("error" in auth) return auth.error;

    const { admin, restaurantId } = auth;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Invalid request body", 400);
    }

    const payload = body as Record<string, unknown>;

    const name =
      typeof payload.name === "string" ? payload.name.trim() : "";

    const description =
      typeof payload.description === "string"
        ? payload.description.trim()
        : "";

    const imageUrl =
      typeof payload.image_url === "string" && payload.image_url.trim()
        ? payload.image_url.trim()
        : null;

    const comboPrice = Number(payload.combo_price);
    const items = payload.items;

    if (!name || name.length > 150) {
      return errorResponse("Combo name is required and must be at most 150 characters", 400);
    }

    if (description.length > 2000) {
      return errorResponse("Description is too long", 400);
    }

    if (
      !Number.isFinite(comboPrice) ||
      comboPrice <= 0 ||
      comboPrice > 1_000_000
    ) {
      return errorResponse("Invalid combo price", 400);
    }

    if (
      imageUrl !== null &&
      (
        imageUrl.length > 2048 ||
        !/^https:\/\//i.test(imageUrl) ||
        (() => {
          try {
            return new URL(imageUrl).protocol !== "https:";
          } catch {
            return true;
          }
        })()
      )
    ) {
      return errorResponse("Invalid image URL", 400);
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return errorResponse("Select between 1 and 100 products", 400);
    }

    const normalizedItems: ComboItemInput[] = [];
    const seenProductIds = new Set<number>();

    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return errorResponse("Invalid combo item", 400);
      }

      const candidate = item as Record<string, unknown>;
      const productId = candidate.product_id;
      const quantity = candidate.quantity;

      if (
        typeof productId !== "number" ||
        !Number.isSafeInteger(productId) ||
        productId <= 0 ||
        typeof quantity !== "number" ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 100
      ) {
        return errorResponse("Invalid product or quantity", 400);
      }

      if (seenProductIds.has(productId)) {
        return errorResponse("A product can only appear once in a combo", 400);
      }

      seenProductIds.add(productId);
      normalizedItems.push({ product_id: productId, quantity });
    }

    const productIds = normalizedItems.map((item) => item.product_id);

    const { data: products, error: productsError } = await admin
      .from("products")
      .select("id, price")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .in("id", productIds);

    if (productsError) {
      console.error("Combo product validation failed:", productsError);
      return errorResponse("Unable to validate selected products", 500);
    }

    if (!products || products.length !== productIds.length) {
      return errorResponse(
        "One or more selected products are unavailable or belong to another restaurant",
        400
      );
    }

    const priceById = new Map(
      products.map((product) => [product.id, Number(product.price)])
    );

    const originalPrice = normalizedItems.reduce(
      (total, item) =>
        total + (priceById.get(item.product_id) ?? 0) * item.quantity,
      0
    );

    if (
      !Number.isFinite(originalPrice) ||
      originalPrice <= 0 ||
      comboPrice >= originalPrice
    ) {
      return errorResponse(
        "Combo price must be lower than the total price of its products",
        400
      );
    }

    const now = new Date().toISOString();

    const { data: combo, error: comboError } = await admin
      .from("combos")
      .insert({
        restaurant_id: restaurantId,
        name,
        description: description || null,
        image_url: imageUrl,
        combo_price: comboPrice,
        original_price: originalPrice,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (comboError || !combo) {
      console.error("Combo creation failed:", comboError);
      return errorResponse("Unable to create combo", 500);
    }

    const { error: itemsError } = await admin
      .from("combo_items")
      .insert(
        normalizedItems.map((item) => ({
          combo_id: combo.id,
          product_id: item.product_id,
          quantity: item.quantity,
          is_active: true,
          created_at: now,
          updated_at: now,
        }))
      );

    if (itemsError) {
      console.error("Combo items creation failed:", itemsError);

      // Best-effort cleanup so a failed item insert does not leave an empty combo.
      const { error: cleanupError } = await admin
        .from("combos")
        .delete()
        .eq("id", combo.id)
        .eq("restaurant_id", restaurantId);

      if (cleanupError) {
        console.error("Combo cleanup failed:", cleanupError);
      }

      return errorResponse("Unable to save combo products", 500);
    }

    return NextResponse.json(
      { success: true, comboId: combo.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Combo POST failed:", error);
    return errorResponse("Internal server error", 500);
  }
}
