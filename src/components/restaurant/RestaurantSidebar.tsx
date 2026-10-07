"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", path: "/restaurant/dashboard" },
      { name: "Orders", path: "/restaurant/orders" },
      { name: "Customers", path: "/restaurant/customers" },
    ],
  },
  {
    label: "Management",
    items: [
      { name: "Menu", path: "/restaurant/menu" },
      { name: "Combos", path: "/restaurant/combos" },
      { name: "Promotions", path: "/restaurant/promotions" },
      { name: "Coupons", path: "/restaurant/coupons" },
      { name: "Tables", path: "/restaurant/tables" },
      { name: "QR Codes", path: "/restaurant/qr-codes" },
      { name: "Reviews", path: "/restaurant/reviews" },
    ],
  },
  {
    label: "Insights",
    items: [
      { name: "Analytics", path: "/restaurant/analytics" },
      { name: "Reports", path: "/restaurant/reports" },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Staff", path: "/restaurant/staff" },
      { name: "Settings", path: "/restaurant/settings" },
    ],
  },
];

export default function RestaurantSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/restaurant/login");
    router.refresh();
  }

  return (
    <aside
      style={{
        width: "240px",
        minHeight: "100vh",
        background: "#ffffff",
        borderRight: "1px solid #e7e9ed",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div
        style={{
          height: "70px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0 20px",
          borderBottom: "1px solid #e7e9ed",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "#111111",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "17px",
            fontWeight: 700,
          }}
        >
          S
        </div>

        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#202228",
              lineHeight: 1.2,
            }}
          >
            Soraminds
          </div>

          <div
            style={{
              fontSize: "11px",
              color: "#858a94",
              marginTop: "3px",
            }}
          >
            Restaurant Admin
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div
        style={{
          flex: 1,
          padding: "18px 12px",
          overflowY: "auto",
        }}
      >
        {navigation.map((section) => (
          <div
            key={section.label}
            style={{
              marginBottom: "22px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#a0a4ab",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "0 10px",
                marginBottom: "7px",
              }}
            >
              {section.label}
            </div>

            {section.items.map((item) => {
              const active = pathname.startsWith(item.path);

              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  style={{
                    width: "100%",
                    border: "none",
                    background: active ? "#f1f2f4" : "transparent",
                    color: active ? "#111111" : "#666b74",
                    borderRadius: "8px",
                    padding: "9px 10px",
                    display: "flex",
                    alignItems: "center",
                    textAlign: "left",
                    fontSize: "13px",
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    marginBottom: "2px",
                  }}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Logout */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid #e7e9ed",
        }}
      >
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            border: "1px solid #e1e3e7",
            background: "#ffffff",
            color: "#555a63",
            borderRadius: "8px",
            padding: "9px 10px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}