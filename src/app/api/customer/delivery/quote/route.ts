import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateGoogleDrivingDistance,
  getLegacyDeliveryPricing,
  isDeliverySchemaMissingError,
  selectDeliveryTier,
  validateDeliveryTiers,
  type DeliveryPricingTier,
} from "@/lib/delivery-pricing";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      restaurantSlug?: string;
      latitude?: number;
      longitude?: number;
    };

    if (
      !body.restaurantSlug ||
      typeof body.latitude !== "number" ||
      typeof body.longitude !== "number" ||
      !Number.isFinite(body.latitude) ||
      !Number.isFinite(body.longitude) ||
      body.latitude < -90 ||
      body.latitude > 90 ||
      body.longitude < -180 ||
      body.longitude > 180
    ) {
      return NextResponse.json(
        { error: "A valid restaurant and delivery location are required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, is_active")
      .eq("slug", body.restaurantSlug)
      .maybeSingle();

    if (restaurantError) throw restaurantError;
    if (!restaurant || !restaurant.is_active) {
      return NextResponse.json(
        { error: "Restaurant not found." },
        { status: 404 }
      );
    }

    const initialSettingsResult = await supabase
      .from("restaurant_delivery_settings")
      .select(
        "is_enabled, origin_latitude, origin_longitude, max_delivery_distance_km, pricing_tiers"
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
          "is_enabled, origin_latitude, origin_longitude, fee_0_3_km, fee_3_5_km, fee_5_10_km"
        )
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();
      settings = legacyResult.data as Record<string, unknown> | null;
      settingsError = legacyResult.error;
      if (settings) {
        const legacyPricing = getLegacyDeliveryPricing(
          settings
        );
        settings = {
          ...settings,
          max_delivery_distance_km: legacyPricing.maxDistanceKm,
          pricing_tiers: legacyPricing.tiers,
        };
      }
    }

    if (settingsError) throw settingsError;
    const originLatitude = Number(settings?.origin_latitude);
    const originLongitude = Number(settings?.origin_longitude);

    if (
      !settings?.is_enabled ||
      !Number.isFinite(originLatitude) ||
      !Number.isFinite(originLongitude)
    ) {
      return NextResponse.json(
        { error: "This restaurant has not configured delivery routing." },
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
        latitude: body.latitude,
        longitude: body.longitude,
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
          distanceKm: route.distanceKm,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      distanceKm: Number(route.distanceKm.toFixed(3)),
      durationSeconds: route.durationSeconds,
      deliveryFee: tier.fee,
      tier,
    });
  } catch (error) {
    console.error("Delivery quote error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate delivery distance.",
      },
      { status: 503 }
    );
  }
}
