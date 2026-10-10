
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type CouponPayload = {
  couponId?: number;
  code?: string;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  min_order_amount?: number;
  max_discount?: number | null;
  start_at?: string;
  end_at?: string;
  usage_limit?: number | null;
};

async function requireCouponManager() {
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
    console.error("Coupon staff lookup failed:", staffError);
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
    console.error("Coupon restaurant lookup failed:", restaurantError);
    return {
      error: NextResponse.json(
        { error: "Unable to verify restaurant access." },
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
    console.error("Coupon role lookup failed:", roleError);
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
      .eq("module", "coupons")
      .maybeSingle();

    if (permissionError) {
      console.error("Coupon permission lookup failed:", permissionError);
      return {
        error: NextResponse.json(
          { error: "Unable to verify coupon permissions." },
          { status: 500 }
        ),
      };
    }

    if (permission?.access !== "FULL") {
      return {
        error: NextResponse.json(
          { error: "You do not have permission to manage coupons." },
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

function validateCoupon(body: CouponPayload) {
  const code = body.code?.trim().toUpperCase();
  const discountType = body.discount_type;
  const discountValue = Number(body.discount_value);
  const minimumOrder = Number(body.min_order_amount);
  const maximumDiscount =
    body.max_discount === null || body.max_discount === undefined
      ? null
      : Number(body.max_discount);
  const usageLimit =
    body.usage_limit === null || body.usage_limit === undefined
      ? null
      : Number(body.usage_limit);

  const startDate = new Date(body.start_at ?? "");
  const endDate = new Date(body.end_at ?? "");

  if (!code) {
    return { error: "Coupon code is required." };
  }

  if (
    discountType !== "percentage" &&
    discountType !== "fixed"
  ) {
    return { error: "Invalid discount type." };
  }

  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { error: "Discount value must be greater than zero." };
  }

  if (discountType === "percentage" && discountValue > 100) {
    return { error: "Percentage discount cannot exceed 100%." };
  }

  if (
    !Number.isFinite(minimumOrder) ||
    minimumOrder < 0
  ) {
    return { error: "Minimum order amount cannot be negative." };
  }

  if (discountType === "percentage") {
    if (
      maximumDiscount !== null &&
      (!Number.isFinite(maximumDiscount) || maximumDiscount <= 0)
    ) {
      return {
        error: "Maximum discount must be greater than zero.",
      };
    }
  } else if (maximumDiscount !== null) {
    return {
      error: "Maximum discount is only applicable to percentage coupons.",
    };
  }

  if (
    !body.start_at ||
    !body.end_at ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return { error: "Valid start and end dates are required." };
  }

  if (endDate <= startDate) {
    return { error: "End date must be after the start date." };
  }

  if (
    usageLimit !== null &&
    (!Number.isInteger(usageLimit) || usageLimit <= 0)
  ) {
    return {
      error: "Usage limit must be a positive whole number.",
    };
  }

  return {
    payload: {
      code,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minimumOrder,
      max_discount: maximumDiscount,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      usage_limit: usageLimit,
    },
  };
}

export async function POST(request: Request) {
  try {
    const auth = await requireCouponManager();

    if ("error" in auth) {
      return auth.error;
    }

    let body: CouponPayload;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const validation = validateCoupon(body);

    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await auth.admin
      .from("coupons")
      .insert({
        restaurant_id: auth.restaurantId,
        ...validation.payload,
        used_count: 0,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A coupon with this code already exists." },
          { status: 409 }
        );
      }

      console.error("Coupon creation failed:", error);

      return NextResponse.json(
        { error: "Failed to create coupon." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { coupon: data, message: "Coupon created successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Coupon POST error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireCouponManager();

    if ("error" in auth) {
      return auth.error;
    }

    let body: CouponPayload;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const couponId = Number(body.couponId);

    if (!Number.isSafeInteger(couponId) || couponId <= 0) {
      return NextResponse.json(
        { error: "A valid coupon ID is required." },
        { status: 400 }
      );
    }

    const validation = validateCoupon(body);

    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { data: existingCoupon, error: existingError } =
      await auth.admin
        .from("coupons")
        .select("id, used_count")
        .eq("id", couponId)
        .eq("restaurant_id", auth.restaurantId)
        .maybeSingle();

    if (existingError) {
      console.error("Coupon lookup failed:", existingError);

      return NextResponse.json(
        { error: "Failed to verify coupon." },
        { status: 500 }
      );
    }

    if (!existingCoupon) {
      return NextResponse.json(
        { error: "Coupon not found." },
        { status: 404 }
      );
    }

    if (
      validation.payload.usage_limit !== null &&
      validation.payload.usage_limit < existingCoupon.used_count
    ) {
      return NextResponse.json(
        {
          error: `Usage limit cannot be lower than the current used count (${existingCoupon.used_count}).`,
        },
        { status: 400 }
      );
    }

    const { data, error } = await auth.admin
      .from("coupons")
      .update({
        ...validation.payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", couponId)
      .eq("restaurant_id", auth.restaurantId)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A coupon with this code already exists." },
          { status: 409 }
        );
      }

      console.error("Coupon update failed:", error);

      return NextResponse.json(
        { error: "Failed to update coupon." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Coupon not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      coupon: data,
      message: "Coupon updated successfully.",
    });
  } catch (error) {
    console.error("Coupon PATCH error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
