
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

type Permissions = Record<string, PermissionAccess>;

const routePermissions: {
  prefix: string;
  module: string;
}[] = [
  { prefix: "/restaurant/dashboard", module: "dashboard" },
  { prefix: "/restaurant/orders", module: "orders" },
  { prefix: "/restaurant/customers", module: "customers" },
  { prefix: "/restaurant/menu", module: "menu" },
  { prefix: "/restaurant/combos", module: "combos" },
  { prefix: "/restaurant/promotions", module: "promotions" },
  { prefix: "/restaurant/coupons", module: "coupons" },
  { prefix: "/restaurant/tables", module: "tables" },
  { prefix: "/restaurant/qr-codes", module: "qr_codes" },
  { prefix: "/restaurant/reviews", module: "reviews" },
  { prefix: "/restaurant/analytics", module: "analytics" },
  { prefix: "/restaurant/reports", module: "reports" },
  { prefix: "/restaurant/staff", module: "staff" },
  { prefix: "/restaurant/settings", module: "settings" },
];

export default function RestaurantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [permissions, setPermissions] = useState<Permissions>({});
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const response = await fetch("/api/restaurant/me", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            const supabase = createClient();
            await supabase.auth.signOut();

            if (!cancelled) {
              router.replace("/restaurant/login");
            }
            return;
          }

          throw new Error("Unable to verify restaurant access");
        }

        const result = await response.json();

        if (cancelled) return;

        const owner = result.role?.name === "OWNER";
        setIsOwner(owner);

        if (owner) {
          setPermissions({});
        } else {
          const permissionMap: Permissions = {};

          for (const permission of result.permissions ?? []) {
            permissionMap[permission.module] =
              permission.access as PermissionAccess;
          }

          setPermissions(permissionMap);
        }

        setCheckingAuth(false);
      } catch (error) {
        console.error("Restaurant authentication failed:", error);

        if (!cancelled) {
          setCheckingAuth(false);
          router.replace("/restaurant/login");
        }
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (checkingAuth || isOwner) return;

    const matchedRoute = routePermissions.find(
      (route) =>
        pathname === route.prefix ||
        pathname.startsWith(`${route.prefix}/`)
    );

    if (!matchedRoute) return;

    const access = permissions[matchedRoute.module];
    const canView = access === "FULL" || access === "VIEW";

    if (!canView) {
      router.replace("/restaurant/dashboard");
    }
  }, [pathname, permissions, isOwner, checkingAuth, router]);

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
              borderRight: "1px solid #e7e9ed",
            }}
          />
        }
      >
        <RestaurantSidebar
          permissions={permissions}
          isOwner={isOwner}
        />
      </Suspense>

      <div style={{ flex: 1, minWidth: 0 }}>
        <RestaurantHeader />

        <main style={{ padding: "24px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
