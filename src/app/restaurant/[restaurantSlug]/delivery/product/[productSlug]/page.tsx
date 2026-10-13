import { Suspense } from "react";
import ProductDetailsClient from "../../../product/[productSlug]/ProductDetailsClient";

export const instant = false;

type DeliveryProductPageProps = {
  params: Promise<{
    restaurantSlug: string;
    productSlug: string;
  }>;
};

export default async function DeliveryProductPage({
  params,
}: DeliveryProductPageProps) {
  return (
    <Suspense fallback={<div>Loading delivery product...</div>}>
      <DeliveryProductPageContent params={params} />
    </Suspense>
  );
}

async function DeliveryProductPageContent({
  params,
}: DeliveryProductPageProps) {
  const { restaurantSlug, productSlug } = await params;

  return (
    <ProductDetailsClient
      restaurantSlug={restaurantSlug}
      productSlug={productSlug}
      isDeliveryPage
    />
  );
}
