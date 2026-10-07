// role management for staff

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function getOwnerContext() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const {
    data: currentUser,
  } = await supabase
    .from("users")
    .select(
      "id, restaurant_id, role_id, is_active"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    !currentUser ||
    !currentUser.is_active
  ) {
    return null;
  }

  const { data: role } =
    await supabase
      .from("roles")
      .select("name")
      .eq("id", currentUser.role_id)
      .maybeSingle();

  if (
    !role ||
    role.name !== "OWNER"
  ) {
    return null;
  }

  return {
    currentUser,
  };
}

export async function GET() {
  try {
    const context =
      await getOwnerContext();

    if (!context) {
      return NextResponse.json(
        {
          error:
            "Only the restaurant owner can manage roles.",
        },
        { status: 403 }
      );
    }

    const admin =
      getAdminClient();

    const {
      data,
      error,
    } = await admin
      .from("roles")
      .select(
        "id, name, description, created_at"
      )
      .order("id", {
        ascending: true,
      });

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      roles: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server error.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const context =
      await getOwnerContext();

    if (!context) {
      return NextResponse.json(
        {
          error:
            "Only the restaurant owner can create roles.",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    const name =
      String(
        body.name || ""
      ).trim();

    const description =
      body.description
        ? String(
            body.description
          ).trim()
        : null;

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Role name is required.",
        },
        { status: 400 }
      );
    }

    const admin =
      getAdminClient();

    const {
      data: existing,
    } = await admin
      .from("roles")
      .select("id")
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error:
            "A role with this name already exists.",
        },
        { status: 409 }
      );
    }

    const {
      data,
      error,
    } = await admin
      .from("roles")
      .insert({
        name: name.toUpperCase(),
        description,
        created_at:
          new Date().toISOString(),
      })
      .select(
        "id, name, description, created_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        role: data,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server error.",
      },
      { status: 500 }
    );
  }
}