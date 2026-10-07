export const instant = false;

import ProductDetailsClient from "./ProductDetailsClient";

export default async function ProductPage({
  params,
}: {
  params: Promise<{
    restaurantSlug: string;
    productSlug: string;
  }>;
}) {
  const {
    restaurantSlug,
    productSlug,
  } = await params;

  return (
    <ProductDetailsClient
      restaurantSlug={restaurantSlug}
      productSlug={productSlug}
    />
  );
}