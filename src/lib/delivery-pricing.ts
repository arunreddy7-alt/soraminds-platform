export type DeliveryPricingTier = {
  min_km: number;
  max_km: number | null;
  fee: number;
};

export type DeliveryLocation = {
  latitude: number;
  longitude: number;
};

export function isDeliverySchemaMissingError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "PGRST204"
  );
}

export function getLegacyDeliveryPricing(
  settings: Record<string, unknown>
): {
  maxDistanceKm: number;
  tiers: DeliveryPricingTier[];
} {
  const maxDistanceKm = 10;
  return {
    maxDistanceKm,
    tiers: [
      { min_km: 0, max_km: 3, fee: Number(settings.fee_0_3_km ?? 30) },
      { min_km: 3, max_km: 5, fee: Number(settings.fee_3_5_km ?? 50) },
      { min_km: 5, max_km: null, fee: Number(settings.fee_5_10_km ?? 80) },
    ],
  };
}

export function validateDeliveryTiers(
  tiers: DeliveryPricingTier[],
  maxDistanceKm: number
): string | null {
  if (!Number.isFinite(maxDistanceKm) || maxDistanceKm <= 0) {
    return "Maximum delivery distance must be greater than zero.";
  }

  if (tiers.length === 0) {
    return "Add at least one delivery pricing tier.";
  }

  const ordered = [...tiers].sort((a, b) => a.min_km - b.min_km);

  if (ordered[0].min_km !== 0) {
    return "Pricing tiers must start at 0 km.";
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const tier = ordered[index];
    const next = ordered[index + 1];

    if (
      !Number.isFinite(tier.min_km) ||
      tier.min_km < 0 ||
      !Number.isFinite(tier.fee) ||
      tier.fee < 0 ||
      (tier.max_km !== null &&
        (!Number.isFinite(tier.max_km) || tier.max_km <= tier.min_km))
    ) {
      return "Each pricing tier must have valid distances and a non-negative fee.";
    }

    if (tier.max_km === null) {
      if (next) return "Only the final pricing tier may have no maximum.";
      if (tier.min_km >= maxDistanceKm) {
        return "The final pricing tier must cover some distance before the maximum.";
      }
    } else {
      if (tier.max_km > maxDistanceKm) {
        return "A pricing tier cannot exceed the maximum delivery distance.";
      }
      if (next && tier.max_km !== next.min_km) {
        return "Pricing tiers cannot contain gaps or overlaps.";
      }
    }
  }

  const last = ordered[ordered.length - 1];
  if (last.max_km !== null && last.max_km !== maxDistanceKm) {
    return "Pricing tiers must cover the full maximum delivery distance.";
  }

  return null;
}

export function selectDeliveryTier(
  tiers: DeliveryPricingTier[],
  distanceKm: number,
  maxDistanceKm: number
): DeliveryPricingTier | null {
  if (distanceKm < 0 || distanceKm > maxDistanceKm) return null;

  return (
    [...tiers]
      .sort((a, b) => a.min_km - b.min_km)
      .find(
        (tier) =>
          distanceKm >= tier.min_km &&
          (tier.max_km === null || distanceKm <= tier.max_km)
      ) ?? null
  );
}

export async function calculateGoogleDrivingDistance(
  origin: DeliveryLocation,
  destination: DeliveryLocation
): Promise<{ distanceKm: number; durationSeconds: number | null }> {
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;

  if (!apiKey) {
    throw new Error("Delivery routing is not configured.");
  }

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.latitude,
              longitude: origin.longitude,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Unable to calculate the delivery route.");
  }

  const data = (await response.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
    }>;
  };
  const route = data.routes?.[0];

  if (
    !route ||
    typeof route.distanceMeters !== "number" ||
    !Number.isFinite(route.distanceMeters)
  ) {
    throw new Error("No driving route is available for this address.");
  }

  const durationMatch = route.duration?.match(/^(\d+(?:\.\d+)?)s$/);

  const distanceMeters = route.distanceMeters;

  return {
    distanceKm: distanceMeters / 1000,
    durationSeconds: durationMatch ? Number(durationMatch[1]) : null,
  };
}
