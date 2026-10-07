"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RestaurantSidebar from "@/components/restaurant/RestaurantSidebar";
import RestaurantHeader from "@/components/restaurant/RestaurantHeader";

export default function RestaurantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

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

      const { data: restaurantUser } = await supabase
        .from("users")
        .select("id, restaurant_id, role_id, is_active")
        .eq("auth_user_id", user.id)
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

      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id, is_active")
        .eq("id", restaurantUser.restaurant_id)
        .maybeSingle();

      if (!restaurant || !restaurant.is_active) {
        await supabase.auth.signOut();
        router.replace("/restaurant/login");
        return;
      }

      setCheckingAuth(false);
    }

    checkAuth();
  }, [router]);

  if (checkingAuth) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f6f8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#858a94",
          fontSize: "13px",
        }}
      >
        Loading...
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
      {/* Sidebar */}
      <Suspense
        fallback={
          <aside
            style={{
              width: "240px",
              minWidth: "240px",
              minHeight: "100vh",
              background: "#ffffff",
              borderRight: "1px solid #e7e9ed",
            }}
          />
        }
      >
        <RestaurantSidebar />
      </Suspense>

      {/* Main area */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <RestaurantHeader />

        {/* Page */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: "30px",
            boxSizing: "border-box",
            overflowX: "hidden",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}