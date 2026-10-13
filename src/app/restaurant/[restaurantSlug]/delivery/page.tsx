import { Suspense } from "react";
import StorefrontClient from "../StorefrontClient";

type DeliveryPageProps = {
  params: Promise<{
    restaurantSlug: string;
  }>;
};

export default function DeliveryPage({
  params,
}: DeliveryPageProps) {
  return (
    <Suspense fallback={<main>Loading delivery menu...</main>}>
      <DeliveryContent params={params} />
    </Suspense>
  );
}

async function DeliveryContent({
  params,
}: DeliveryPageProps) {
  const { restaurantSlug } = await params;

  return (
    <StorefrontClient restaurantSlug={restaurantSlug} />
  );
}
