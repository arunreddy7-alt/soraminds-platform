import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

type QRPageProps = {
  params: Promise<{
    code: string;
  }>;
};


export default async function QRPage({
  params,
}: QRPageProps) {
  const { code } = await params;

  if (!code) {
    redirect("/");
  }

  const supabase = createAdminClient();

  const { data: qr, error: qrError } = await supabase
    .from("qr_codes")
    .select(`
      id,
      restaurant_id,
      table_id,
      code,
      is_active
    `)
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (qrError || !qr) {
    redirect("/");
  }

  const { data: restaurant, error: restaurantError } =
    await supabase
      .from("restaurants")
      .select(`
        id,
        slug,
        name,
        is_active,
        is_open,
        accept_orders
      `)
      .eq("id", qr.restaurant_id)
      .maybeSingle();

  if (
    restaurantError ||
    !restaurant ||
    !restaurant.is_active
  ) {
    redirect("/");
  }

  /*
   * TAKEAWAY QR
   */
  if (qr.table_id === null) {
    redirect(
      `/restaurant/${encodeURIComponent(
        restaurant.slug
      )}?orderType=TAKEAWAY`
    );
  }

  /*
 * TABLE QR
 *
 * Send the customer to the separate Join Table page.
 * They can either start a new table session or
 * join an existing table using the group code.
 */
redirect(
  `/restaurant/${encodeURIComponent(
    restaurant.slug
  )}/join?tableId=${qr.table_id}`
);
}