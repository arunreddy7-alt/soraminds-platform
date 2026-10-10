
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ couponId: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    // 1. Authenticate the logged-in user.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // 2. Find the authenticated restaurant staff member.
    const { data: staff, error: staffError } = await admin
      .from("users")
      .select("id, restaurant_id, role_id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (staffError) {
      console.error("Staff lookup failed:", staffError);
      return NextResponse.json(
        { error: "Unable to verify staff access." },
        { status: 500 }
      );
    }

    if (!staff || !staff.is_active || !staff.restaurant_id) {
      return NextResponse.json(
        { error: "Forbidden." },
        { status: 403 }
      );
    }

    // 3. Verify that the restaurant is active.
    const { data: restaurant, error: restaurantError } =
      await admin
        .from("restaurants")
        .select("id, is_active")
        .eq("id", staff.restaurant_id)
        .maybeSingle();

    if (restaurantError) {
      console.error("Restaurant lookup failed:", restaurantError);
      return NextResponse.json(
        { error: "Unable to verify restaurant." },
        { status: 500 }
      );
    }

    if (!restaurant || !restaurant.is_active) {
      return NextResponse.json(
        { error: "Restaurant is inactive." },
        { status: 403 }
      );
    }

    // 4. OWNER bypasses the module permission check.
    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("id, name")
      .eq("id", staff.role_id)
      .maybeSingle();

    if (roleError) {
      console.error("Role lookup failed:", roleError);
      return NextResponse.json(
        { error: "Unable to verify role." },
        { status: 500 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: "Forbidden." },
        { status: 403 }
      );
    }

    if (role.name !== "OWNER") {
      const { data: permission, error: permissionError } =
        await admin
          .from("permissions")
          .select("access")
          .eq("role_id", staff.role_id)
          .eq("module", "coupons")
          .maybeSingle();

      if (permissionError) {
        console.error("Permission lookup failed:", permissionError);
        return NextResponse.json(
          { error: "Unable to verify permissions." },
          { status: 500 }
        );
      }

      if (permission?.access !== "FULL") {
        return NextResponse.json(
          {
            error: "You do not have permission to manage coupons.",
          },
          { status: 403 }
        );
      }
    }

    // 5. Validate the coupon ID and requested status.
    const { couponId: rawCouponId } = await params;
    const couponId = Number(rawCouponId);

    if (!Number.isSafeInteger(couponId) || couponId <= 0) {
      return NextResponse.json(
        { error: "Invalid coupon ID." },
        { status: 400 }
      );
    }

    let body: { is_active?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (typeof body.is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active must be true or false." },
        { status: 400 }
      );
    }

    // 6. Update only a coupon belonging to this restaurant.
    const { data: coupon, error: updateError } = await admin
      .from("coupons")
      .update({
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", couponId)
      .eq("restaurant_id", staff.restaurant_id)
      .select("id, is_active")
      .maybeSingle();

    if (updateError) {
      console.error("Coupon status update failed:", updateError);
      return NextResponse.json(
        { error: "Failed to update coupon status." },
        { status: 500 }
      );
    }

    if (!coupon) {
      return NextResponse.json(
        { error: "Coupon not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      coupon,
      message: "Coupon status updated successfully.",
    });
  } catch (error) {
    console.error("Coupon status API error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
