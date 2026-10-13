
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTimestamp } from "@/lib/timezone";
import {
  calculateGoogleDrivingDistance,
  getLegacyDeliveryPricing,
  isDeliverySchemaMissingError,
  selectDeliveryTier,
  validateDeliveryTiers,
  type DeliveryPricingTier,
} from "@/lib/delivery-pricing";

type RequestItem = {
  productId: number;
  variantId: number | null;
  quantity: number;
};

type OrderRequest = {
  restaurantSlug: string;
  customer: {
    name: string;
    phone: string;
    address: string | null;
  };
  orderType: "TAKEAWAY" | "DELIVERY" | "DINE_IN";
  paymentMethod: "CASH" | "UPI";
  couponCode?: string | null;
  items: RequestItem[];
  tableId?: number | null;
  tableSessionId?: number | null;
  delivery?: {
    pincode: string;
    address: string;
    deliveryFee?: number;
    latitude: number;
    longitude: number;
  };
};

export async function POST(request: Request) {
  const supabase = createAdminClient();

  let createdOrderId: number | string | null = null;

  try {
    const body = (await request.json()) as OrderRequest;

    // BASIC VALIDATION
    if (
      !body.restaurantSlug ||
      !body.customer?.name?.trim() ||
      !body.customer?.phone?.trim() ||
      !["TAKEAWAY", "DELIVERY", "DINE_IN"].includes(body.orderType) ||
      !["CASH", "UPI"].includes(body.paymentMethod)
    ) {
      return NextResponse.json(
        { error: "Invalid order details." },
        { status: 400 }
      );
    }

    // DELIVERY VALIDATION
    if (body.orderType === "DELIVERY") {
      const address = body.delivery?.address?.trim();
      const pincode = body.delivery?.pincode?.trim();

      if (!address) {
        return NextResponse.json(
          { error: "A delivery address is required." },
          { status: 400 }
        );
      }

      if (!pincode || !/^\d{6}$/.test(pincode)) {
        return NextResponse.json(
          { error: "Enter a valid 6-digit delivery pincode." },
          { status: 400 }
        );
      }

      if (
        typeof body.delivery?.latitude !== "number" ||
        typeof body.delivery.longitude !== "number" ||
        !Number.isFinite(body.delivery.latitude) ||
        !Number.isFinite(body.delivery.longitude) ||
        body.delivery.latitude < -90 ||
        body.delivery.latitude > 90 ||
        body.delivery.longitude < -180 ||
        body.delivery.longitude > 180
      ) {
        return NextResponse.json(
          { error: "Select a valid delivery location on the map." },
          { status: 400 }
        );
      }
    }

    // DINE-IN VALIDATION
    if (body.orderType === "DINE_IN") {
      if (
        !Number.isInteger(body.tableId) ||
        !Number.isInteger(body.tableSessionId)
      ) {
        return NextResponse.json(
          { error: "A valid table and table session are required." },
          { status: 400 }
        );
      }
    }

    // RESTAURANT
    const {
      data: restaurant,
      error: restaurantError,
    } = await supabase
      .from("restaurants")
      .select("id, is_open, accept_orders")
      .eq("slug", body.restaurantSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (restaurantError) throw restaurantError;

    if (
      !restaurant ||
      !restaurant.is_open ||
      !restaurant.accept_orders
    ) {
      return NextResponse.json(
        { error: "This restaurant is not accepting orders." },
        { status: 409 }
      );
    }

    // DELIVERY SETTINGS
    let deliveryFee = 0;
    const deliveryZoneId: number | null = null;
    let deliveryAddress = "";
    let deliveryPincode = "";
    let verifiedDistanceKm: number | null = null;
    let verifiedRouteDurationSeconds: number | null = null;

    if (body.orderType === "DELIVERY") {
      const initialSettingsResult = await supabase
        .from("restaurant_delivery_settings")
        .select(
          "delivery_fee, minimum_order_amount, free_delivery_minimum, is_enabled, origin_latitude, origin_longitude, max_delivery_distance_km, pricing_tiers"
        )
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();
      let settings: Record<string, unknown> | null =
        initialSettingsResult.data as Record<string, unknown> | null;
      let settingsError = initialSettingsResult.error;

      if (settingsError && isDeliverySchemaMissingError(settingsError)) {
        const legacyResult = await supabase
          .from("restaurant_delivery_settings")
          .select(
            "delivery_fee, minimum_order_amount, free_delivery_minimum, is_enabled, origin_latitude, origin_longitude, fee_0_3_km, fee_3_5_km, fee_5_10_km"
          )
          .eq("restaurant_id", restaurant.id)
          .maybeSingle();
        settings = legacyResult.data as Record<string, unknown> | null;
        settingsError = legacyResult.error;
        if (settings) {
          const legacyPricing = getLegacyDeliveryPricing(settings);
          settings = {
            ...settings,
            max_delivery_distance_km: legacyPricing.maxDistanceKm,
            pricing_tiers: legacyPricing.tiers,
          };
        }
      }

      if (settingsError) throw settingsError;

      if (!settings || !settings.is_enabled) {
        return NextResponse.json(
          { error: "Delivery is currently unavailable." },
          { status: 409 }
        );
      }

      deliveryAddress = body.delivery!.address.trim();
      deliveryPincode = body.delivery!.pincode.trim();
      const originLatitude = Number(settings.origin_latitude);
      const originLongitude = Number(settings.origin_longitude);

      if (
        !Number.isFinite(originLatitude) ||
        !Number.isFinite(originLongitude)
      ) {
        return NextResponse.json(
          { error: "This restaurant has not configured a delivery location." },
          { status: 409 }
        );
      }

      const maxDistanceKm = Number(settings.max_delivery_distance_km);
      const tiers = (settings.pricing_tiers ?? []) as DeliveryPricingTier[];
      const tierError = validateDeliveryTiers(tiers, maxDistanceKm);

      if (tierError) {
        return NextResponse.json(
          { error: "The restaurant delivery pricing is not configured correctly." },
          { status: 409 }
        );
      }

      const route = await calculateGoogleDrivingDistance(
        {
          latitude: originLatitude,
          longitude: originLongitude,
        },
        {
          latitude: body.delivery!.latitude,
          longitude: body.delivery!.longitude,
        }
      );
      const tier = selectDeliveryTier(
        tiers,
        route.distanceKm,
        maxDistanceKm
      );

      if (!tier) {
        return NextResponse.json(
          {
            error: `This address is outside the ${maxDistanceKm} km delivery radius.`,
          },
          { status: 422 }
        );
      }

      deliveryFee = tier.fee;
      verifiedDistanceKm = route.distanceKm;
      verifiedRouteDurationSeconds = route.durationSeconds;
    }

    // BUILD CART QUANTITIES
    // Dine-in orders use the server-side shared table cart.
    // Takeaway and delivery use the submitted cart item IDs.
    const quantities = new Map<string, RequestItem>();

    if (body.orderType === "DINE_IN") {
      const {
        data: session,
        error: sessionError,
      } = await supabase
        .from("table_sessions")
        .select("id, restaurant_id, table_id, status")
        .eq("id", body.tableSessionId!)
        .eq("restaurant_id", restaurant.id)
        .eq("table_id", body.tableId!)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (sessionError) throw sessionError;

      if (!session) {
        return NextResponse.json(
          { error: "This table session is no longer active." },
          { status: 409 }
        );
      }

      const {
        data: sharedItems,
        error: sharedItemsError,
      } = await supabase
        .from("table_session_items")
        .select(
          "id, product_id, variant_id, combo_id, quantity, unit_price"
        )
        .eq("table_session_id", session.id);

      if (sharedItemsError) throw sharedItemsError;

      if (!sharedItems || sharedItems.length === 0) {
        return NextResponse.json(
          { error: "The shared table cart is empty." },
          { status: 400 }
        );
      }

      for (const item of sharedItems) {
        const key = `${item.product_id}:${item.variant_id ?? "null"}`;
        const existing = quantities.get(key);

        if (existing) {
          existing.quantity += item.quantity;
        } else {
          quantities.set(key, {
            productId: item.product_id,
            variantId: item.variant_id,
            quantity: item.quantity,
          });
        }
      }
    } else {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json(
          { error: "Your cart is empty." },
          { status: 400 }
        );
      }

      for (const item of body.items) {
        if (
          !Number.isInteger(item.productId) ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 20 ||
          (item.variantId !== null &&
            !Number.isInteger(item.variantId))
        ) {
          return NextResponse.json(
            { error: "Invalid cart item." },
            { status: 400 }
          );
        }

        const key = `${item.productId}:${item.variantId ?? "null"}`;
        const existing = quantities.get(key);

        if (existing) {
          existing.quantity += item.quantity;
        } else {
          quantities.set(key, { ...item });
        }
      }
    }

    // PRODUCT IDS
    const productIds = Array.from(
      new Set(
        Array.from(quantities.values()).map(
          (item) => item.productId
        )
      )
    );

    // PRODUCTS
    const {
      data: products,
      error: productsError,
    } = await supabase
      .from("products")
      .select("id, price, is_active, is_available")
      .eq("restaurant_id", restaurant.id)
      .in("id", productIds);

    if (productsError) throw productsError;

    if (
      !products ||
      products.length !== productIds.length ||
      products.some(
        (product) => !product.is_active || !product.is_available
      )
    ) {
      return NextResponse.json(
        { error: "One or more cart items are unavailable." },
        { status: 409 }
      );
    }

    // VARIANTS
    const {
      data: variants,
      error: variantsError,
    } = await supabase
      .from("product_variants")
      .select("id, product_id, price, is_active, is_available")
      .in("product_id", productIds);

    if (variantsError) throw variantsError;

    const variantMap = new Map(
      (variants || []).map((variant) => [variant.id, variant])
    );

    // BUILD ORDER ITEMS USING DATABASE PRICES
    const orderItems: Array<{
      product_id: number;
      variant_id: number | null;
      combo_id: number | null;
      quantity: number;
      unit_price: number;
      menu_discount: number;
      total_price: number;
    }> = [];

    let subtotal = 0;

    for (const item of quantities.values()) {
      const product = products.find(
        (entry) => entry.id === item.productId
      );

      const variant =
        item.variantId !== null
          ? variantMap.get(item.variantId)
          : null;

      if (
        !product ||
        (item.variantId !== null &&
          (!variant ||
            variant.product_id !== item.productId ||
            !variant.is_active ||
            !variant.is_available))
      ) {
        return NextResponse.json(
          { error: "One or more cart items are unavailable." },
          { status: 409 }
        );
      }

      const unitPrice = Number(variant?.price ?? product.price);

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error("Invalid product price.");
      }

      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        product_id: item.productId,
        variant_id: item.variantId,
        combo_id: null,
        quantity: item.quantity,
        unit_price: unitPrice,
        menu_discount: 0,
        total_price: totalPrice,
      });
    }

    // DELIVERY MINIMUM ORDER AND FREE DELIVERY
    if (body.orderType === "DELIVERY") {
      const {
        data: settings,
        error: settingsError,
      } = await supabase
        .from("restaurant_delivery_settings")
        .select("minimum_order_amount, free_delivery_minimum")
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      const minimumOrder = Number(
        settings?.minimum_order_amount ?? 0
      );

      if (subtotal < minimumOrder) {
        return NextResponse.json(
          {
            error: `The minimum delivery order is ₹${minimumOrder}.`,
            minimumOrder,
          },
          { status: 400 }
        );
      }

      const freeDeliveryMinimum =
        settings?.free_delivery_minimum == null
          ? null
          : Number(settings.free_delivery_minimum);

      if (
        freeDeliveryMinimum !== null &&
        subtotal >= freeDeliveryMinimum
      ) {
        deliveryFee = 0;
      }
    }

    // COUPON
    let couponDiscount = 0;
    let couponId: number | null = null;

    if (body.couponCode?.trim()) {
      const {
        data: coupon,
        error: couponError,
      } = await supabase
        .from("coupons")
        .select(
          "id, code, discount_type, discount_value, min_order_amount, max_discount, start_at, end_at, usage_limit, used_count, is_active"
        )
        .eq("restaurant_id", restaurant.id)
        .eq("code", body.couponCode.trim().toUpperCase())
        .maybeSingle();

      if (couponError) throw couponError;

      const now = Date.now();

      const startAt = parseTimestamp(coupon?.start_at);
      const endAt = parseTimestamp(coupon?.end_at);

      if (
        !coupon ||
        !coupon.is_active ||
        !startAt ||
        !endAt ||
        now < startAt.getTime() ||
        now > endAt.getTime() ||
        (coupon.usage_limit !== null &&
          coupon.used_count >= coupon.usage_limit) ||
        subtotal < Number(coupon.min_order_amount || 0)
      ) {
        return NextResponse.json(
          { error: "This coupon is invalid or no longer available." },
          { status: 409 }
        );
      }

      couponDiscount =
        coupon.discount_type === "percentage"
          ? (subtotal * Number(coupon.discount_value)) / 100
          : Number(coupon.discount_value);

      if (coupon.max_discount !== null) {
        couponDiscount = Math.min(
          couponDiscount,
          Number(coupon.max_discount)
        );
      }

      couponDiscount = Math.min(couponDiscount, subtotal);
      couponId = coupon.id;
    }

    // FINAL TOTAL
    const total = subtotal - couponDiscount + deliveryFee;

    // CUSTOMER
    const customerResult = await supabase
      .from("customers")
      .select("id")
      .eq("phone", body.customer.phone.trim())
      .maybeSingle();

    if (customerResult.error) throw customerResult.error;
    let customer = customerResult.data;

    if (customer) {
      const { error } = await supabase
        .from("customers")
        .update({
          full_name: body.customer.name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", customer.id);

      if (error) throw error;
    } else {
      const result = await supabase
        .from("customers")
        .insert({
          full_name: body.customer.name.trim(),
          phone: body.customer.phone.trim(),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (result.error) throw result.error;
      customer = result.data;
    }

    if (!customer) {
      throw new Error("Unable to create or retrieve customer.");
    }

    // CREATE ORDER
    const orderTimestamp = new Date().toISOString();

    const {
      data: order,
      error: orderError,
    } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        customer_id: customer.id,
        order_type: body.orderType,

        table_id:
          body.orderType === "DINE_IN" ? body.tableId : null,

        table_session_id:
          body.orderType === "DINE_IN"
            ? body.tableSessionId
            : null,

        status: "NEW",
        subtotal,
        menu_discount: 0,
        coupon_discount: couponDiscount,
        tax_amount: 0,
        service_charge: 0,
        packaging_charge: 0,
        delivery_fee: body.orderType === "DELIVERY" ? deliveryFee : 0,
        total,
        payment_status: "PENDING",
        payment_method: body.paymentMethod,
        created_at: orderTimestamp,
        updated_at: orderTimestamp,
      })
      .select("id")
      .single();

    if (orderError) throw orderError;

    createdOrderId = order.id;

    // INSERT ORDER ITEMS
    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(
        orderItems.map((item) => ({
          ...item,
          order_id: order.id,
          created_at: orderTimestamp,
        }))
      );

    if (itemsError) throw itemsError;

    // CREATE DELIVERY RECORD
    if (body.orderType === "DELIVERY") {
      const deliveryPayload = {
        order_id: order.id,
        restaurant_id: restaurant.id,
        delivery_zone_id: deliveryZoneId,
        recipient_name: body.customer.name.trim(),
        recipient_phone: body.customer.phone.trim(),
        delivery_address: deliveryAddress,
        pincode: deliveryPincode,
        delivery_latitude: body.delivery?.latitude ?? null,
        delivery_longitude: body.delivery?.longitude ?? null,
        distance_km: verifiedDistanceKm,
        route_duration_seconds: verifiedRouteDurationSeconds,
        delivery_status: "PENDING",
      };
      let { error: deliveryError } = await supabase
        .from("order_deliveries")
        .insert(deliveryPayload);

      if (deliveryError && isDeliverySchemaMissingError(deliveryError)) {
        const legacyDeliveryPayload = Object.fromEntries(
          Object.entries(deliveryPayload).filter(
            ([key]) =>
              ![
                "delivery_latitude",
                "delivery_longitude",
                "distance_km",
                "route_duration_seconds",
              ].includes(key)
          )
        );
        ({ error: deliveryError } = await supabase
          .from("order_deliveries")
          .insert(legacyDeliveryPayload));
      }

      if (deliveryError) throw deliveryError;
    }

    // COUPON USAGE
    if (couponId !== null) {
      const { data: coupon, error: couponReadError } =
        await supabase
          .from("coupons")
          .select("used_count")
          .eq("id", couponId)
          .single();

      if (couponReadError) throw couponReadError;

      const { error: couponUpdateError } = await supabase
        .from("coupons")
        .update({
          used_count: Number(coupon?.used_count || 0) + 1,
        })
        .eq("id", couponId);

      if (couponUpdateError) throw couponUpdateError;
    }

    // CLEAR SHARED TABLE CART AFTER ORDER CREATION
    if (body.orderType === "DINE_IN") {
      const { error: clearCartError } = await supabase
        .from("table_session_items")
        .delete()
        .eq("table_session_id", body.tableSessionId!);

      if (clearCartError) throw clearCartError;
    }

    // SUCCESS
    createdOrderId = null;

    return NextResponse.json({
      orderId: order.id,
      subtotal,
      couponDiscount,
      deliveryFee,
      total,
    });
  } catch (error) {
    console.error("Customer order error:", error);

    // Best-effort cleanup if order creation failed partway through.
    if (createdOrderId !== null) {
      await supabase
        .from("order_deliveries")
        .delete()
        .eq("order_id", createdOrderId);

      await supabase
        .from("order_items")
        .delete()
        .eq("order_id", createdOrderId);

      await supabase
        .from("orders")
        .delete()
        .eq("id", createdOrderId);
    }

    return NextResponse.json(
      { error: "Unable to place order." },
      { status: 500 }
    );
  }
}
