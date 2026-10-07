"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PlatformHeader() {
  const [name, setName] =
    useState("Platform Owner");

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data: platformUser } =
        await supabase
          .from("platform_users")
          .select("full_name")
          .eq("auth_user_id", user.id)
          .single();

      if (platformUser?.full_name) {
        setName(platformUser.full_name);
      }
    };

    loadUser();
  }, []);

  return (
    <header
      style={{
        minHeight: "76px",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#ffffff",
        borderBottom: "1px solid #e7e7e7",
        boxSizing: "border-box",
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: "700",
            color: "#111111",
          }}
        >
          Soraminds Platform
        </h1>

        <p
          style={{
            margin: "4px 0 0",
            fontSize: "13px",
            color: "#858585",
          }}
        >
          Manage your restaurant platform
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#111111",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>

        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#222222",
            }}
          >
            {name}
          </div>

          <div
            style={{
              marginTop: "2px",
              fontSize: "11px",
              color: "#8a8a8a",
            }}
          >
            Platform Owner
          </div>
        </div>
      </div>
    </header>
  );
}