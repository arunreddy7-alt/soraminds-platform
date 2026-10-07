"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  is_open: boolean;
  accept_orders: boolean;
};

type DashboardOrder = {
  id: number;
  customer_id: number | null;
  order_type: string;
  status: string;
  total: number;
  created_at: string;
};

type Customer = {
  id: number;
  full_name: string | null;
};

type ProductSales = {
  product_id: number;
  quantity: number;
};

type Product = {
  id: number;
  name: string;
};

type RevenuePoint = {
  date: string;
  revenue: number;
};

type OrderStatus = {
  status: string;
  count: number;
};

type RecentOrder = DashboardOrder & {
  customer_name: string;
};

const STATUS_ORDER = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

function getTodayRange() {
  const now = new Date();

  const indiaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(now);

  const start = new Date(`${indiaDate}T00:00:00+05:30`);
  const end = new Date(start);

  end.setDate(end.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatOrderType(type: string) {
  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${date}T00:00:00+05:30`));
}

function getGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date())
  );

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export default function RestaurantDashboardClient() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  const [todayOrders, setTodayOrders] = useState<DashboardOrder[]>([]);
  const [todayCustomers, setTodayCustomers] = useState<Customer[]>([]);
  const [topProducts, setTopProducts] = useState<
    {
      name: string;
      quantity: number;
    }[]
  >([]);

  const [revenueTrend, setRevenueTrend] = useState<RevenuePoint[]>([]);
  const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("You are not logged in.");
          setLoading(false);
          return;
        }

        const { data: restaurantUser, error: userError } =
          await supabase
            .from("users")
            .select("restaurant_id")
            .eq("auth_user_id", user.id)
            .single();

        if (userError || !restaurantUser?.restaurant_id) {
          setError("Restaurant information could not be found.");
          setLoading(false);
          return;
        }

        const restaurantId = restaurantUser.restaurant_id;

        const { data: restaurantData, error: restaurantError } =
          await supabase
            .from("restaurants")
            .select("id, name, is_open, accept_orders")
            .eq("id", restaurantId)
            .single();

        if (restaurantError || !restaurantData) {
          setError("Restaurant could not be loaded.");
          setLoading(false);
          return;
        }

        setRestaurant(restaurantData);

        const { start, end } = getTodayRange();

        /*
         * TODAY'S ORDERS
         */
        const { data: ordersData, error: ordersError } =
          await supabase
            .from("orders")
            .select(
              "id, customer_id, order_type, status, total, created_at"
            )
            .eq("restaurant_id", restaurantId)
            .gte("created_at", start)
            .lt("created_at", end)
            .order("created_at", { ascending: false });

        if (ordersError) {
          throw ordersError;
        }

        const orders = (ordersData || []) as DashboardOrder[];

        setTodayOrders(orders);

        /*
         * UNIQUE CUSTOMERS TODAY
         */
        const customerIds = Array.from(
          new Set(
            orders
              .map((order) => order.customer_id)
              .filter(
                (id): id is number => id !== null
              )
          )
        );

        if (customerIds.length > 0) {
          const { data: customerData } = await supabase
            .from("customers")
            .select("id, full_name")
            .in("id", customerIds);

          setTodayCustomers(customerData || []);
        } else {
          setTodayCustomers([]);
        }

        /*
         * ORDER STATUS
         */
        const statusMap: Record<string, number> = {};

        orders.forEach((order) => {
          const status = order.status || "UNKNOWN";

          statusMap[status] =
            (statusMap[status] || 0) + 1;
        });

        setOrderStatuses(
          STATUS_ORDER
            .filter((status) => statusMap[status] !== undefined)
            .map((status) => ({
              status,
              count: statusMap[status],
            }))
        );

        /*
         * RECENT ORDERS
         */
        const recent = orders.slice(0, 8);

        const recentCustomerIds = Array.from(
          new Set(
            recent
              .map((order) => order.customer_id)
              .filter(
                (id): id is number => id !== null
              )
          )
        );

        let recentCustomers: Customer[] = [];

        if (recentCustomerIds.length > 0) {
          const { data: customerData } = await supabase
            .from("customers")
            .select("id, full_name")
            .in("id", recentCustomerIds);

          recentCustomers = customerData || [];
        }

        const customerMap = new Map(
          recentCustomers.map((customer) => [
            customer.id,
            customer.full_name || "Customer",
          ])
        );

        setRecentOrders(
          recent.map((order) => ({
            ...order,
            customer_name:
              order.customer_id &&
              customerMap.has(order.customer_id)
                ? customerMap.get(order.customer_id) || "Customer"
                : "Guest",
          }))
        );

        /*
         * TOP PRODUCTS
         */
        const orderIds = orders.map((order) => order.id);

        if (orderIds.length > 0) {
          const { data: itemData, error: itemError } =
            await supabase
              .from("order_items")
              .select("product_id, quantity")
              .in("order_id", orderIds)
              .not("product_id", "is", null);

          if (itemError) {
            throw itemError;
          }

          const productSales: Record<number, number> = {};

          ((itemData || []) as ProductSales[]).forEach(
            (item) => {
              productSales[item.product_id] =
                (productSales[item.product_id] || 0) +
                Number(item.quantity || 0);
            }
          );

          const productIds = Object.keys(productSales).map(
            Number
          );

          if (productIds.length > 0) {
            const { data: productsData } = await supabase
              .from("products")
              .select("id, name")
              .in("id", productIds)
              .eq("restaurant_id", restaurantId);

            const products = (productsData ||
              []) as Product[];

            const productMap = new Map(
              products.map((product) => [
                product.id,
                product.name,
              ])
            );

            const sortedProducts = productIds
              .map((productId) => ({
                name:
                  productMap.get(productId) ||
                  "Unknown product",
                quantity: productSales[productId],
              }))
              .sort(
                (a, b) => b.quantity - a.quantity
              )
              .slice(0, 5);

            setTopProducts(sortedProducts);
          } else {
            setTopProducts([]);
          }
        } else {
          setTopProducts([]);
        }

        /*
         * REVENUE TREND
         *
         * Last 7 days including today.
         */
        const trendStart = new Date();
        trendStart.setDate(trendStart.getDate() - 6);

        const trendStartDate = new Intl.DateTimeFormat(
          "en-CA",
          {
            timeZone: "Asia/Kolkata",
          }
        ).format(trendStart);

        const trendStartIso = new Date(
          `${trendStartDate}T00:00:00+05:30`
        ).toISOString();

        const { data: trendOrders } = await supabase
          .from("orders")
          .select("total, created_at")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", trendStartIso)
          .lt("created_at", end);

        const revenueMap: Record<string, number> = {};

        for (let i = 0; i < 7; i++) {
          const date = new Date(trendStart);
          date.setDate(date.getDate() + i);

          const dateString = new Intl.DateTimeFormat(
            "en-CA",
            {
              timeZone: "Asia/Kolkata",
            }
          ).format(date);

          revenueMap[dateString] = 0;
        }

        (trendOrders || []).forEach((order) => {
          const dateString = new Intl.DateTimeFormat(
            "en-CA",
            {
              timeZone: "Asia/Kolkata",
            }
          ).format(new Date(order.created_at));

          if (revenueMap[dateString] !== undefined) {
            revenueMap[dateString] += Number(
              order.total || 0
            );
          }
        });

        setRevenueTrend(
          Object.entries(revenueMap).map(
            ([date, revenue]) => ({
              date,
              revenue,
            })
          )
        );
      } catch (err) {
        console.error("Dashboard error:", err);
        setError("Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const totalRevenue = useMemo(() => {
    return todayOrders.reduce(
      (total, order) =>
        total + Number(order.total || 0),
      0
    );
  }, [todayOrders]);

  const averageOrderValue =
    todayOrders.length > 0
      ? totalRevenue / todayOrders.length
      : 0;

  const uniqueCustomerCount = todayCustomers.length;

  const maxRevenue = Math.max(
    ...revenueTrend.map((item) => item.revenue),
    1
  );

  const stats = [
    {
      label: "Today's Revenue",
      value: loading
        ? "—"
        : formatCurrency(totalRevenue),
    },
    {
      label: "Today's Orders",
      value: loading
        ? "—"
        : todayOrders.length.toString(),
    },
    {
      label: "Average Order Value",
      value: loading
        ? "—"
        : formatCurrency(averageOrderValue),
    },
    {
      label: "Customers Today",
      value: loading
        ? "—"
        : uniqueCustomerCount.toString(),
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "20px",
          marginBottom: "26px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "26px",
              lineHeight: "32px",
              fontWeight: 700,
              color: "#202228",
              letterSpacing: "-0.4px",
            }}
          >
            Dashboard
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: "13px",
              color: "#858a94",
            }}
          >
            {getGreeting()}
            {restaurant ? `, ${restaurant.name}` : ""}
          </p>
        </div>

        {restaurant && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#ffffff",
              border: "1px solid #e7e9ed",
              borderRadius: "999px",
              padding: "8px 12px",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background:
                  restaurant.is_open &&
                  restaurant.accept_orders
                    ? "#22c55e"
                    : "#9ca3af",
              }}
            />

            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#555a63",
              }}
            >
              {restaurant.is_open &&
              restaurant.accept_orders
                ? "Open & accepting orders"
                : "Currently unavailable"}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "#fff5f5",
            border: "1px solid #ffdede",
            color: "#b42318",
            borderRadius: "10px",
            padding: "12px 14px",
            fontSize: "12px",
            marginBottom: "18px",
          }}
        >
          {error}
        </div>
      )}

      {/* STATS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "#ffffff",
              border: "1px solid #e7e9ed",
              borderRadius: "12px",
              padding: "20px",
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#858a94",
                marginBottom: "11px",
              }}
            >
              {stat.label}
            </div>

            <div
              style={{
                fontSize: "25px",
                lineHeight: "30px",
                fontWeight: 700,
                color: "#202228",
                letterSpacing: "-0.4px",
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* REVENUE + STATUS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 2fr) minmax(280px, 1fr)",
          gap: "18px",
          marginBottom: "18px",
        }}
      >
        {/* Revenue */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "12px",
            padding: "22px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "20px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 650,
                  color: "#202228",
                }}
              >
                Revenue
              </div>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#858a94",
                }}
              >
                Last 7 days
              </div>
            </div>

            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#202228",
              }}
            >
              {formatCurrency(
                revenueTrend.reduce(
                  (sum, item) => sum + item.revenue,
                  0
                )
              )}
            </div>
          </div>

          <div
            style={{
              height: "220px",
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              borderBottom: "1px solid #eef0f2",
              paddingBottom: "8px",
            }}
          >
            {revenueTrend.map((item) => {
              const height =
                item.revenue === 0
                  ? 4
                  : Math.max(
                      10,
                      (item.revenue / maxRevenue) *
                        170
                    );

              return (
                <div
                  key={item.date}
                  style={{
                    flex: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "8px",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "42px",
                      height: `${height}px`,
                      background: "#111111",
                      borderRadius: "5px 5px 2px 2px",
                      transition:
                        "height 0.2s ease",
                    }}
                    title={formatCurrency(
                      item.revenue
                    )}
                  />

                  <span
                    style={{
                      fontSize: "10px",
                      color: "#858a94",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDateLabel(item.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Status */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "12px",
            padding: "22px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 650,
              color: "#202228",
            }}
          >
            Order status
          </div>

          <div
            style={{
              marginTop: "4px",
              fontSize: "12px",
              color: "#858a94",
            }}
          >
            Today's orders
          </div>

          <div
            style={{
              marginTop: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "15px",
            }}
          >
            {orderStatuses.length === 0 ? (
              <div
                style={{
                  fontSize: "12px",
                  color: "#a0a4ab",
                  padding: "20px 0",
                }}
              >
                No orders today
              </div>
            ) : (
              orderStatuses.map((item) => {
                const percentage =
                  todayOrders.length > 0
                    ? (item.count /
                        todayOrders.length) *
                      100
                    : 0;

                return (
                  <div key={item.status}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        marginBottom: "7px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#555a63",
                        }}
                      >
                        {formatStatus(
                          item.status
                        )}
                      </span>

                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 650,
                          color: "#202228",
                        }}
                      >
                        {item.count}
                      </span>
                    </div>

                    <div
                      style={{
                        height: "5px",
                        background: "#f0f1f3",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: "100%",
                          background: "#111111",
                          borderRadius: "999px",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RECENT ORDERS */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e7e9ed",
          borderRadius: "12px",
          marginBottom: "18px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid #eef0f2",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 650,
              color: "#202228",
            }}
          >
            Recent orders
          </div>

          <div
            style={{
              marginTop: "4px",
              fontSize: "12px",
              color: "#858a94",
            }}
          >
            Latest orders from today
          </div>
        </div>

        {recentOrders.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              fontSize: "12px",
              color: "#a0a4ab",
            }}
          >
            No orders today
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "650px",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Order",
                    "Customer",
                    "Type",
                    "Amount",
                    "Status",
                    "Time",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
                        padding: "12px 22px",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#9a9da4",
                        textTransform:
                          "uppercase",
                        letterSpacing:
                          "0.06em",
                        background:
                          "#fafafa",
                        borderBottom:
                          "1px solid #eef0f2",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td
                      style={{
                        padding: "14px 22px",
                        fontSize: "12px",
                        fontWeight: 650,
                        color: "#202228",
                        borderBottom:
                          "1px solid #f0f1f3",
                      }}
                    >
                      #{order.id}
                    </td>

                    <td
                      style={{
                        padding: "14px 22px",
                        fontSize: "12px",
                        color: "#555a63",
                        borderBottom:
                          "1px solid #f0f1f3",
                      }}
                    >
                      {order.customer_name}
                    </td>

                    <td
                      style={{
                        padding: "14px 22px",
                        fontSize: "12px",
                        color: "#555a63",
                        borderBottom:
                          "1px solid #f0f1f3",
                      }}
                    >
                      {formatOrderType(
                        order.order_type
                      )}
                    </td>

                    <td
                      style={{
                        padding: "14px 22px",
                        fontSize: "12px",
                        fontWeight: 650,
                        color: "#202228",
                        borderBottom:
                          "1px solid #f0f1f3",
                      }}
                    >
                      {formatCurrency(
                        Number(order.total)
                      )}
                    </td>

                    <td
                      style={{
                        padding: "14px 22px",
                        borderBottom:
                          "1px solid #f0f1f3",
                      }}
                    >
                      <span
                        style={{
                          display:
                            "inline-flex",
                          padding:
                            "5px 9px",
                          borderRadius:
                            "999px",
                          background:
                            "#f3f4f6",
                          color:
                            "#555a63",
                          fontSize:
                            "10px",
                          fontWeight: 650,
                        }}
                      >
                        {formatStatus(
                          order.status
                        )}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "14px 22px",
                        fontSize: "12px",
                        color: "#858a94",
                        borderBottom:
                          "1px solid #f0f1f3",
                      }}
                    >
                      {formatTime(
                        order.created_at
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TOP PRODUCTS */}
      <div
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
            borderBottom: "1px solid #eef0f2",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 650,
              color: "#202228",
            }}
          >
            Top products
          </div>

          <div
            style={{
              marginTop: "4px",
              fontSize: "12px",
              color: "#858a94",
            }}
          >
            Best-selling products today
          </div>
        </div>

        {topProducts.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              fontSize: "12px",
              color: "#a0a4ab",
            }}
          >
            No product sales today
          </div>
        ) : (
          <div>
            {topProducts.map((product, index) => (
              <div
                key={`${product.name}-${index}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "15px 22px",
                  borderBottom:
                    index === topProducts.length - 1
                      ? "none"
                      : "1px solid #f0f1f3",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "#f2f3f5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#555a63",
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#30333a",
                      overflow: "hidden",
                      textOverflow:
                        "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {product.name}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 650,
                    color: "#202228",
                  }}
                >
                  {product.quantity} sold
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}