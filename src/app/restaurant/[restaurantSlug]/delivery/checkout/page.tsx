import { Suspense } from "react";
import DeliveryCheckoutClient from "./DeliveryCheckoutClient";

type PageProps = {
  params: Promise<{
    restaurantSlug: string;
  }>;
};

export default function DeliveryCheckoutPage({
  params,
}: PageProps) {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 30 }}>
          Loading checkout...
        </main>
      }
    >
      <DeliveryCheckoutContent params={params} />
    </Suspense>
  );
}

async function DeliveryCheckoutContent({
  params,
}: PageProps) {
  const { restaurantSlug } = await params;

  return (
    <DeliveryCheckoutClient
      restaurantSlug={restaurantSlug}
    />
  );
}
