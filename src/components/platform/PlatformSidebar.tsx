"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PlatformSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/platform/login");
    router.refresh();
  };

  const navItems = [
    {
      label: "Dashboard",
      path: "/platform",
      exact: true,
    },
    {
      label: "Restaurants",
      path: "/platform/restaurants",
    },
    {
      label: "Restaurant Owners",
      path: "/platform/owners",
    },
    {
      label: "Features",
      path: "/platform/features",
    },
    {
      label: "Analytics",
      path: "/platform/analytics",
    },
  ];

  return (
    <aside
      style={{
        width: "250px",
        minHeight: "100vh",
        background: "#ffffff",
        borderRight: "1px solid #e7e7e7",
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px",
        boxSizing: "border-box",
        flexShrink: 0,
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "11px",
          padding: "4px 10px",
          marginBottom: "36px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "#111111",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            fontWeight: "700",
          }}
        >
          S
        </div>

        <div>
          <div
            style={{
              fontSize: "17px",
              fontWeight: "700",
              color: "#111111",
            }}
          >
            Soraminds
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "#8a8a8a",
              marginTop: "2px",
            }}
          >
            Platform
          </div>
        </div>
      </div>

      {/* Platform section */}
      <div
        style={{
          padding: "0 10px",
          marginBottom: "9px",
          fontSize: "10px",
          fontWeight: "700",
          letterSpacing: "0.08em",
          color: "#999999",
        }}
      >
        PLATFORM
      </div>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.path
            : pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              href={item.path}
              style={{
                display: "flex",
                alignItems: "center",
                minHeight: "42px",
                padding: "0 12px",
                borderRadius: "8px",
                textDecoration: "none",
                color: isActive
                  ? "#ffffff"
                  : "#555555",
                background: isActive
                  ? "#111111"
                  : "transparent",
                fontSize: "14px",
                fontWeight: isActive
                  ? "600"
                  : "500",
                boxSizing: "border-box",
                transition:
                  "all 0.15s ease",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div
        style={{
          marginTop: "auto",
        }}
      >
        <div
          style={{
            height: "1px",
            background: "#eeeeee",
            margin: "20px 10px",
          }}
        />

        <div
          style={{
            padding: "0 10px",
            marginBottom: "9px",
            fontSize: "10px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            color: "#999999",
          }}
        >
          SYSTEM
        </div>

        <Link
          href="/platform/settings"
          style={{
            display: "flex",
            alignItems: "center",
            minHeight: "42px",
            padding: "0 12px",
            borderRadius: "8px",
            textDecoration: "none",
            color: pathname.startsWith(
              "/platform/settings"
            )
              ? "#ffffff"
              : "#555555",
            background: pathname.startsWith(
              "/platform/settings"
            )
              ? "#111111"
              : "transparent",
            fontSize: "14px",
            fontWeight: pathname.startsWith(
              "/platform/settings"
            )
              ? "600"
              : "500",
            boxSizing: "border-box",
          }}
        >
          System Settings
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: "100%",
            minHeight: "42px",
            marginTop: "8px",
            padding: "0 12px",
            border: "none",
            borderRadius: "8px",
            background: "transparent",
            color: "#777777",
            fontSize: "14px",
            fontWeight: "500",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}