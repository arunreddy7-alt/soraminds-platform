"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RestaurantInfo = {
  name: string;
  accent_color: string | null;
  is_open: boolean;
  accept_orders: boolean;
};

type UserInfo = {
  full_name: string;
};

export default function RestaurantHeader() {
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    async function loadRestaurant() {
      const supabase = createClient();

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        return;
      }

      const { data: restaurantUser } = await supabase
        .from("users")
        .select("full_name, restaurant_id")
        .eq("auth_user_id", authUser.id)
        .single();

      if (!restaurantUser) {
        return;
      }

      setUser({
        full_name: restaurantUser.full_name,
      });

      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select(
          "name, accent_color, is_open, accept_orders"
        )
        .eq("id", restaurantUser.restaurant_id)
        .single();

      if (restaurantData) {
        setRestaurant(restaurantData);
      }
    }

    loadRestaurant();
  }, []);

  const initials =
    user?.full_name
      ?.split(" ")
      .map((name) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD";

  return (
    <header
      style={{
        height: "70px",
        background: "#ffffff",
        borderBottom: "1px solid #e7e9ed",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 30px",
        flexShrink: 0,
      }}
    >
      <div>
        <div
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "#202228",
          }}
        >
          {restaurant?.name || "Restaurant"}
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#858a94",
            marginTop: "3px",
          }}
        >
          Manage your restaurant
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
      >
        {restaurant && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: "999px",
              fontSize: "12px",
              color: "#555a63",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background:
                  restaurant.is_open && restaurant.accept_orders
                    ? "#22c55e"
                    : "#9ca3af",
              }}
            />

            {restaurant.is_open && restaurant.accept_orders
              ? "Accepting orders"
              : "Not accepting orders"}
          </div>
        )}

        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            background: "#111111",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            fontWeight: 700,
          }}
        >
          {initials}
        </div>

        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#33363c",
          }}
        >
          {user?.full_name || "Admin"}
        </div>
      </div>
    </header>
  );
}