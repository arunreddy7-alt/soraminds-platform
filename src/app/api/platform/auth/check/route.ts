import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { authorized: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const { data: platformUser, error } = await admin
      .from("platform_users")
      .select("id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Platform eligibility check failed:", error);

      return NextResponse.json(
        { authorized: false, error: "Unable to verify platform access." },
        { status: 500 }
      );
    }

    if (!platformUser || !platformUser.is_active) {
      return NextResponse.json(
        { authorized: false, error: "Platform access denied." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { authorized: true },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error("Platform eligibility check error:", error);

    return NextResponse.json(
      { authorized: false, error: "Unable to verify platform access." },
      { status: 500 }
    );
  }
}
