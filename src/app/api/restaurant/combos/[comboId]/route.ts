
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ comboId: string }>;
};

type ComboItemInput = {
  product_id: number;
  quantity: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function authorizeComboManager() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const admin = createAdminClient();

  const { data: staff, error: staffError } = await admin
    .from("users")
    .select("id, restaurant_id, role_id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (staffError) {
    console.error("Combo staff lookup failed:", staffError);
    return {
      error: NextResponse.json(
        { error: "Unable to verify staff account" },
        { status: 500 }
      ),
    };
  }

  if (!staff || !staff.is_active || !staff.restaurant_id) {
    return {
      error: NextResponse.json(
        { error: "Active staff account required" },
        { status: 403 }
      ),
    };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, is_active")
    .eq("id", staff.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    console.error("Combo restaurant lookup failed:", restaurantError);
    return {
      error: NextResponse.json(
        { error: "Unable to verify restaurant" },
        { status: 500 }
      ),
    };
  }

  if (!restaurant || !restaurant.is_active) {
    return {
      error: NextResponse.json(
        { error: "Restaurant is inactive" },
        { status: 403 }
      ),
    };
  }

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("name")
    .eq("id", staff.role_id)
    .maybeSingle();

  if (roleError) {
    console.error("Combo role lookup failed:", roleError);
    return {
      error: NextResponse.json(
        { error: "Unable to verify staff role" },
        { status: 500 }
      ),
    };
  }

  if (!role) {
    return {
      error: NextResponse.json(
        { error: "Staff role not found" },
        { status: 403 }
      ),
    };
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
      return {
        error: NextResponse.json(
          { error: "Unable to verify permissions" },
          { status: 500 }
        ),
      };
    }

    if (permission?.access !== "FULL") {
      return {
        error: NextResponse.json(
          { error: "Full combo management permission required" },
          { status: 403 }
        ),
      };
    }
  }

  return {
    admin,
    restaurantId: staff.restaurant_id,
  };
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await authorizeComboManager();

  if ("error" in auth) {
    return auth.error;
  }

  const { admin, restaurantId } = auth;

  const { comboId: rawComboId } = await context.params;
  const comboId = Number(rawComboId);

  if (!Number.isSafeInteger(comboId) || comboId <= 0) {
    return NextResponse.json(
      { error: "Invalid combo ID" },
      { status: 400 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Request body must be an object" },
      { status: 400 }
    );
  }

  // Verify that the combo belongs to this staff member's restaurant.
  const { data: existingCombo, error: comboLookupError } = await admin
    .from("combos")
    .select(
      "id, restaurant_id, name, description, image_url, combo_price, original_price, is_active"
    )
    .eq("id", comboId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (comboLookupError) {
    console.error("Combo lookup failed:", comboLookupError);
    return NextResponse.json(
      { error: "Unable to load combo" },
      { status: 500 }
    );
  }

  if (!existingCombo) {
    return NextResponse.json(
      { error: "Combo not found" },
      { status: 404 }
    );
  }

  // Action 1: activate or deactivate the combo.
  if (body.action === "toggle") {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active must be a boolean" },
        { status: 400 }
      );
    }

    const { data: updatedCombo, error: updateError } = await admin
      .from("combos")
      .update({ is_active: body.is_active })
      .eq("id", comboId)
      .eq("restaurant_id", restaurantId)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error("Combo status update failed:", updateError);
      return NextResponse.json(
        { error: "Failed to update combo status" },
        { status: 500 }
      );
    }

    if (!updatedCombo) {
      return NextResponse.json(
        { error: "Combo not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      combo: updatedCombo,
    });
  }

  // Action 2: update combo details and its selected products.
  if (body.action !== "update") {
    return NextResponse.json(
      { error: 'action must be "update" or "toggle"' },
      { status: 400 }
    );
  }

  const name =
    typeof body.name === "string" ? body.name.trim() : "";

  const description =
    typeof body.description === "string"
      ? body.description.trim()
      : "";

  const imageUrl =
    body.image_url === null || body.image_url === ""
      ? null
      : body.image_url;

  const comboPrice = body.combo_price;

  if (!name || name.length > 150) {
    return NextResponse.json(
      { error: "Name must be between 1 and 150 characters" },
      { status: 400 }
    );
  }

  if (description.length > 2000) {
    return NextResponse.json(
      { error: "Description cannot exceed 2000 characters" },
      { status: 400 }
    );
  }

  if (
    imageUrl !== null &&
    (typeof imageUrl !== "string" || imageUrl.length > 2048)
  ) {
    return NextResponse.json(
      { error: "Invalid image URL" },
      { status: 400 }
    );
  }

  if (typeof imageUrl === "string") {
    try {
      const parsedUrl = new URL(imageUrl);

      if (parsedUrl.protocol !== "https:") {
        throw new Error("HTTPS required");
      }
    } catch {
      return NextResponse.json(
        { error: "Image URL must be a valid HTTPS URL" },
        { status: 400 }
      );
    }
  }

  if (
    typeof comboPrice !== "number" ||
    !Number.isFinite(comboPrice) ||
    comboPrice <= 0 ||
    comboPrice > 1_000_000
  ) {
    return NextResponse.json(
      { error: "Combo price must be greater than 0 and at most 1000000" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    return NextResponse.json(
      { error: "Select between 1 and 100 combo items" },
      { status: 400 }
    );
  }

  const items: ComboItemInput[] = [];

  for (const item of body.items) {
    if (!isRecord(item)) {
      return NextResponse.json(
        { error: "Invalid combo item" },
        { status: 400 }
      );
    }

    if (
      typeof item.product_id !== "number" ||
      !Number.isSafeInteger(item.product_id) ||
      item.product_id <= 0 ||
      typeof item.quantity !== "number" ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 100
    ) {
      return NextResponse.json(
        { error: "Each item needs a valid product_id and quantity (1–100)" },
        { status: 400 }
      );
    }

    items.push({
      product_id: item.product_id,
      quantity: item.quantity,
    });
  }

  const productIds = items.map((item) => item.product_id);

  if (new Set(productIds).size !== productIds.length) {
    return NextResponse.json(
      { error: "A product can only appear once in a combo" },
      { status: 400 }
    );
  }

  // Load current product prices from this restaurant.
  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id, price, is_active, is_available")
    .eq("restaurant_id", restaurantId)
    .in("id", productIds);

  if (productsError) {
    console.error("Combo product lookup failed:", productsError);
    return NextResponse.json(
      { error: "Unable to validate selected products" },
      { status: 500 }
    );
  }

  if (!products || products.length !== productIds.length) {
    return NextResponse.json(
      { error: "One or more products do not belong to this restaurant" },
      { status: 400 }
    );
  }

  if (
    products.some(
      (product) =>
        product.is_active !== true ||
        product.is_available !== true ||
        typeof product.price !== "number" ||
        !Number.isFinite(product.price) ||
        product.price < 0
    )
  ) {
    return NextResponse.json(
      { error: "All selected products must be active and available" },
      { status: 400 }
    );
  }

  const priceById = new Map(
    products.map((product) => [product.id, product.price])
  );

  const originalPrice = items.reduce((total, item) => {
    return total + priceById.get(item.product_id)! * item.quantity;
  }, 0);

  if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
    return NextResponse.json(
      { error: "The selected products have an invalid total price" },
      { status: 400 }
    );
  }

  if (comboPrice >= originalPrice) {
    return NextResponse.json(
      { error: "Combo price must be lower than the original price" },
      { status: 400 }
    );
  }

  // Preserve existing items so we can attempt a rollback if a later
  // database operation fails. For full transactional guarantees, use
  // a PostgreSQL RPC that updates the combo and items in one transaction.
  const { data: oldItems, error: oldItemsError } = await admin
    .from("combo_items")
    .select("product_id, quantity, is_active")
    .eq("combo_id", comboId);

  if (oldItemsError) {
    console.error("Existing combo items lookup failed:", oldItemsError);
    return NextResponse.json(
      { error: "Unable to load existing combo items" },
      { status: 500 }
    );
  }

  const { error: comboUpdateError } = await admin
    .from("combos")
    .update({
      name,
      description: description || null,
      image_url: imageUrl,
      combo_price: comboPrice,
      original_price: originalPrice,
    })
    .eq("id", comboId)
    .eq("restaurant_id", restaurantId);

  if (comboUpdateError) {
    console.error("Combo update failed:", comboUpdateError);
    return NextResponse.json(
      { error: "Failed to update combo details" },
      { status: 500 }
    );
  }

  const { error: deactivateError } = await admin
    .from("combo_items")
    .update({ is_active: false })
    .eq("combo_id", comboId);

  if (deactivateError) {
    console.error("Existing combo items update failed:", deactivateError);

    await admin
      .from("combos")
      .update({
        name: existingCombo.name,
        description: existingCombo.description,
        image_url: existingCombo.image_url,
        combo_price: existingCombo.combo_price,
        original_price: existingCombo.original_price,
      })
      .eq("id", comboId)
      .eq("restaurant_id", restaurantId);

    return NextResponse.json(
      { error: "Failed to update combo items" },
      { status: 500 }
    );
  }

  const newItems = items.map((item) => ({
    combo_id: comboId,
    product_id: item.product_id,
    quantity: item.quantity,
    is_active: true,
  }));

  const { error: insertItemsError } = await admin
    .from("combo_items")
    .insert(newItems);

  if (insertItemsError) {
    console.error("New combo items insert failed:", insertItemsError);

    // Best-effort rollback of combo details and item activation.
    await admin
      .from("combos")
      .update({
        name: existingCombo.name,
        description: existingCombo.description,
        image_url: existingCombo.image_url,
        combo_price: existingCombo.combo_price,
        original_price: existingCombo.original_price,
      })
      .eq("id", comboId)
      .eq("restaurant_id", restaurantId);

    await admin
      .from("combo_items")
      .update({ is_active: false })
      .eq("combo_id", comboId);

    if (oldItems?.length) {
      await admin.from("combo_items").insert(
        oldItems.map((item) => ({
          combo_id: comboId,
          product_id: item.product_id,
          quantity: item.quantity,
          is_active: item.is_active,
        }))
      );
    }

    return NextResponse.json(
      { error: "Failed to save combo items. Previous items were restored where possible." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    comboId,
    message: "Combo updated successfully",
  });
}
