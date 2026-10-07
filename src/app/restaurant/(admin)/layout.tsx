"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RestaurantSidebar from "@/components/restaurant/RestaurantSidebar";
import RestaurantHeader from "@/components/restaurant/RestaurantHeader";

type PermissionAccess = "FULL" | "VIEW" | "NONE";

type Permissions = Record<
  string,
  PermissionAccess
>;

const routePermissions: {
  prefix: string;
  module: string;
}[] = [
  {
    prefix: "/restaurant/dashboard",
    module: "dashboard",
  },
  {
    prefix: "/restaurant/orders",
    module: "orders",
  },
  {
    prefix: "/restaurant/customers",
    module: "customers",
  },
  {
    prefix: "/restaurant/menu",
    module: "menu",
  },
  {
    prefix: "/restaurant/combos",
    module: "combos",
  },
  {
    prefix: "/restaurant/promotions",
    module: "promotions",
  },
  {
    prefix: "/restaurant/coupons",
    module: "coupons",
  },
  {
    prefix: "/restaurant/tables",
    module: "tables",
  },
  {
    prefix: "/restaurant/qr-codes",
    module: "qr_codes",
  },
  {
    prefix: "/restaurant/reviews",
    module: "reviews",
  },
  {
    prefix: "/restaurant/analytics",
    module: "analytics",
  },
  {
    prefix: "/restaurant/reports",
    module: "reports",
  },
  {
    prefix: "/restaurant/staff",
    module: "staff",
  },
  {
    prefix: "/restaurant/settings",
    module: "settings",
  },
];

export default function RestaurantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const [checkingAuth, setCheckingAuth] =
    useState(true);

  const [permissions, setPermissions] =
    useState<Permissions>({});

  const [isOwner, setIsOwner] =
    useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/restaurant/login");
        return;
      }

      const {
        data: restaurantUser,
      } = await supabase
        .from("users")
        .select(
          "id, restaurant_id, role_id, is_active"
        )
        .eq(
          "auth_user_id",
          user.id
        )
        .maybeSingle();

      if (
        !restaurantUser ||
        !restaurantUser.is_active ||
        !restaurantUser.restaurant_id
      ) {
        await supabase.auth.signOut();
        router.replace("/restaurant/login");
        return;
      }

      const {
        data: restaurant,
      } = await supabase
        .from("restaurants")
        .select(
          "id, is_active"
        )
        .eq(
          "id",
          restaurantUser.restaurant_id
        )
        .maybeSingle();

      if (
        !restaurant ||
        !restaurant.is_active
      ) {
        await supabase.auth.signOut();
        router.replace("/restaurant/login");
        return;
      }

      const {
        data: role,
      } = await supabase
        .from("roles")
        .select(
          "id, name"
        )
        .eq(
          "id",
          restaurantUser.role_id
        )
        .maybeSingle();

      if (!role) {
        await supabase.auth.signOut();
        router.replace("/restaurant/login");
        return;
      }

      const owner =
        role.name === "OWNER";

      setIsOwner(owner);

      if (owner) {
        setCheckingAuth(false);
        return;
      }

      const {
        data: permissionRows,
        error: permissionError,
      } = await supabase
        .from("permissions")
        .select(
          "module, access"
        )
        .eq(
          "role_id",
          restaurantUser.role_id
        );

      if (permissionError) {
        console.error(
          "Failed to load permissions:",
          permissionError
        );

        setPermissions({});
      } else {
        const permissionMap: Permissions =
          {};

        for (
          const permission of
            permissionRows || []
        ) {
          permissionMap[
            permission.module
          ] =
            permission.access as PermissionAccess;
        }

        setPermissions(
          permissionMap
        );
      }

      setCheckingAuth(false);
    }

    checkAuth();
  }, [router]);

  /*
   * Protect direct URL access.
   *
   * Sidebar visibility alone is not enough.
   * A staff member shouldn't be able to manually
   * enter a URL for a module they don't have access to.
   */
  useEffect(() => {
    if (checkingAuth) {
      return;
    }

    if (isOwner) {
      return;
    }

    const matchedRoute =
      routePermissions.find(
        (route) =>
          pathname === route.prefix ||
          pathname.startsWith(
            `${route.prefix}/`
          )
      );

    if (!matchedRoute) {
      return;
    }

    const access =
      permissions[
        matchedRoute.module
      ];

    const canView =
      access === "FULL" ||
      access === "VIEW";

    if (!canView) {
      router.replace(
        "/restaurant/dashboard"
      );
    }
  }, [
    pathname,
    permissions,
    isOwner,
    checkingAuth,
    router,
  ]);

  if (checkingAuth) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f6f8",
          color: "#666b74",
          fontSize: "13px",
        }}
      >
        Loading restaurant admin...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#f5f6f8",
      }}
    >
      <Suspense
        fallback={
          <div
            style={{
              width: "240px",
              minHeight: "100vh",
              background: "#ffffff",
              borderRight:
                "1px solid #e7e9ed",
            }}
          />
        }
      >
        <RestaurantSidebar
          permissions={permissions}
          isOwner={isOwner}
        />
      </Suspense>

      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <RestaurantHeader />

        <main
          style={{
            padding: "24px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}