import CartClient from "./CartClient";

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