import CheckoutClient from "./CheckoutClient";

export const instant = false;

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{
    restaurantSlug: string;
  }>;
}) {
  const { restaurantSlug } = await params;

  return <CheckoutClient restaurantSlug={restaurantSlug} />;
}
