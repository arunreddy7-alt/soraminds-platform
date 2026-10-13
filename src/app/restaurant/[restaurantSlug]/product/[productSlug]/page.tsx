
import { Suspense } from "react";
import ProductDetailsClient from "./ProductDetailsClient";

type ProductPageProps = {
  params: Promise<{
    restaurantSlug: string;
    productSlug: string;
  }>;
};

export default async function ProductPage({
  params,
}: ProductPageProps) {
  const { restaurantSlug, productSlug } = await params;

  return (
    <Suspense fallback={<div>Loading product...</div>}>
      <ProductDetailsClient
        restaurantSlug={restaurantSlug}
        productSlug={productSlug}
      />
    </Suspense>
  );
}
