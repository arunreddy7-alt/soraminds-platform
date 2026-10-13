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


type RestaurantFeatures = {
  delivery: boolean;
  vip_lounge: boolean;
  bar: boolean;
  live_entertainment: boolean;
};

const DEFAULT_FEATURES: RestaurantFeatures = {
  delivery: false,
  vip_lounge: false,
  bar: false,
  live_entertainment: false,
};

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

const featureRoutes: {
  prefix: string;
  feature: keyof RestaurantFeatures;
}[] = [
  { prefix: "/restaurant/delivery", feature: "delivery" },
  { prefix: "/restaurant/vip-lounge", feature: "vip_lounge" },
  { prefix: "/restaurant/bar", feature: "bar" },
  {
    prefix: "/restaurant/live-entertainment",
    feature: "live_entertainment",
  },
];

function normalizeFeatures(value: unknown): RestaurantFeatures {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return DEFAULT_FEATURES;
  }

  const input = value as Record<string, unknown>;

  return {
    delivery: input.delivery === true,
    vip_lounge: input.vip_lounge === true,
    bar: input.bar === true,
    live_entertainment: input.live_entertainment === true,
  };
}

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
  const [features, setFeatures] =
    useState<RestaurantFeatures>(DEFAULT_FEATURES);

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
          if (
            response.status === 401 ||
            response.status === 403
          ) {
            const supabase = createClient();
            await supabase.auth.signOut();

            if (!cancelled) {
              router.replace("/restaurant/login");
            }

            return;
          }

          throw new Error(
            "Unable to verify restaurant access"
          );
        }

        const result = await response.json();

        if (cancelled) return;

        const owner = result.role?.name === "OWNER";

        setIsOwner(owner);
        setFeatures(
          normalizeFeatures(result.restaurant?.features)
        );

        if (owner) {
          setPermissions({});
        } else {
          const permissionMap: Permissions = {};

          for (const permission of result.permissions ?? []) {
            if (
              typeof permission.module === "string" &&
              ["FULL", "VIEW", "NONE"].includes(
                permission.access
              )
            ) {
              permissionMap[permission.module] =
                permission.access as PermissionAccess;
            }
          }

          setPermissions(permissionMap);
        }

        setCheckingAuth(false);
      } catch (error) {
        console.error(
          "Restaurant authentication failed:",
          error
        );

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
    if (checkingAuth) return;

    // Feature availability applies to owners and staff.
    const matchedFeatureRoute = featureRoutes.find(
      (route) =>
        pathname === route.prefix ||
        pathname.startsWith(`${route.prefix}/`)
    );

    if (
      matchedFeatureRoute &&
      !features[matchedFeatureRoute.feature]
    ) {
      router.replace("/restaurant/dashboard");
      return;
    }

    // Owners bypass staff module permissions,
    // but not disabled feature flags.
    if (isOwner) return;

    const matchedRoute = routePermissions.find(
      (route) =>
        pathname === route.prefix ||
        pathname.startsWith(`${route.prefix}/`)
    );

    if (!matchedRoute) return;

    const access = permissions[matchedRoute.module];
    const canView =
      access === "FULL" || access === "VIEW";

    if (!canView) {
      router.replace("/restaurant/dashboard");
    }
  }, [
    pathname,
    permissions,
    features,
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
              borderRight: "1px solid #e7e9ed",
            }}
          />
        }
      >
        <RestaurantSidebar
          permissions={permissions}
          isOwner={isOwner}
          features={features}
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