
"use client";

import { useCallback, useEffect, useState } from "react";

type DashboardStats = {
  totalRestaurants: number;
  activeRestaurants: number;
  totalOrders: number;
  totalStaff: number;
};

type Restaurant = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

type DashboardData = {
  stats: DashboardStats;
  recentRestaurants: Restaurant[];
};

const initialStats: DashboardStats = {
  totalRestaurants: 0,
  activeRestaurants: 0,
  totalOrders: 0,
  totalStaff: 0,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e7e9ed",
  borderRadius: "12px",
  padding: "22px",
  minWidth: 0,
};

export default function PlatformDashboard() {
  const [data, setData] = useState<DashboardData>({
    stats: initialStats,
    recentRestaurants: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/platform/dashboard", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load dashboard."
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const stats = [
    {
      label: "Total Restaurants",
      value: data.stats.totalRestaurants,
      description: "Registered on the platform",
      icon: "R",
    },
    {
      label: "Active Restaurants",
      value: data.stats.activeRestaurants,
      description: "Currently active",
      icon: "A",
    },
    {
      label: "Total Orders",
      value: data.stats.totalOrders,
      description: "Across all restaurants",
      icon: "O",
    },
    {
      label: "Restaurant Staff",
      value: data.stats.totalStaff,
      description: "Non-owner restaurant accounts",
      icon: "S",
    },
  ];

  return (
    <div
      style={{
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#202228",
      }}
    >
      {/* Page heading */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "28px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "-0.6px",
            }}
          >
            Dashboard
          </h1>

          <p
            style={{
              margin: "7px 0 0",
              color: "#777d87",
              fontSize: "14px",
            }}
          >
            Overview of your Soraminds restaurant platform.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={loading}
          style={{
            padding: "10px 15px",
            border: "1px solid #dedfe3",
            borderRadius: "8px",
            background: "#ffffff",
            color: "#30333a",
            fontSize: "13px",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "14px 16px",
            marginBottom: "22px",
            borderRadius: "9px",
            border: "1px solid #f0caca",
            background: "#fff3f3",
            color: "#a42626",
            fontSize: "13px",
          }}
        >
          <div>{error}</div>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            style={{
              marginTop: "8px",
              padding: 0,
              border: "none",
              background: "transparent",
              color: "#a42626",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Statistics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
          marginBottom: "30px",
        }}
      >
        {stats.map((stat) => (
          <div key={stat.label} style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: "#737984",
                  fontWeight: 500,
                }}
              >
                {stat.label}
              </span>

              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "9px",
                  background: "#f1f2f4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "14px",
                  color: "#353941",
                }}
              >
                {stat.icon}
              </div>
            </div>

            <div
              style={{
                fontSize: "30px",
                lineHeight: 1.2,
                fontWeight: 700,
                letterSpacing: "-0.7px",
              }}
            >
              {loading
                ? "—"
                : stat.value.toLocaleString("en-IN")}
            </div>

            <p
              style={{
                margin: "9px 0 0",
                fontSize: "12px",
                color: "#9297a0",
              }}
            >
              {stat.description}
            </p>
          </div>
        ))}
      </div>

      {/* Recent restaurants */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e7e9ed",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid #eceef1",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            Recently Added Restaurants
          </h2>

          <p
            style={{
              margin: "5px 0 0",
              fontSize: "12px",
              color: "#858a94",
            }}
          >
            The latest restaurants registered on your platform.
          </p>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "13px",
              minWidth: "540px",
            }}
          >
            <thead>
              <tr style={{ background: "#fafbfc" }}>
                {["Restaurant", "Slug", "Status", "Created"].map(
                  (heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "13px 22px",
                        color: "#858a94",
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "1px solid #eceef1",
                      }}
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "35px 22px",
                      textAlign: "center",
                      color: "#858a94",
                    }}
                  >
                    Loading restaurants...
                  </td>
                </tr>
              ) : data.recentRestaurants.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "35px 22px",
                      textAlign: "center",
                      color: "#858a94",
                    }}
                  >
                    No restaurants found.
                  </td>
                </tr>
              ) : (
                data.recentRestaurants.map((restaurant) => (
                  <tr key={restaurant.id}>
                    <td
                      style={{
                        padding: "16px 22px",
                        fontWeight: 600,
                        borderBottom: "1px solid #f0f1f3",
                      }}
                    >
                      {restaurant.name}
                    </td>

                    <td
                      style={{
                        padding: "16px 22px",
                        color: "#777d87",
                        borderBottom: "1px solid #f0f1f3",
                      }}
                    >
                      {restaurant.slug}
                    </td>

                    <td
                      style={{
                        padding: "16px 22px",
                        borderBottom: "1px solid #f0f1f3",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "5px 9px",
                          borderRadius: "20px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: restaurant.is_active
                            ? "#e8f6ed"
                            : "#f1f2f4",
                          color: restaurant.is_active
                            ? "#247744"
                            : "#6c717a",
                        }}
                      >
                        {restaurant.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "16px 22px",
                        color: "#777d87",
                        borderBottom: "1px solid #f0f1f3",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {restaurant.created_at
                        ? new Date(
                            restaurant.created_at
                          ).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
