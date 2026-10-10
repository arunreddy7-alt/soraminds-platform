
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TRANSITIONS: Record<string, string> = {
  NEW: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // 1. Verify the logged-in Supabase user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // 2. Find the active restaurant staff account.
    const { data: staff, error: staffError } = await admin
      .from("users")
      .select("id, restaurant_id, role_id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (
      staffError ||
      !staff ||
      !staff.is_active ||
      !staff.restaurant_id
    ) {
      return NextResponse.json(
        { error: "Active restaurant staff account not found." },
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

    if (
      restaurantError ||
      !restaurant ||
      !restaurant.is_active
    ) {
      return NextResponse.json(
        { error: "Restaurant is inactive or unavailable." },
        { status: 403 }
      );
    }

    // 4. Resolve the staff role.
    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("id, name")
      .eq("id", staff.role_id)
      .maybeSingle();

    if (roleError || !role) {
      return NextResponse.json(
        { error: "Unable to verify staff role." },
        { status: 403 }
      );
    }

    // 5. Only OWNER or staff with orders = FULL may update.
    if (role.name !== "OWNER") {
      const { data: permission, error: permissionError } =
        await admin
          .from("permissions")
          .select("access")
          .eq("role_id", staff.role_id)
          .eq("module", "orders")
          .maybeSingle();

      if (permissionError) {
        return NextResponse.json(
          { error: "Unable to verify order permissions." },
          { status: 500 }
        );
      }

      if (permission?.access !== "FULL") {
        return NextResponse.json(
          {
            error:
              "Forbidden. Full order-management permission is required.",
          },
          { status: 403 }
        );
      }
    }

    // 6. Validate the order ID.
    const { orderId: rawOrderId } = await params;
    const orderId = Number(rawOrderId);

    if (
      !Number.isSafeInteger(orderId) ||
      orderId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid order ID." },
        { status: 400 }
      );
    }

    // 7. Validate the requested status.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("status" in body) ||
      typeof body.status !== "string"
    ) {
      return NextResponse.json(
        { error: "A valid status is required." },
        { status: 400 }
      );
    }

    const newStatus = body.status;

    // 8. Fetch the order within this staff member's restaurant.
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, restaurant_id, status")
      .eq("id", orderId)
      .eq("restaurant_id", staff.restaurant_id)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json(
        { error: "Unable to retrieve order." },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    // 9. Enforce the allowed status sequence.
    const expectedNextStatus =
      ALLOWED_TRANSITIONS[order.status];

    if (
      !expectedNextStatus ||
      newStatus !== expectedNextStatus
    ) {
      return NextResponse.json(
        {
          error: `Invalid status transition. Current status: ${order.status}.`,
        },
        { status: 400 }
      );
    }

    // 10. Update only this restaurant's order.
    const { data: updatedOrder, error: updateError } =
      await admin
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("restaurant_id", staff.restaurant_id)
        .eq("status", order.status)
        .select("id, status, updated_at")
        .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: "Unable to update order status." },
        { status: 500 }
      );
    }

    if (!updatedOrder) {
      return NextResponse.json(
        {
          error:
            "The order changed before your update. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        order: updatedOrder,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Order status update failed:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
