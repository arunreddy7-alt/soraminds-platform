import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401, headers }
      );
    }

    const admin = createAdminClient();
    const { data: platformUser, error: membershipError } = await admin
      .from("platform_users")
      .select("id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error("Platform membership lookup failed:", membershipError);
      return NextResponse.json(
        { error: "Unable to verify platform access." },
        { status: 500, headers }
      );
    }

    if (!platformUser || !platformUser.is_active) {
      return NextResponse.json(
        { error: "Forbidden." },
        { status: 403, headers }
      );
    }

    const { data: restaurants, error } = await admin
      .from("restaurants")
      .select("id, name, slug, is_active, features, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Platform restaurant list failed:", error);
      return NextResponse.json(
        { error: "Failed to load restaurants." },
        { status: 500, headers }
      );
    }

    return NextResponse.json(
      { restaurants: restaurants ?? [] },
      { headers }
    );
  } catch (error) {
    console.error("Platform restaurant list failed:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500, headers }
    );
  }
}