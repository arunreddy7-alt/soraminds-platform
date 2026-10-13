import { Suspense } from "react";
import DeliveryCartClient from "./DeliveryCartClient";

export const instant = false;

type CartPageProps = {
  params: Promise<{
    restaurantSlug: string;
  }>;
};

export default async function DeliveryCartPage({
  params,
}: CartPageProps) {
  const { restaurantSlug } = await params;

  return (
    <Suspense
      fallback={
        <main style={{ padding: 40 }}>
          Loading delivery cart...
        </main>
      }
    >
      <DeliveryCartClient restaurantSlug={restaurantSlug} />
    </Suspense>
  );
}
