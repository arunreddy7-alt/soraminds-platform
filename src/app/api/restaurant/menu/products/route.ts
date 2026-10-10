
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ProductPayload = {
  productId?: number;
  name?: string;
  description?: string | null;
  category_id?: number;
  price?: number;
  mrp?: number | null;
  image_url?: string | null;
  is_vegetarian?: boolean;
  is_available?: boolean;
};

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
    console.error("Restaurant lookup failed:", restaurantError);
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
    console.error("Role lookup failed:", roleError);
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
      console.error("Permission lookup failed:", permissionError);
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
          { error: "You do not have permission to manage the menu." },
          { status: 403 }
        ),
      };
    }
  }

  return { admin, restaurantId: staff.restaurant_id };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function isProductPayload(value: unknown): value is ProductPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validateProduct(body: ProductPayload) {
  if (typeof body.name !== "string") {
  return { error: "Product name is required." };
}

const name = body.name.trim();

if (name.length === 0 || name.length > 150) {
  return {
    error: "Product name must be between 1 and 150 characters.",
  };
}

if (
  body.description != null &&
  (typeof body.description !== "string" ||
    body.description.length > 2000)
) {
  return { error: "Description must not exceed 2000 characters." };
}
  const categoryId = Number(body.category_id);
  const price = Number(body.price);
  

const mrp =
  body.mrp == null
    ? null
    : Number(body.mrp);



  if (!name) {
    return { error: "Product name is required." };
  }

  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    return { error: "A valid category is required." };
  }

  if (!Number.isFinite(price) || price < 0) {
    return { error: "Price must be a valid non-negative number." };
  }

  if (
    mrp !== null &&
    (!Number.isFinite(mrp) || mrp < 0)
  ) {
    return { error: "MRP must be a valid non-negative number." };
  }

  if (
    typeof body.is_vegetarian !== "boolean" ||
    typeof body.is_available !== "boolean"
  ) {
    return {
      error: "Vegetarian and availability values must be true or false.",
    };
  }

  if (
    body.description != null &&
    typeof body.description !== "string"
  ) {
    return { error: "Invalid product description." };
  }

  if (
    body.image_url != null &&
    typeof body.image_url !== "string"
  ) {
    return { error: "Invalid product image URL." };
  }

  return {
    payload: {
      name,
      slug: slugify(name),
      category_id: categoryId,
      description: body.description?.trim() || null,
      price,
      mrp,
      image_url: body.image_url?.trim() || null,
      is_vegetarian: body.is_vegetarian,
      is_available: body.is_available,
    },
  };
}

async function verifyCategory(
  admin: ReturnType<typeof createAdminClient>,
  categoryId: number,
  restaurantId: number
) {
  const { data, error } = await admin
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    console.error("Category verification failed:", error);
    return { error: "Unable to verify product category.", status: 500 };
  }

  if (!data) {
    return {
      error: "Category not found in your restaurant.",
      status: 400,
    };
  }

  return { data };
}

export async function POST(request: Request) {
  try {
    const auth = await requireMenuManager();

    if ("error" in auth) return auth.error;

    let body: ProductPayload;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }
    
if (!isProductPayload(body)) {
  return NextResponse.json(
    { error: "Request body must be a valid object." },
    { status: 400 }
  );
}


    const validation = validateProduct(body);

    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const categoryCheck = await verifyCategory(
      auth.admin,
      validation.payload.category_id,
      auth.restaurantId
    );

    if ("error" in categoryCheck) {
      return NextResponse.json(
        { error: categoryCheck.error },
        { status: categoryCheck.status }
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await auth.admin
      .from("products")
      .insert({
        restaurant_id: auth.restaurantId,
        ...validation.payload,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error("Product creation failed:", error);
      return NextResponse.json(
        { error: "Failed to create product." },
        { status: 500 }
      );
    }

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    console.error("Product POST error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireMenuManager();

    if ("error" in auth) return auth.error;

    let body: ProductPayload;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }
    
if (!isProductPayload(body)) {
  return NextResponse.json(
    { error: "Request body must be a valid object." },
    { status: 400 }
  );
}


    const productId = Number(body.productId);

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "A valid product ID is required." },
        { status: 400 }
      );
    }

    const validation = validateProduct(body);

    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const categoryCheck = await verifyCategory(
      auth.admin,
      validation.payload.category_id,
      auth.restaurantId
    );

    if ("error" in categoryCheck) {
      return NextResponse.json(
        { error: categoryCheck.error },
        { status: categoryCheck.status }
      );
    }

    const { data, error } = await auth.admin
      .from("products")
      .update({
        ...validation.payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("restaurant_id", auth.restaurantId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Product update failed:", error);
      return NextResponse.json(
        { error: "Failed to update product." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ product: data });
  } catch (error) {
    console.error("Product PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
