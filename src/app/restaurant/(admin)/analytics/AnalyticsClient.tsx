"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RangeType =
  | "today"
  | "yesterday"
  | "7days"
  | "30days"
  | "custom";

type OrderType = "ALL" | "DINE_IN" | "TAKEAWAY";

type Order = {
  id: number;
  restaurant_id: number;
  customer_id: number | null;
  order_type: string;
  status: string;
  subtotal: number;
  menu_discount: number;
  coupon_discount: number;
  tax_amount: number;
  service_charge: number;
  packaging_charge: number;
  total: number;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
};

type OrderItem = {
  id: number;
  order_id: number;
  product_id: number | null;
  variant_id: number | null;
  combo_id: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type Product = {
  id: number;
  name: string;
  category_id: number;
};

type Category = {
  id: number;
  name: string;
};

type Customer = {
  id: number;
  created_at: string;
};

type AnalyticsData = {
  orders: Order[];
  items: OrderItem[];
  products: Product[];
  categories: Category[];
  customers: Customer[];
};

function getDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(date.getDate()).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-IN");
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function AnalyticsClient() {
  const supabase = createClient();

  const [range, setRange] =
    useState<RangeType>("7days");

  const [orderType, setOrderType] =
    useState<OrderType>("ALL");

  const [customStart, setCustomStart] =
    useState("");

  const [customEnd, setCustomEnd] =
    useState("");

  const [restaurantId, setRestaurantId] =
    useState<number | null>(null);

  const [data, setData] =
    useState<AnalyticsData>({
      orders: [],
      items: [],
      products: [],
      categories: [],
      customers: [],
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  const getRestaurantId =
    async (): Promise<number> => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          "You are not authenticated."
        );
      }

      const { data: userData, error } =
        await supabase
          .from("users")
          .select(
            "restaurant_id, is_active"
          )
          .eq("auth_user_id", user.id)
          .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (
        !userData ||
        !userData.restaurant_id ||
        !userData.is_active
      ) {
        throw new Error(
          "Restaurant user account is invalid."
        );
      }

      return userData.restaurant_id;
    };

  const getDateRange = () => {
    const now = new Date();

    if (range === "today") {
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    }

    if (range === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(
        yesterday.getDate() - 1
      );

      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
      };
    }

    if (range === "7days") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);

      return {
        start: startOfDay(start),
        end: endOfDay(now),
      };
    }

    if (range === "30days") {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);

      return {
        start: startOfDay(start),
        end: endOfDay(now),
      };
    }

    if (
      range === "custom" &&
      customStart &&
      customEnd
    ) {
      const start = new Date(
        `${customStart}T00:00:00`
      );

      const end = new Date(
        `${customEnd}T23:59:59`
      );

      return {
        start,
        end,
      };
    }

    return {
      start: startOfDay(now),
      end: endOfDay(now),
    };
  };

  const loadAnalytics = async (
    isRefresh = false
  ) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const currentRestaurantId =
        await getRestaurantId();

      setRestaurantId(
        currentRestaurantId
      );

      const {
        start,
        end,
      } = getDateRange();

      let ordersQuery = supabase
        .from("orders")
        .select(
          `
          id,
          restaurant_id,
          customer_id,
          order_type,
          status,
          subtotal,
          menu_discount,
          coupon_discount,
          tax_amount,
          service_charge,
          packaging_charge,
          total,
          payment_status,
          payment_method,
          created_at
        `
        )
        .eq(
          "restaurant_id",
          currentRestaurantId
        )
        .eq("status", "COMPLETED")
        .gte(
          "created_at",
          start.toISOString()
        )
        .lte(
          "created_at",
          end.toISOString()
        )
        .order("created_at", {
          ascending: true,
        });

      if (orderType !== "ALL") {
        ordersQuery =
          ordersQuery.eq(
            "order_type",
            orderType
          );
      }

      const {
        data: orders,
        error: ordersError,
      } = await ordersQuery;

      if (ordersError) {
        throw new Error(
          ordersError.message
        );
      }

      const safeOrders =
        (orders || []) as Order[];

      const orderIds =
        safeOrders.map(
          (order) => order.id
        );

      let items: OrderItem[] = [];

      if (orderIds.length > 0) {
        const {
          data: itemData,
          error: itemsError,
        } = await supabase
          .from("order_items")
          .select(
            `
            id,
            order_id,
            product_id,
            variant_id,
            combo_id,
            quantity,
            unit_price,
            total_price
          `
          )
          .in("order_id", orderIds);

        if (itemsError) {
          throw new Error(
            itemsError.message
          );
        }

        items =
          (itemData || []) as OrderItem[];
      }

      const {
        data: products,
        error: productsError,
      } = await supabase
        .from("products")
        .select(
          "id, name, category_id"
        )
        .eq(
          "restaurant_id",
          currentRestaurantId
        );

      if (productsError) {
        throw new Error(
          productsError.message
        );
      }

      const {
        data: categories,
        error: categoriesError,
      } = await supabase
        .from("categories")
        .select("id, name")
        .eq(
          "restaurant_id",
          currentRestaurantId
        );

      if (categoriesError) {
        throw new Error(
          categoriesError.message
        );
      }

      const {
        data: customers,
        error: customersError,
      } = await supabase
        .from("customers")
        .select(
          "id, created_at"
        );

      if (customersError) {
        throw new Error(
          customersError.message
        );
      }

      setData({
        orders: safeOrders,
        items,
        products:
          (products || []) as Product[],
        categories:
          (categories ||
            []) as Category[],
        customers:
          (customers ||
            []) as Customer[],
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load analytics."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [
    range,
    orderType,
    customStart,
    customEnd,
  ]);

  const overview = useMemo(() => {
    const revenue =
      data.orders.reduce(
        (sum, order) =>
          sum + Number(order.total || 0),
        0
      );

    const orders =
      data.orders.length;

    const itemsSold =
      data.items.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0),
        0
      );

    const aov =
      orders > 0
        ? revenue / orders
        : 0;

    const discountGiven =
      data.orders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.menu_discount || 0
          ) +
          Number(
            order.coupon_discount || 0
          ),
        0
      );

    return {
      revenue,
      orders,
      itemsSold,
      aov,
      discountGiven,
    };
  }, [data]);

  const orderTypeData = useMemo(() => {
    const dineIn =
      data.orders.filter(
        (order) =>
          order.order_type ===
          "DINE_IN"
      ).length;

    const takeaway =
      data.orders.filter(
        (order) =>
          order.order_type ===
          "TAKEAWAY"
      ).length;

    const total =
      dineIn + takeaway;

    return {
      dineIn,
      takeaway,
      total,
      dineInPercent:
        total > 0
          ? Math.round(
              (dineIn / total) *
                100
            )
          : 0,
      takeawayPercent:
        total > 0
          ? Math.round(
              (takeaway / total) *
                100
            )
          : 0,
    };
  }, [data.orders]);

  const revenueTrend = useMemo(() => {
    const groups =
      new Map<
        string,
        {
          date: Date;
          revenue: number;
          orders: number;
        }
      >();

    data.orders.forEach(
      (order) => {
        const date = new Date(
          order.created_at
        );

        const key =
          getDateString(date);

        const existing =
          groups.get(key);

        if (existing) {
          existing.revenue +=
            Number(
              order.total || 0
            );

          existing.orders += 1;
        } else {
          groups.set(key, {
            date,
            revenue: Number(
              order.total || 0
            ),
            orders: 1,
          });
        }
      }
    );

    return Array.from(
      groups.values()
    ).sort(
      (a, b) =>
        a.date.getTime() -
        b.date.getTime()
    );
  }, [data.orders]);

  const maxRevenue = useMemo(() => {
    return Math.max(
      ...revenueTrend.map(
        (item) => item.revenue
      ),
      1
    );
  }, [revenueTrend]);

  const topProducts = useMemo(() => {
    const productMap =
      new Map<
        number,
        {
          id: number;
          name: string;
          quantity: number;
          revenue: number;
        }
      >();

    data.items.forEach((item) => {
      if (!item.product_id) {
        return;
      }

      const product =
        data.products.find(
          (p) =>
            p.id ===
            item.product_id
        );

      if (!product) {
        return;
      }

      const existing =
        productMap.get(
          product.id
        );

      if (existing) {
        existing.quantity +=
          Number(
            item.quantity || 0
          );

        existing.revenue +=
          Number(
            item.total_price || 0
          );
      } else {
        productMap.set(
          product.id,
          {
            id: product.id,
            name: product.name,
            quantity:
              Number(
                item.quantity || 0
              ),
            revenue:
              Number(
                item.total_price ||
                  0
              ),
          }
        );
      }
    });

    return Array.from(
      productMap.values()
    )
      .sort(
        (a, b) =>
          b.revenue -
          a.revenue
      )
      .slice(0, 8);
  }, [
    data.items,
    data.products,
  ]);

  const maxProductRevenue =
    useMemo(() => {
      return Math.max(
        ...topProducts.map(
          (item) =>
            item.revenue
        ),
        1
      );
    }, [topProducts]);

  const peakHours = useMemo(() => {
    const hours =
      new Map<
        number,
        {
          hour: number;
          orders: number;
          revenue: number;
        }
      >();

    data.orders.forEach(
      (order) => {
        const date =
          new Date(
            order.created_at
          );

        const hour =
          date.getHours();

        const existing =
          hours.get(hour);

        if (existing) {
          existing.orders += 1;
          existing.revenue +=
            Number(
              order.total || 0
            );
        } else {
          hours.set(hour, {
            hour,
            orders: 1,
            revenue:
              Number(
                order.total || 0
              ),
          });
        }
      }
    );

    return Array.from(
      hours.values()
    )
      .sort(
        (a, b) =>
          b.orders -
          a.orders
      )
      .slice(0, 6);
  }, [data.orders]);

  const maxPeakOrders =
    useMemo(() => {
      return Math.max(
        ...peakHours.map(
          (item) =>
            item.orders
        ),
        1
      );
    }, [peakHours]);

  const customerAnalytics =
    useMemo(() => {
      const customerOrderMap =
        new Map<
          number,
          Order[]
        >();

      data.orders.forEach(
        (order) => {
          if (
            order.customer_id ===
            null
          ) {
            return;
          }

          const existing =
            customerOrderMap.get(
              order.customer_id
            ) || [];

          existing.push(order);

          customerOrderMap.set(
            order.customer_id,
            existing
          );
        }
      );

      let newCustomers = 0;
      let returningCustomers = 0;

      customerOrderMap.forEach(
        (orders, customerId) => {
          const customer =
            data.customers.find(
              (item) =>
                item.id ===
                customerId
            );

          if (
            !customer ||
            orders.length === 0
          ) {
            return;
          }

          const firstOrder =
            [...orders].sort(
              (a, b) =>
                new Date(
                  a.created_at
                ).getTime() -
                new Date(
                  b.created_at
                ).getTime()
            )[0];

          const customerCreated =
            new Date(
              customer.created_at
            );

          const firstOrderDate =
            new Date(
              firstOrder.created_at
            );

          const isNew =
            customerCreated >=
            new Date(
              firstOrderDate.getFullYear(),
              firstOrderDate.getMonth(),
              firstOrderDate.getDate()
            );

          if (isNew) {
            newCustomers += 1;
          } else {
            returningCustomers +=
              1;
          }
        }
      );

      const total =
        newCustomers +
        returningCustomers;

      return {
        newCustomers,
        returningCustomers,
        total,
        repeatRate:
          total > 0
            ? Math.round(
                (returningCustomers /
                  total) *
                  100
              )
            : 0,
      };
    }, [
      data.orders,
      data.customers,
    ]);

  const couponAnalytics =
    useMemo(() => {
      const couponOrders =
        data.orders.filter(
          (order) =>
            Number(
              order.coupon_discount ||
                0
            ) > 0 ||
            order.payment_method ===
              "COUPON"
        );

      const discountGiven =
        data.orders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.coupon_discount ||
                0
            ),
          0
        );

      return {
        orders:
          couponOrders.length,
        discountGiven,
      };
    }, [data.orders]);

  const exportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      [
        "Revenue",
        overview.revenue,
      ],
      [
        "Orders",
        overview.orders,
      ],
      [
        "Average Order Value",
        overview.aov.toFixed(2),
      ],
      [
        "Items Sold",
        overview.itemsSold,
      ],
      [
        "Discount Given",
        overview.discountGiven,
      ],
      [
        "Dine-in Orders",
        orderTypeData.dineIn,
      ],
      [
        "Takeaway Orders",
        orderTypeData.takeaway,
      ],
      [
        "New Customers",
        customerAnalytics.newCustomers,
      ],
      [
        "Returning Customers",
        customerAnalytics.returningCustomers,
      ],
      [
        "Repeat Rate",
        `${customerAnalytics.repeatRate}%`,
      ],
      [
        "Coupon Orders",
        couponAnalytics.orders,
      ],
      [
        "Coupon Discount",
        couponAnalytics.discountGiven,
      ],
    ];

    const csv = rows
      .map((row) =>
        row
          .map(
            (cell) =>
              `"${String(
                cell
              ).replace(
                /"/g,
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `restaurant-analytics-${range}.csv`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  };

  const getRangeLabel = () => {
    if (range === "today")
      return "Today";

    if (range === "yesterday")
      return "Yesterday";

    if (range === "7days")
      return "Last 7 Days";

    if (range === "30days")
      return "Last 30 Days";

    if (
      customStart &&
      customEnd
    ) {
      return `${customStart} → ${customEnd}`;
    }

    return "Custom Range";
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "60px 20px",
          textAlign: "center",
          color: "#858a94",
          fontSize: "13px",
        }}
      >
        Loading analytics...
      </div>
    );
  }

  if (error && !data.orders.length) {
    return (
      <div
        style={{
          background: "#fff",
          border:
            "1px solid #fecdca",
          borderRadius: "12px",
          padding: "35px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "#b42318",
            fontWeight: "600",
            marginBottom: "8px",
          }}
        >
          Couldn't load analytics
        </div>

        <div
          style={{
            color: "#858a94",
            fontSize: "12px",
            marginBottom: "18px",
          }}
        >
          {error}
        </div>

        <button
          onClick={() =>
            loadAnalytics(true)
          }
          style={{
            border: "none",
            background: "#202228",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: "700",
              color: "#202228",
            }}
          >
            Analytics
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            Understand your restaurant performance
            and customer behavior.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            value={range}
            onChange={(event) =>
              setRange(
                event.target
                  .value as RangeType
              )
            }
            style={{
              padding: "10px 12px",
              border:
                "1px solid #d0d5dd",
              borderRadius: "8px",
              background: "#fff",
              color: "#344054",
              fontSize: "12px",
            }}
          >
            <option value="today">
              Today
            </option>

            <option value="yesterday">
              Yesterday
            </option>

            <option value="7days">
              Last 7 Days
            </option>

            <option value="30days">
              Last 30 Days
            </option>

            <option value="custom">
              Custom Range
            </option>
          </select>

          <select
            value={orderType}
            onChange={(event) =>
              setOrderType(
                event.target
                  .value as OrderType
              )
            }
            style={{
              padding: "10px 12px",
              border:
                "1px solid #d0d5dd",
              borderRadius: "8px",
              background: "#fff",
              color: "#344054",
              fontSize: "12px",
            }}
          >
            <option value="ALL">
              All Orders
            </option>

            <option value="DINE_IN">
              Dine-in
            </option>

            <option value="TAKEAWAY">
              Takeaway
            </option>
          </select>

          <button
            onClick={() =>
              loadAnalytics(true)
            }
            style={{
              border:
                "1px solid #d0d5dd",
              background: "#fff",
              color: "#344054",
              padding:
                "10px 13px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            onClick={exportCSV}
            style={{
              border: "none",
              background: "#202228",
              color: "#fff",
              padding:
                "10px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Custom range */}
      {range === "custom" && (
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "10px",
            padding: "14px",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                color: "#667085",
                marginBottom: "5px",
              }}
            >
              From
            </label>

            <input
              type="date"
              value={customStart}
              onChange={(event) =>
                setCustomStart(
                  event.target.value
                )
              }
              style={{
                padding: "9px 10px",
                border:
                  "1px solid #d0d5dd",
                borderRadius: "7px",
                fontSize: "12px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                color: "#667085",
                marginBottom: "5px",
              }}
            >
              To
            </label>

            <input
              type="date"
              value={customEnd}
              onChange={(event) =>
                setCustomEnd(
                  event.target.value
                )
              }
              style={{
                padding: "9px 10px",
                border:
                  "1px solid #d0d5dd",
                borderRadius: "7px",
                fontSize: "12px",
              }}
            />
          </div>
        </div>
      )}

      {/* Current range */}
      <div
        style={{
          marginBottom: "16px",
          fontSize: "12px",
          color: "#858a94",
        }}
      >
        Showing:{" "}
        <strong
          style={{
            color: "#344054",
          }}
        >
          {getRangeLabel()}
        </strong>
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {[
          {
            label: "Revenue",
            value:
              formatCurrency(
                overview.revenue
              ),
          },
          {
            label: "Orders",
            value:
              formatNumber(
                overview.orders
              ),
          },
          {
            label:
              "Average Order Value",
            value:
              formatCurrency(
                overview.aov
              ),
          },
          {
            label: "Items Sold",
            value:
              formatNumber(
                overview.itemsSold
              ),
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "#fff",
              border:
                "1px solid #eaecf0",
              borderRadius: "12px",
              padding: "18px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#858a94",
                marginBottom: "8px",
              }}
            >
              {card.label}
            </div>

            <div
              style={{
                fontSize: "23px",
                fontWeight: "700",
                color: "#202228",
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <div
        style={{
          background: "#fff",
          border:
            "1px solid #eaecf0",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "#202228",
            }}
          >
            Revenue Trend
          </div>

          <div
            style={{
              fontSize: "11px",
              color: "#858a94",
              marginTop: "4px",
            }}
          >
            Revenue generated from completed orders.
          </div>
        </div>

        {revenueTrend.length === 0 ? (
          <div
            style={{
              padding: "35px",
              textAlign: "center",
              color: "#858a94",
              fontSize: "12px",
            }}
          >
            No revenue data for this period.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              height: "230px",
              overflowX: "auto",
              paddingBottom: "25px",
            }}
          >
            {revenueTrend.map(
              (item) => {
                const height =
                  Math.max(
                    (item.revenue /
                      maxRevenue) *
                      180,
                    4
                  );

                return (
                  <div
                    key={getDateString(
                      item.date
                    )}
                    style={{
                      minWidth: "55px",
                      height: "205px",
                      display: "flex",
                      flexDirection:
                        "column",
                      alignItems:
                        "center",
                      justifyContent:
                        "flex-end",
                      gap: "7px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "9px",
                        color:
                          "#667085",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {formatCurrency(
                        item.revenue
                      )}
                    </div>

                    <div
                      style={{
                        width: "28px",
                        height: `${height}px`,
                        background:
                          "#202228",
                        borderRadius:
                          "5px 5px 2px 2px",
                      }}
                      title={`${formatDateLabel(
                        item.date
                      )}: ${formatCurrency(
                        item.revenue
                      )}`}
                    />

                    <div
                      style={{
                        fontSize: "9px",
                        color:
                          "#858a94",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {formatDateLabel(
                        item.date
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* Two-column */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "18px",
          marginBottom: "18px",
        }}
      >
        {/* Order types */}
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "#202228",
              marginBottom: "18px",
            }}
          >
            Order Types
          </div>

          {[
            {
              label: "Dine-in",
              count:
                orderTypeData.dineIn,
              percentage:
                orderTypeData.dineInPercent,
            },
            {
              label: "Takeaway",
              count:
                orderTypeData.takeaway,
              percentage:
                orderTypeData.takeawayPercent,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  marginBottom: "7px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "#344054",
                  }}
                >
                  {item.label}
                </span>

                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#202228",
                  }}
                >
                  {item.count}{" "}
                  ({item.percentage}%)
                </span>
              </div>

              <div
                style={{
                  height: "8px",
                  background: "#f2f4f7",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${item.percentage}%`,
                    height: "100%",
                    background:
                      "#202228",
                    borderRadius:
                      "10px",
                  }}
                />
              </div>
            </div>
          ))}

          {orderTypeData.total ===
            0 && (
            <div
              style={{
                textAlign: "center",
                color: "#858a94",
                fontSize: "12px",
                padding: "15px",
              }}
            >
              No order data.
            </div>
          )}
        </div>

        {/* Customer analytics */}
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "#202228",
              marginBottom: "18px",
            }}
          >
            Customers
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: "12px",
            }}
          >
            {[
              [
                "New Customers",
                customerAnalytics.newCustomers,
              ],
              [
                "Returning",
                customerAnalytics.returningCustomers,
              ],
              [
                "Customers",
                customerAnalytics.total,
              ],
              [
                "Repeat Rate",
                `${customerAnalytics.repeatRate}%`,
              ],
            ].map(
              ([label, value]) => (
                <div
                  key={String(label)}
                  style={{
                    background:
                      "#f8f9fa",
                    borderRadius:
                      "9px",
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "10px",
                      color:
                        "#858a94",
                      marginBottom:
                        "6px",
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      fontSize:
                        "19px",
                      fontWeight:
                        "700",
                      color:
                        "#202228",
                    }}
                  >
                    {value}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Top products */}
      <div
        style={{
          background: "#fff",
          border:
            "1px solid #eaecf0",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            fontSize: "15px",
            fontWeight: "600",
            color: "#202228",
            marginBottom: "18px",
          }}
        >
          Top Products
        </div>

        {topProducts.length ===
        0 ? (
          <div
            style={{
              padding: "30px",
              textAlign: "center",
              color: "#858a94",
              fontSize: "12px",
            }}
          >
            No product sales data.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection:
                "column",
              gap: "14px",
            }}
          >
            {topProducts.map(
              (product, index) => {
                const width =
                  (product.revenue /
                    maxProductRevenue) *
                  100;

                return (
                  <div
                    key={product.id}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: "12px",
                        marginBottom:
                          "6px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          gap: "9px",
                          minWidth:
                            0,
                        }}
                      >
                        <span
                          style={{
                            width:
                              "22px",
                            height:
                              "22px",
                            borderRadius:
                              "6px",
                            background:
                              "#f2f4f7",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontSize:
                              "10px",
                            fontWeight:
                              "600",
                          }}
                        >
                          {index +
                            1}
                        </span>

                        <div
                          style={{
                            minWidth:
                              0,
                          }}
                        >
                          <div
                            style={{
                              fontSize:
                                "12px",
                              fontWeight:
                                "600",
                              color:
                                "#344054",
                              overflow:
                                "hidden",
                              textOverflow:
                                "ellipsis",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              product.name
                            }
                          </div>

                          <div
                            style={{
                              fontSize:
                                "10px",
                              color:
                                "#858a94",
                              marginTop:
                                "2px",
                            }}
                          >
                            {
                              product.quantity
                            }{" "}
                            items
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize:
                            "12px",
                          fontWeight:
                            "600",
                          color:
                            "#202228",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {formatCurrency(
                          product.revenue
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        height:
                          "6px",
                        background:
                          "#f2f4f7",
                        borderRadius:
                          "10px",
                        overflow:
                          "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${width}%`,
                          height:
                            "100%",
                          background:
                            "#202228",
                          borderRadius:
                            "10px",
                        }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* Peak hours + coupons */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "18px",
        }}
      >
        {/* Peak hours */}
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "#202228",
              marginBottom: "18px",
            }}
          >
            Peak Hours
          </div>

          {peakHours.length ===
          0 ? (
            <div
              style={{
                padding: "30px",
                textAlign: "center",
                color: "#858a94",
                fontSize: "12px",
              }}
            >
              No hourly data.
            </div>
          ) : (
            peakHours.map(
              (item) => {
                const width =
                  (item.orders /
                    maxPeakOrders) *
                  100;

                const hour =
                  String(
                    item.hour
                  ).padStart(
                    2,
                    "0"
                  );

                return (
                  <div
                    key={item.hour}
                    style={{
                      marginBottom:
                        "13px",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        marginBottom:
                          "5px",
                      }}
                    >
                      <span
                        style={{
                          fontSize:
                            "11px",
                          color:
                            "#344054",
                        }}
                      >
                        {hour}:00
                      </span>

                      <span
                        style={{
                          fontSize:
                            "11px",
                          color:
                            "#858a94",
                        }}
                      >
                        {
                          item.orders
                        }{" "}
                        orders
                      </span>
                    </div>

                    <div
                      style={{
                        height:
                          "7px",
                        background:
                          "#f2f4f7",
                        borderRadius:
                          "10px",
                        overflow:
                          "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${width}%`,
                          height:
                            "100%",
                          background:
                            "#202228",
                          borderRadius:
                            "10px",
                        }}
                      />
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>

        {/* Coupons */}
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "#202228",
              marginBottom: "18px",
            }}
          >
            Coupon Performance
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: "12px",
            }}
          >
            <div
              style={{
                padding: "18px",
                background:
                  "#f8f9fa",
                borderRadius:
                  "10px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "10px",
                  color:
                    "#858a94",
                  marginBottom:
                    "7px",
                }}
              >
                Coupon Orders
              </div>

              <div
                style={{
                  fontSize:
                    "22px",
                  fontWeight:
                    "700",
                  color:
                    "#202228",
                }}
              >
                {
                  couponAnalytics.orders
                }
              </div>
            </div>

            <div
              style={{
                padding: "18px",
                background:
                  "#f8f9fa",
                borderRadius:
                  "10px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "10px",
                  color:
                    "#858a94",
                  marginBottom:
                    "7px",
                }}
              >
                Discount Given
              </div>

              <div
                style={{
                  fontSize:
                    "22px",
                  fontWeight:
                    "700",
                  color:
                    "#202228",
                }}
              >
                {formatCurrency(
                  couponAnalytics.discountGiven
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "15px",
              padding: "12px",
              background:
                "#fffaeb",
              border:
                "1px solid #fedf89",
              borderRadius:
                "8px",
              color:
                "#92400e",
              fontSize:
                "11px",
            }}
          >
            Coupon performance is calculated from
            completed orders in the selected period.
          </div>
        </div>
      </div>
    </div>
  );
}