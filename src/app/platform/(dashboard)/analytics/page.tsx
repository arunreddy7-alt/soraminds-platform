
"use client";

import { useCallback, useEffect, useState } from "react";

type AnalyticsData = {
  summary: {
    totalRestaurants: number;
    activeRestaurants: number;
    ordersLast30Days: number;
  };
  dailyOrders: { date: string; count: number }[];
  statusCounts: Record<string, number>;
  restaurantPerformance: {
    id: number;
    name: string;
    isActive: boolean;
    orders: number;
  }[];
};

const cardStyle = {
  background: "#fff",
  border: "1px solid #e8eaf0",
  borderRadius: "12px",
  padding: "22px",
};

export default function PlatformAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/platform/analytics", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load analytics");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const maxOrders = Math.max(
    1,
    ...(data?.dailyOrders.map((day) => day.count) ?? [])
  );

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 26,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28, color: "#202228" }}>
            Analytics
          </h1>
          <p style={{ margin: "8px 0 0", color: "#777d87" }}>
            Platform-wide performance over the last 30 days.
          </p>
        </div>

        <button
          onClick={() => void loadAnalytics()}
          disabled={loading}
          style={{
            border: "1px solid #dedfe5",
            borderRadius: 8,
            background: "#fff",
            padding: "10px 16px",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Refreshing..." : "Refresh data"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: "#fff1f0",
            color: "#b42318",
            marginBottom: 20,
          }}
        >
          {error}
          <button
            onClick={() => void loadAnalytics()}
            style={{ marginLeft: 12 }}
          >
            Try again
          </button>
        </div>
      )}

      {loading && !data ? (
        <p style={{ color: "#777d87" }}>Loading platform analytics...</p>
      ) : data ? (
        <>
          <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 16,
    marginBottom: 24,
  }}
>
  <StatCard
    label="Total Restaurants"
    value={data.summary.totalRestaurants}
    icon=""
  />
  <StatCard
    label="Active Restaurants"
    value={data.summary.activeRestaurants}
    icon=""
  />
  <StatCard
    label="Total Orders"
    value={data.summary.ordersLast30Days}
    icon=""
    subtitle="Last 30 days"
  />
  <StatCard
    label="Restaurants With Orders"
    value={data.restaurantPerformance.filter((r) => r.orders > 0).length}
    icon=""
  />
</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
              marginBottom: 24,
            }}
          >
            <section style={cardStyle}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>
                Daily Orders
              </h2>
              <p style={{ margin: "0 0 24px", color: "#777d87", fontSize: 13 }}>
                Order volume for the past 30 days
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "end",
                  gap: 4,
                  height: 180,
                  overflowX: "auto",
                  paddingTop: 10,
                }}
              >
                {data.dailyOrders.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} orders`}
                    style={{
                      minWidth: 5,
                      flex: 1,
                      height: `${Math.max(4, (day.count / maxOrders) * 100)}%`,
                      background: "#6558d3",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#777d87",
                  fontSize: 12,
                  marginTop: 10,
                }}
              >
                <span>{data.dailyOrders[0]?.date}</span>
                <span>{data.dailyOrders.at(-1)?.date}</span>
              </div>
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>
                Order Status
              </h2>
              <p style={{ margin: "0 0 18px", color: "#777d87", fontSize: 13 }}>
                Status breakdown for the selected period
              </p>

              {Object.keys(data.statusCounts).length === 0 ? (
                <p style={{ color: "#777d87" }}>No orders in this period.</p>
              ) : (
                Object.entries(data.statusCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div
                      key={status}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 0",
                        borderBottom: "1px solid #f0f1f4",
                      }}
                    >
                      <span style={{ color: "#555b65" }}>
                        {status.replaceAll("_", " ")}
                      </span>
                      <strong>{count}</strong>
                    </div>
                  ))
              )}
            </section>
          </div>

          <section style={cardStyle}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>
              Restaurant Performance
            </h2>
            <p style={{ margin: "0 0 20px", color: "#777d87", fontSize: 13 }}>
              Top 10 restaurants ranked by order volume in the past 30 days
            </p>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  minWidth: 500,
                }}
              >
                <thead>
                  <tr style={{ background: "#f7f8fa" }}>
                    {["Restaurant", "Status", "Orders"].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: 14,
                          fontSize: 13,
                          color: "#626875",
                          fontWeight: 600,
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.restaurantPerformance.map((restaurant) => (
                    <tr
                      key={restaurant.id}
                      style={{ borderBottom: "1px solid #eef0f3" }}
                    >
                      <td style={{ padding: 14, fontWeight: 500 }}>
                        {restaurant.name}
                      </td>
                      <td style={{ padding: 14 }}>
                        <span
                          style={{
                            color: restaurant.isActive ? "#16803d" : "#b42318",
                            background: restaurant.isActive
                              ? "#e9f8ee"
                              : "#fff0ef",
                            padding: "5px 9px",
                            borderRadius: 20,
                            fontSize: 12,
                          }}
                        >
                          {restaurant.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: 14 }}>{restaurant.orders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  subtitle,
}: {
  label: string;
  value: number;
  icon: string;
  subtitle?: string;
}) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <span style={{ color: "#777d87", fontSize: 14 }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: "#202228" }}>
        {value.toLocaleString()}
      </div>
      {subtitle && (
        <p style={{ color: "#777d87", fontSize: 12, marginBottom: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
