
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireMenuManager() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized." },
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
    console.error("Menu staff lookup failed:", staffError);

    return {
      error: NextResponse.json(
        { error: "Unable to verify staff access." },
        { status: 500 }
      ),
    };
  }

  if (!staff || !staff.is_active || !staff.restaurant_id) {
    return {
      error: NextResponse.json(
        { error: "Forbidden." },
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
    console.error("Menu restaurant lookup failed:", restaurantError);

    return {
      error: NextResponse.json(
        { error: "Unable to verify restaurant." },
        { status: 500 }
      ),
    };
  }

  if (!restaurant || !restaurant.is_active) {
    return {
      error: NextResponse.json(
        { error: "Restaurant is inactive." },
        { status: 403 }
      ),
    };
  }

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("id, name")
    .eq("id", staff.role_id)
    .maybeSingle();

  if (roleError) {
    console.error("Menu role lookup failed:", roleError);

    return {
      error: NextResponse.json(
        { error: "Unable to verify role." },
        { status: 500 }
      ),
    };
  }

  if (!role) {
    return {
      error: NextResponse.json(
        { error: "Forbidden." },
        { status: 403 }
      ),
    };
  }

  if (role.name !== "OWNER") {
    const { data: permission, error: permissionError } = await admin
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

      return {
        error: NextResponse.json(
          { error: "Unable to verify menu permissions." },
          { status: 500 }
        ),
      };
    }

    if (permission?.access !== "FULL") {
      return {
        error: NextResponse.json(
          {
            error:
              "You do not have permission to manage the menu.",
          },
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateCategoryBody(body: unknown) {
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return { error: "Invalid request body." };
  }

  const value = body as {
    name?: unknown;
    description?: unknown;
  };

  if (typeof value.name !== "string") {
    return { error: "Category name is required." };
  }

  const name = value.name.trim();

  if (!name || name.length > 100) {
    return {
      error:
        "Category name must be between 1 and 100 characters.",
    };
  }

  if (
    value.description != null &&
    (typeof value.description !== "string" ||
      value.description.length > 1000)
  ) {
    return {
      error: "Description must not exceed 1000 characters.",
    };
  }

  const slug = slugify(name);

  if (!slug) {
    return {
      error: "Category name must contain valid characters.",
    };
  }

  return {
    payload: {
      name,
      slug,
      description:
        typeof value.description === "string"
          ? value.description.trim() || null
          : null,
    },
  };
}

function handleDatabaseError(
  error: { code?: string },
  operation: string
) {
  if (error.code === "23505") {
    return NextResponse.json(
      {
        error:
          "A category with this name or slug already exists.",
      },
      { status: 409 }
    );
  }

  console.error(`${operation} failed:`, error);

  return NextResponse.json(
    { error: "Failed to save category." },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  try {
    const auth = await requireMenuManager();

    if ("error" in auth) {
      return auth.error;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const validation = validateCategoryBody(body);

    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { name, slug, description } = validation.payload;

    const { data: lastCategory, error: orderError } =
      await auth.admin
        .from("categories")
        .select("sort_order")
        .eq("restaurant_id", auth.restaurantId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (orderError) {
      console.error(
        "Category order lookup failed:",
        orderError
      );

      return NextResponse.json(
        { error: "Failed to create category." },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await auth.admin
      .from("categories")
      .insert({
        restaurant_id: auth.restaurantId,
        name,
        slug,
        description,
        sort_order: (lastCategory?.sort_order ?? -1) + 1,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return handleDatabaseError(
        error,
        "Category creation"
      );
    }

    return NextResponse.json(
      { category: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Category POST error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireMenuManager();

    if ("error" in auth) {
      return auth.error;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const value = body as {
      categoryId?: unknown;
      name?: unknown;
      description?: unknown;
    };

    const categoryId = Number(value.categoryId);

    if (
      !Number.isSafeInteger(categoryId) ||
      categoryId <= 0
    ) {
      return NextResponse.json(
        { error: "Valid category ID is required." },
        { status: 400 }
      );
    }

    const validation = validateCategoryBody(value);

    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { name, slug, description } = validation.payload;

    const { data, error } = await auth.admin
      .from("categories")
      .update({
        name,
        slug,
        description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", categoryId)
      .eq("restaurant_id", auth.restaurantId)
      .select()
      .maybeSingle();

    if (error) {
      return handleDatabaseError(
        error,
        "Category update"
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Category not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ category: data });
  } catch (error) {
    console.error("Category PATCH error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // Verify the user has permission to manage the menu.
    const auth = await requireMenuManager();

    if ("error" in auth) {
      return auth.error;
    }

    // Read and validate the category ID.
    const { searchParams } = new URL(request.url);
    const categoryId = Number(searchParams.get("id"));

    if (
      !Number.isSafeInteger(categoryId) ||
      categoryId <= 0
    ) {
      return NextResponse.json(
        { error: "Valid category ID is required." },
        { status: 400 }
      );
    }

    // Confirm the category belongs to this restaurant.
    const { data: category, error: categoryError } =
      await auth.admin
        .from("categories")
        .select("id")
        .eq("id", categoryId)
        .eq("restaurant_id", auth.restaurantId)
        .maybeSingle();

    if (categoryError) {
      console.error(
        "Category lookup before deletion failed:",
        categoryError
      );

      return NextResponse.json(
        { error: "Failed to verify category." },
        { status: 500 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: "Category not found." },
        { status: 404 }
      );
    }

    // Prevent deletion while products still use this category.
    const { data: products, error: productsError } =
      await auth.admin
        .from("products")
        .select("id")
        .eq("category_id", categoryId)
        .eq("restaurant_id", auth.restaurantId)
        .limit(1);

    if (productsError) {
      console.error(
        "Product lookup before category deletion failed:",
        productsError
      );

      return NextResponse.json(
        { error: "Failed to check products in this category." },
        { status: 500 }
      );
    }

    if (products && products.length > 0) {
      return NextResponse.json(
        {
          error:
            "This category contains products. Move those products to another category or delete them before deleting this category.",
        },
        { status: 409 }
      );
    }

    // Delete only the category belonging to this restaurant.
    const { error: deleteError } = await auth.admin
      .from("categories")
      .delete()
      .eq("id", categoryId)
      .eq("restaurant_id", auth.restaurantId);

    if (deleteError) {
      console.error(
        "Category deletion failed:",
        deleteError
      );

      if (deleteError.code === "23503") {
        return NextResponse.json(
          {
            error:
              "This category is still being referenced by other records and cannot be deleted.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to delete category." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully.",
      categoryId,
    });
  } catch (error) {
    console.error("Category DELETE error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
