import { Suspense } from "react";
import CheckoutClient from "./CheckoutClient";

export const instant = false;
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{
    restaurantSlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { restaurantSlug } = await params;
  const resolvedSearch = await searchParams;
  // Build a stable key from the URL params so Next.js fully remounts
  // CheckoutClient on every navigation, preventing stale submitted=true state
  const pageKey = `${restaurantSlug}-${resolvedSearch.orderType ?? "TAKEAWAY"}-${resolvedSearch.tableId ?? ""}-${resolvedSearch.sessionId ?? ""}`;

  return (
    <Suspense fallback={null}>
      <CheckoutClient key={pageKey} restaurantSlug={restaurantSlug} />
    </Suspense>
  );
}
