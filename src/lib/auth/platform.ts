import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requirePlatformOwner() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/platform/login");
  }

  const { data: platformUser, error } =
    await supabase
      .from("platform_users")
      .select(
        "id, full_name, email, is_active, auth_user_id"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (
    error ||
    !platformUser ||
    !platformUser.is_active
  ) {
    await supabase.auth.signOut();

    redirect("/platform/login");
  }

  return {
    authUser: user,
    platformUser,
  };
}