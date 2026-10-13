import StorefrontClient from "./StorefrontClient";
import { Suspense } from "react";

export const instant = false;

export default async function RestaurantStorefront({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  return (
    <Suspense fallback={<main>Loading restaurant...</main>}>
      <RestaurantStorefrontContent params={params} />
    </Suspense>
  );
}

async function RestaurantStorefrontContent({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <StorefrontClient restaurantSlug={restaurantSlug} />;
}