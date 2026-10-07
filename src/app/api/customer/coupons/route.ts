import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase();
    const restaurantSlug = String(body.restaurantSlug || "");
    const subtotal = Number(body.subtotal);

    if (!code || !restaurantSlug || !Number.isFinite(subtotal)) {
      return NextResponse.json(
        { error: "Coupon details are invalid." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", restaurantSlug)
      .eq("is_active", true)
      .maybeSingle();
    if (restaurantError) throw restaurantError;
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    const { data: coupon, error: couponError } = await supabase
      .from("coupons")
      .select(
        "id, code, discount_type, discount_value, min_order_amount, max_discount, start_at, end_at, usage_limit, used_count, is_active"
      )
      .eq("restaurant_id", restaurant.id)
      .eq("code", code)
      .maybeSingle();
    if (couponError) throw couponError;

    const now = Date.now();
    if (
      !coupon ||
      !coupon.is_active ||
      now < new Date(coupon.start_at).getTime() ||
      now > new Date(coupon.end_at).getTime() ||
      (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) ||
      subtotal < Number(coupon.min_order_amount || 0)
    ) {
      return NextResponse.json(
        { error: "This coupon is invalid or unavailable for this order." },
        { status: 409 }
      );
    }

    let discount =
      coupon.discount_type === "percentage"
        ? (subtotal * Number(coupon.discount_value)) / 100
        : Number(coupon.discount_value);
    if (coupon.max_discount !== null) {
      discount = Math.min(discount, Number(coupon.max_discount));
    }

    return NextResponse.json({
      code: coupon.code,
      discount: Math.min(discount, subtotal),
    });
  } catch (error) {
    console.error("Customer coupon error:", error);
    return NextResponse.json(
      { error: "Unable to validate coupon." },
      { status: 500 }
    );
  }
}
