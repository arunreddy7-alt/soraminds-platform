import CartClient from "./CartClient";

export const instant = false;

export default async function CartPage({
  params,
}: {
  params: Promise<{
    restaurantSlug: string;
  }>;
}) {
  const { restaurantSlug } = await params;

  return (
    <CartClient
      restaurantSlug={restaurantSlug}
    />
  );
}