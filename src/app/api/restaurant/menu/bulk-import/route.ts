
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ImportProduct = {
  name: string;
  description: string;
  category: string;
  price: number;
  mrp: number | null;
  vegetarian: boolean;
  available: boolean;
  imageUrl?: string | null;
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCategory(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validateProduct(
  value: unknown
): { product: ImportProduct } | { error: string } {
  if (!isRecord(value)) {
    return { error: "Each product must be an object." };
  }

  const {
    name,
    description,
    category,
    price,
    mrp,
    vegetarian,
    available,
    imageUrl,
  } = value;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 150
  ) {
    return {
      error: "Product names must contain 1–150 characters.",
    };
  }

  if (
    typeof category !== "string" ||
    !category.trim() ||
    category.trim().length > 100
  ) {
    return {
      error: "Category names must contain 1–100 characters.",
    };
  }

  if (
    description !== undefined &&
    typeof description !== "string"
  ) {
    return { error: "Invalid product description." };
  }

  if (
    typeof description === "string" &&
    description.length > 2000
  ) {
    return {
      error: "Product descriptions cannot exceed 2000 characters.",
    };
  }

  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return {
      error: "Product price must be a positive number.",
    };
  }

  if (
    mrp != null &&
    (typeof mrp !== "number" ||
      !Number.isFinite(mrp) ||
      mrp < 0)
  ) {
    return { error: "Invalid product MRP." };
  }

  if (
    typeof vegetarian !== "boolean" ||
    typeof available !== "boolean"
  ) {
    return {
      error: "Vegetarian and availability must be booleans.",
    };
  }

  if (
    imageUrl != null &&
    (typeof imageUrl !== "string" ||
      imageUrl.length > 2048)
  ) {
    return { error: "Invalid product image URL." };
  }

  if (typeof imageUrl === "string" && imageUrl.trim()) {
    try {
      const url = new URL(imageUrl.trim());

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        return {
          error: "Product image URLs must use HTTP or HTTPS.",
        };
      }
    } catch {
      return { error: "Invalid product image URL." };
    }
  }

  return {
    product: {
      name: name.trim(),
      description:
        typeof description === "string" ? description : "",
      category: category.trim(),
      price,
      mrp: mrp == null ? null : mrp,
      vegetarian,
      available,
      imageUrl:
        typeof imageUrl === "string"
          ? imageUrl.trim() || null
          : null,
    },
  };
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // 2. Verify active staff
    const { data: staff, error: staffError } = await admin
      .from("users")
      .select("id, restaurant_id, role_id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (staffError) {
      console.error("Staff lookup failed:", staffError);

      return NextResponse.json(
        { error: "Unable to verify staff access" },
        { status: 500 }
      );
    }

    if (
      !staff ||
      !staff.is_active ||
      !staff.restaurant_id
    ) {
      return NextResponse.json(
        { error: "Active staff account required" },
        { status: 403 }
      );
    }

    // 3. Verify active restaurant
    const { data: restaurant, error: restaurantError } =
      await admin
        .from("restaurants")
        .select("id, is_active")
        .eq("id", staff.restaurant_id)
        .maybeSingle();

    if (restaurantError) {
      console.error(
        "Restaurant lookup failed:",
        restaurantError
      );

      return NextResponse.json(
        { error: "Unable to verify restaurant" },
        { status: 500 }
      );
    }

    if (!restaurant || !restaurant.is_active) {
      return NextResponse.json(
        { error: "Restaurant is inactive" },
        { status: 403 }
      );
    }

    // 4. Verify role and menu permission
    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("name")
      .eq("id", staff.role_id)
      .maybeSingle();

    if (roleError) {
      console.error("Role lookup failed:", roleError);

      return NextResponse.json(
        { error: "Unable to verify staff role" },
        { status: 500 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: "Invalid staff role" },
        { status: 403 }
      );
    }

    if (role.name !== "OWNER") {
      const { data: permission, error: permissionError } =
        await admin
          .from("permissions")
          .select("access")
          .eq("role_id", staff.role_id)
          .eq("module", "menu")
          .maybeSingle();

      if (permissionError) {
        console.error(
          "Menu permission lookup failed:",
          permissionError
        );

        return NextResponse.json(
          { error: "Unable to verify menu permissions" },
          { status: 500 }
        );
      }

      if (!permission || permission.access !== "FULL") {
        return NextResponse.json(
          { error: "Menu management permission required" },
          { status: 403 }
        );
      }
    }

    // 5. Parse and validate the request
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (!isRecord(body) || !Array.isArray(body.products)) {
      return NextResponse.json(
        { error: "A products array is required" },
        { status: 400 }
      );
    }

    if (
      body.products.length === 0 ||
      body.products.length > 500
    ) {
      return NextResponse.json(
        { error: "Provide between 1 and 500 products" },
        { status: 400 }
      );
    }

    const products: ImportProduct[] = [];

    for (let i = 0; i < body.products.length; i++) {
      const result = validateProduct(body.products[i]);

      if ("error" in result) {
        return NextResponse.json(
          {
            error: `Product row ${i + 1}: ${result.error}`,
          },
          { status: 400 }
        );
      }

      products.push(result.product);
    }

    const restaurantId = staff.restaurant_id;

    // 6. Load existing categories for this restaurant
    const { data: existingCategories, error: categoryLoadError } =
      await admin
        .from("categories")
        .select("id, name, sort_order")
        .eq("restaurant_id", restaurantId);

    if (categoryLoadError) {
      console.error(
        "Category load failed:",
        categoryLoadError
      );

      return NextResponse.json(
        { error: "Failed to load existing categories" },
        { status: 500 }
      );
    }

    const categoryMap = new Map<string, number>();

    for (const category of existingCategories ?? []) {
      categoryMap.set(
        normalizeCategory(category.name),
        category.id
      );
    }

    // 7. Find categories missing from the restaurant
    const missingCategories = new Map<string, string>();

    for (const product of products) {
      const key = normalizeCategory(product.category);

      if (!categoryMap.has(key)) {
        missingCategories.set(key, product.category);
      }
    }

    if (missingCategories.size > 0) {
      const maxSortOrder = (
        existingCategories ?? []
      ).reduce(
        (max, category) =>
          Math.max(max, Number(category.sort_order ?? -1)),
        -1
      );

      const now = new Date().toISOString();

      const categoryRows = [
        ...missingCategories.entries(),
      ].map(([key, name], index) => ({
        restaurant_id: restaurantId,
        name,
        slug: slugify(name),
        description: null,
        image_url: null,
        sort_order: maxSortOrder + index + 1,
        is_active: true,
        created_at: now,
        updated_at: now,
        normalized_key: key,
      }));

      // normalized_key is used only to match inserted categories.
      // Remove it before inserting because it is not a DB column.
      const rowsToInsert = categoryRows.map(
        ({ normalized_key: _key, ...row }) => row
      );

      const { data: insertedCategories, error: insertError } =
        await admin
          .from("categories")
          .insert(rowsToInsert)
          .select("id, name");

      if (insertError) {
        console.error(
          "Bulk category creation failed:",
          insertError
        );

        return NextResponse.json(
          {
            error:
              "Failed to create missing categories. Check for existing category slug conflicts.",
          },
          { status: 500 }
        );
      }

      for (const category of insertedCategories ?? []) {
        categoryMap.set(
          normalizeCategory(category.name),
          category.id
        );
      }

      // Ensure every missing category was created or resolved.
      if (
        [...missingCategories.keys()].some(
          (key) => !categoryMap.has(key)
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Some categories could not be resolved. Please check the menu and retry.",
          },
          { status: 500 }
        );
      }
    }

    // 8. Load existing product slugs for this restaurant
    const { data: existingProducts, error: productLoadError } =
      await admin
        .from("products")
        .select("slug")
        .eq("restaurant_id", restaurantId);

    if (productLoadError) {
      console.error(
        "Existing product slug lookup failed:",
        productLoadError
      );

      return NextResponse.json(
        { error: "Failed to prepare product import" },
        { status: 500 }
      );
    }

    const usedSlugs = new Set<string>(
      (existingProducts ?? [])
        .map((product) => product.slug)
        .filter((slug): slug is string => typeof slug === "string")
    );

    // Generate slugs unique within existing products and this batch.
    const productRows = products.map((product) => {
      const categoryId = categoryMap.get(
        normalizeCategory(product.category)
      );

      if (!categoryId) {
        throw new Error(
          `Category could not be resolved: ${product.category}`
        );
      }

      const baseSlug = slugify(product.name);

      if (!baseSlug) {
        throw new Error(
          `Product name cannot produce a valid slug: ${product.name}`
        );
      }

      let slug = baseSlug;
      let suffix = 2;

      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix++}`;
      }

      usedSlugs.add(slug);

      return {
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: product.name,
        slug,
        description: product.description.trim() || null,
        price: product.price,
        mrp: product.mrp,
        image_url: product.imageUrl,
        is_vegetarian: product.vegetarian,
        is_available: product.available,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // 9. Insert products
    const { data: insertedProducts, error: insertProductError } =
      await admin
        .from("products")
        .insert(productRows)
        .select("id");

    if (insertProductError) {
      console.error(
        "Bulk product creation failed:",
        insertProductError
      );

      return NextResponse.json(
        {
          error:
            "Product insertion failed. Any newly created categories may remain; check the menu before retrying.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        count: insertedProducts?.length ?? 0,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Bulk import error:", error);

    return NextResponse.json(
      { error: "Bulk import failed" },
      { status: 500 }
    );
  }
}
