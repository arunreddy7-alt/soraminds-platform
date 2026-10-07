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

type ReportTab =
  | "sales"
  | "orders"
  | "products"
  | "customers"
  | "payments"
  | "coupons";

type Order = {
  id: number;
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
  coupon_id: number | null;
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
};

type Customer = {
  id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type Coupon = {
  id: number;
  code: string;
};

type Payment = {
  id: number;
  order_id: number;
  amount: number;
  method: string;
  status: string;
  transaction_id: string | null;
  created_at: string;
};

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

export default function ReportsClient() {
  const supabase = createClient();

  const [restaurantId, setRestaurantId] =
    useState<number | null>(null);

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [items, setItems] =
    useState<OrderItem[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [coupons, setCoupons] =
    useState<Coupon[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [range, setRange] =
    useState<RangeType>("30days");

  const [orderType, setOrderType] =
    useState<OrderType>("ALL");

  const [customStart, setCustomStart] =
    useState("");

  const [customEnd, setCustomEnd] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<ReportTab>("sales");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  const getRestaurantId =
    async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          "You are not authenticated."
        );
      }

      const {
        data: userData,
        error: userError,
      } = await supabase
        .from("users")
        .select(
          "restaurant_id, is_active"
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (userError) {
        throw new Error(
          userError.message
        );
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
      const date = new Date(now);

      date.setDate(
        date.getDate() - 1
      );

      return {
        start: startOfDay(date),
        end: endOfDay(date),
      };
    }

    if (range === "7days") {
      const date = new Date(now);

      date.setDate(
        date.getDate() - 6
      );

      return {
        start: startOfDay(date),
        end: endOfDay(now),
      };
    }

    if (range === "30days") {
      const date = new Date(now);

      date.setDate(
        date.getDate() - 29
      );

      return {
        start: startOfDay(date),
        end: endOfDay(now),
      };
    }

    if (
      range === "custom" &&
      customStart &&
      customEnd
    ) {
      return {
        start: new Date(
          `${customStart}T00:00:00`
        ),
        end: new Date(
          `${customEnd}T23:59:59`
        ),
      };
    }

    return {
      start: startOfDay(now),
      end: endOfDay(now),
    };
  };

  const loadReports = async (
    refresh = false
  ) => {
    try {
      if (refresh) {
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
          coupon_id,
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
          ascending: false,
        });

      if (orderType !== "ALL") {
        ordersQuery =
          ordersQuery.eq(
            "order_type",
            orderType
          );
      }

      const {
        data: orderData,
        error: ordersError,
      } = await ordersQuery;

      if (ordersError) {
        throw new Error(
          ordersError.message
        );
      }

      const safeOrders =
        (orderData || []) as Order[];

      setOrders(safeOrders);

      const orderIds =
        safeOrders.map(
          (order) => order.id
        );

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

        setItems(
          (itemData ||
            []) as OrderItem[]
        );

        const {
          data: paymentData,
          error: paymentError,
        } = await supabase
          .from("payments")
          .select(
            `
            id,
            order_id,
            amount,
            method,
            status,
            transaction_id,
            created_at
          `
          )
          .in(
            "order_id",
            orderIds
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

        if (paymentError) {
          throw new Error(
            paymentError.message
          );
        }

        setPayments(
          (paymentData ||
            []) as Payment[]
        );
      } else {
        setItems([]);
        setPayments([]);
      }

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select("id, name")
        .eq(
          "restaurant_id",
          currentRestaurantId
        );

      if (productError) {
        throw new Error(
          productError.message
        );
      }

      setProducts(
        (productData ||
          []) as Product[]
      );

      const customerIds =
        Array.from(
          new Set(
            safeOrders
              .map(
                (order) =>
                  order.customer_id
              )
              .filter(
                (
                  id
                ): id is number =>
                  id !== null
              )
          )
        );

      if (customerIds.length > 0) {
        const {
          data: customerData,
          error: customerError,
        } = await supabase
          .from("customers")
          .select(
            "id, full_name, phone, email"
          )
          .in(
            "id",
            customerIds
          );

        if (customerError) {
          throw new Error(
            customerError.message
          );
        }

        setCustomers(
          (customerData ||
            []) as Customer[]
        );
      } else {
        setCustomers([]);
      }

      const couponIds =
        Array.from(
          new Set(
            safeOrders
              .map(
                (order) =>
                  order.coupon_id
              )
              .filter(
                (
                  id
                ): id is number =>
                  id !== null
              )
          )
        );

      if (couponIds.length > 0) {
        const {
          data: couponData,
          error: couponError,
        } = await supabase
          .from("coupons")
          .select("id, code")
          .in(
            "id",
            couponIds
          );

        if (couponError) {
          throw new Error(
            couponError.message
          );
        }

        setCoupons(
          (couponData ||
            []) as Coupon[]
        );
      } else {
        setCoupons([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load reports."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [
    range,
    orderType,
    customStart,
    customEnd,
  ]);

  const salesSummary =
    useMemo(() => {
      return {
        revenue: orders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.total || 0
            ),
          0
        ),

        subtotal: orders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.subtotal || 0
            ),
          0
        ),

        menuDiscount: orders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.menu_discount ||
                0
            ),
          0
        ),

        couponDiscount: orders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.coupon_discount ||
                0
            ),
          0
        ),

        tax: orders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.tax_amount ||
                0
            ),
          0
        ),

        serviceCharge:
          orders.reduce(
            (sum, order) =>
              sum +
              Number(
                order.service_charge ||
                  0
              ),
            0
          ),

        packagingCharge:
          orders.reduce(
            (sum, order) =>
              sum +
              Number(
                order.packaging_charge ||
                  0
              ),
            0
          ),

        orders: orders.length,
      };
    }, [orders]);

  const productReport =
    useMemo(() => {
      const map =
        new Map<
          number,
          {
            id: number;
            name: string;
            quantity: number;
            revenue: number;
          }
        >();

      items.forEach((item) => {
        if (!item.product_id) {
          return;
        }

        const product =
          products.find(
            (itemProduct) =>
              itemProduct.id ===
              item.product_id
          );

        if (!product) {
          return;
        }

        const existing =
          map.get(
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
          map.set(
            product.id,
            {
              id: product.id,
              name: product.name,
              quantity:
                Number(
                  item.quantity ||
                    0
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
        map.values()
      ).sort(
        (a, b) =>
          b.revenue -
          a.revenue
      );
    }, [
      items,
      products,
    ]);

  const customerReport =
    useMemo(() => {
      const map =
        new Map<
          number,
          {
            id: number;
            name: string;
            phone: string;
            email: string;
            orders: number;
            spend: number;
          }
        >();

      orders.forEach(
        (order) => {
          if (
            order.customer_id ===
            null
          ) {
            return;
          }

          const customer =
            customers.find(
              (item) =>
                item.id ===
                order.customer_id
            );

          if (!customer) {
            return;
          }

          const existing =
            map.get(
              customer.id
            );

          if (existing) {
            existing.orders += 1;
            existing.spend +=
              Number(
                order.total || 0
              );
          } else {
            map.set(
              customer.id,
              {
                id: customer.id,
                name:
                  customer.full_name ||
                  "Guest Customer",
                phone:
                  customer.phone ||
                  "—",
                email:
                  customer.email ||
                  "—",
                orders: 1,
                spend:
                  Number(
                    order.total ||
                      0
                  ),
              }
            );
          }
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.spend -
          a.spend
      );
    }, [
      orders,
      customers,
    ]);

  const paymentReport =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            method: string;
            transactions: number;
            amount: number;
          }
        >();

      payments.forEach(
        (payment) => {
          const method =
            payment.method ||
            "UNKNOWN";

          const existing =
            map.get(method);

          if (existing) {
            existing.transactions +=
              1;

            existing.amount +=
              Number(
                payment.amount ||
                  0
              );
          } else {
            map.set(
              method,
              {
                method,
                transactions: 1,
                amount:
                  Number(
                    payment.amount ||
                      0
                  ),
              }
            );
          }
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.amount -
          a.amount
      );
    }, [payments]);

  const couponReport =
    useMemo(() => {
      const couponMap =
        new Map<
          number,
          {
            id: number;
            code: string;
            orders: number;
            discount: number;
          }
        >();

      orders.forEach(
        (order) => {
          if (
            order.coupon_id ===
            null
          ) {
            return;
          }

          const coupon =
            coupons.find(
              (item) =>
                item.id ===
                order.coupon_id
            );

          if (!coupon) {
            return;
          }

          const existing =
            couponMap.get(
              coupon.id
            );

          if (existing) {
            existing.orders += 1;

            existing.discount +=
              Number(
                order.coupon_discount ||
                  0
              );
          } else {
            couponMap.set(
              coupon.id,
              {
                id: coupon.id,
                code: coupon.code,
                orders: 1,
                discount:
                  Number(
                    order.coupon_discount ||
                      0
                  ),
              }
            );
          }
        }
      );

      return Array.from(
        couponMap.values()
      ).sort(
        (a, b) =>
          b.discount -
          a.discount
      );
    }, [
      orders,
      coupons,
    ]);

  const filteredOrders =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      if (!value) {
        return orders;
      }

      return orders.filter(
        (order) => {
          const customer =
            customers.find(
              (item) =>
                item.id ===
                order.customer_id
            );

          const customerName =
            customer?.full_name ||
            "";

          const customerPhone =
            customer?.phone ||
            "";

          const customerEmail =
            customer?.email ||
            "";

          return (
            String(
              order.id
            ).includes(value) ||
            order.order_type
              .toLowerCase()
              .includes(value) ||
            customerName
              .toLowerCase()
              .includes(value) ||
            customerPhone
              .toLowerCase()
              .includes(value) ||
            customerEmail
              .toLowerCase()
              .includes(value)
          );
        }
      );
    }, [
      orders,
      customers,
      search,
    ]);

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

  const downloadCSV = (
    filename: string,
    rows: string[][]
  ) => {
    const csv = rows
      .map((row) =>
        row
          .map(
            (cell) =>
              `"${String(
                cell ?? ""
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
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download = filename;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  };

  const exportCurrentReport =
    () => {
      const suffix =
        range === "custom"
          ? `${customStart}-${customEnd}`
          : range;

      if (
        activeTab === "sales"
      ) {
        downloadCSV(
          `sales-report-${suffix}.csv`,
          [
            [
              "Metric",
              "Value",
            ],
            [
              "Revenue",
              salesSummary.revenue.toFixed(
                2
              ),
            ],
            [
              "Orders",
              String(
                salesSummary.orders
              ),
            ],
            [
              "Subtotal",
              salesSummary.subtotal.toFixed(
                2
              ),
            ],
            [
              "Menu Discount",
              salesSummary.menuDiscount.toFixed(
                2
              ),
            ],
            [
              "Coupon Discount",
              salesSummary.couponDiscount.toFixed(
                2
              ),
            ],
            [
              "Tax",
              salesSummary.tax.toFixed(
                2
              ),
            ],
            [
              "Service Charge",
              salesSummary.serviceCharge.toFixed(
                2
              ),
            ],
            [
              "Packaging Charge",
              salesSummary.packagingCharge.toFixed(
                2
              ),
            ],
          ]
        );

        return;
      }

      if (
        activeTab === "orders"
      ) {
        downloadCSV(
          `orders-report-${suffix}.csv`,
          [
            [
              "Order ID",
              "Date",
              "Order Type",
              "Customer",
              "Total",
              "Payment Status",
              "Payment Method",
            ],
            ...filteredOrders.map(
              (order) => {
                const customer =
                  customers.find(
                    (item) =>
                      item.id ===
                      order.customer_id
                  );

                return [
                  String(
                    order.id
                  ),
                  formatDateTime(
                    order.created_at
                  ),
                  order.order_type,
                  customer?.full_name ||
                    "Guest",
                  String(
                    order.total
                  ),
                  order.payment_status,
                  order.payment_method ||
                    "—",
                ];
              }
            ),
          ]
        );

        return;
      }

      if (
        activeTab ===
        "products"
      ) {
        downloadCSV(
          `product-report-${suffix}.csv`,
          [
            [
              "Product",
              "Quantity Sold",
              "Revenue",
            ],
            ...productReport.map(
              (item) => [
                item.name,
                String(
                  item.quantity
                ),
                item.revenue.toFixed(
                  2
                ),
              ]
            ),
          ]
        );

        return;
      }

      if (
        activeTab ===
        "customers"
      ) {
        downloadCSV(
          `customer-report-${suffix}.csv`,
          [
            [
              "Customer",
              "Phone",
              "Email",
              "Orders",
              "Spend",
            ],
            ...customerReport.map(
              (customer) => [
                customer.name,
                customer.phone,
                customer.email,
                String(
                  customer.orders
                ),
                customer.spend.toFixed(
                  2
                ),
              ]
            ),
          ]
        );

        return;
      }

      if (
        activeTab ===
        "payments"
      ) {
        downloadCSV(
          `payment-report-${suffix}.csv`,
          [
            [
              "Payment Method",
              "Transactions",
              "Amount",
            ],
            ...paymentReport.map(
              (payment) => [
                payment.method,
                String(
                  payment.transactions
                ),
                payment.amount.toFixed(
                  2
                ),
              ]
            ),
          ]
        );

        return;
      }

      downloadCSV(
        `coupon-report-${suffix}.csv`,
        [
          [
            "Coupon",
            "Orders",
            "Discount",
          ],
          ...couponReport.map(
            (coupon) => [
              coupon.code,
              String(
                coupon.orders
              ),
              coupon.discount.toFixed(
                2
              ),
            ]
          ),
        ]
      );
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
        Loading reports...
      </div>
    );
  }

  if (
    error &&
    orders.length === 0
  ) {
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
          Couldn't load reports
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
            loadReports(true)
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

  const tabs: {
    key: ReportTab;
    label: string;
  }[] = [
    {
      key: "sales",
      label: "Sales",
    },
    {
      key: "orders",
      label: "Orders",
    },
    {
      key: "products",
      label: "Products",
    },
    {
      key: "customers",
      label: "Customers",
    },
    {
      key: "payments",
      label: "Payments",
    },
    {
      key: "coupons",
      label: "Coupons",
    },
  ];

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
          marginBottom: "22px",
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
            Reports
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            Generate detailed reports for your restaurant.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
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
              loadReports(true)
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
            onClick={
              exportCurrentReport
            }
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
            gap: "12px",
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

      {/* Tabs */}
      <div
        style={{
          background: "#fff",
          border:
            "1px solid #eaecf0",
          borderRadius: "10px",
          padding: "5px",
          display: "flex",
          gap: "3px",
          overflowX: "auto",
          marginBottom: "18px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() =>
              setActiveTab(
                tab.key
              )
            }
            style={{
              border: "none",
              background:
                activeTab ===
                tab.key
                  ? "#202228"
                  : "transparent",
              color:
                activeTab ===
                tab.key
                  ? "#fff"
                  : "#667085",
              padding:
                "9px 15px",
              borderRadius: "7px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight:
                activeTab ===
                tab.key
                  ? "600"
                  : "500",
              whiteSpace:
                "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search for orders */}
      {activeTab ===
        "orders" && (
        <div
          style={{
            marginBottom: "14px",
          }}
        >
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search order ID, customer, phone..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding:
                "11px 13px",
              border:
                "1px solid #d0d5dd",
              borderRadius: "8px",
              fontSize: "12px",
              outline: "none",
            }}
          />
        </div>
      )}

      {/* Sales */}
      {activeTab ===
        "sales" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "14px",
              marginBottom: "18px",
            }}
          >
            {[
              [
                "Revenue",
                formatCurrency(
                  salesSummary.revenue
                ),
              ],
              [
                "Orders",
                salesSummary.orders,
              ],
              [
                "Subtotal",
                formatCurrency(
                  salesSummary.subtotal
                ),
              ],
              [
                "Tax",
                formatCurrency(
                  salesSummary.tax
                ),
              ],
            ].map(
              ([label, value]) => (
                <div
                  key={String(
                    label
                  )}
                  style={{
                    background:
                      "#fff",
                    border:
                      "1px solid #eaecf0",
                    borderRadius:
                      "12px",
                    padding:
                      "18px",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "11px",
                      color:
                        "#858a94",
                      marginBottom:
                        "8px",
                    }}
                  >
                    {label}
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
                    {value}
                  </div>
                </div>
              )
            )}
          </div>

          <div
            style={{
              background: "#fff",
              border:
                "1px solid #eaecf0",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding:
                  "18px 20px",
                borderBottom:
                  "1px solid #eaecf0",
                fontSize: "15px",
                fontWeight: "600",
              }}
            >
              Sales Breakdown
            </div>

            {[
              [
                "Subtotal",
                salesSummary.subtotal,
              ],
              [
                "Menu Discount",
                -salesSummary.menuDiscount,
              ],
              [
                "Coupon Discount",
                -salesSummary.couponDiscount,
              ],
              [
                "Tax",
                salesSummary.tax,
              ],
              [
                "Service Charge",
                salesSummary.serviceCharge,
              ],
              [
                "Packaging Charge",
                salesSummary.packagingCharge,
              ],
              [
                "Final Revenue",
                salesSummary.revenue,
              ],
            ].map(
              ([label, value]) => (
                <div
                  key={String(
                    label
                  )}
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    padding:
                      "14px 20px",
                    borderBottom:
                      "1px solid #f2f4f7",
                    fontSize:
                      "12px",
                  }}
                >
                  <span
                    style={{
                      color:
                        "#667085",
                    }}
                  >
                    {label}
                  </span>

                  <strong
                    style={{
                      color:
                        "#202228",
                    }}
                  >
                    {formatCurrency(
                      Number(
                        value
                      )
                    )}
                  </strong>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Orders */}
      {activeTab ===
        "orders" && (
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding:
                "18px 20px",
              borderBottom:
                "1px solid #eaecf0",
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            Orders Report
          </div>

          {filteredOrders.length ===
          0 ? (
            <div
              style={{
                padding: "50px",
                textAlign:
                  "center",
                color:
                  "#858a94",
                fontSize:
                  "12px",
              }}
            >
              No orders found.
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#fafafa",
                      borderBottom:
                        "1px solid #eaecf0",
                    }}
                  >
                    {[
                      "Order",
                      "Date",
                      "Type",
                      "Customer",
                      "Total",
                      "Payment",
                    ].map(
                      (
                        heading
                      ) => (
                        <th
                          key={
                            heading
                          }
                          style={{
                            padding:
                              "13px 18px",
                            textAlign:
                              "left",
                            fontSize:
                              "10px",
                            color:
                              "#858a94",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {
                            heading
                          }
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map(
                    (order) => {
                      const customer =
                        customers.find(
                          (
                            item
                          ) =>
                            item.id ===
                            order.customer_id
                        );

                      return (
                        <tr
                          key={
                            order.id
                          }
                          style={{
                            borderBottom:
                              "1px solid #f2f4f7",
                          }}
                        >
                          <td
                            style={{
                              padding:
                                "14px 18px",
                              fontSize:
                                "12px",
                              fontWeight:
                                "600",
                            }}
                          >
                            #
                            {
                              order.id
                            }
                          </td>

                          <td
                            style={{
                              padding:
                                "14px 18px",
                              fontSize:
                                "11px",
                              color:
                                "#667085",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {formatDateTime(
                              order.created_at
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                "14px 18px",
                              fontSize:
                                "11px",
                            }}
                          >
                            {
                              order.order_type
                            }
                          </td>

                          <td
                            style={{
                              padding:
                                "14px 18px",
                              fontSize:
                                "11px",
                            }}
                          >
                            {
                              customer?.full_name ||
                              "Guest"
                            }
                          </td>

                          <td
                            style={{
                              padding:
                                "14px 18px",
                              fontSize:
                                "12px",
                              fontWeight:
                                "600",
                            }}
                          >
                            {formatCurrency(
                              Number(
                                order.total ||
                                  0
                              )
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                "14px 18px",
                              fontSize:
                                "11px",
                              color:
                                "#667085",
                            }}
                          >
                            {
                              order.payment_method ||
                              "—"
                            }
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Products */}
      {activeTab ===
        "products" && (
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding:
                "18px 20px",
              borderBottom:
                "1px solid #eaecf0",
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            Product Performance
          </div>

          {productReport.length ===
          0 ? (
            <div
              style={{
                padding: "50px",
                textAlign:
                  "center",
                color:
                  "#858a94",
                fontSize:
                  "12px",
              }}
            >
              No product sales found.
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#fafafa",
                    }}
                  >
                    <th
                      style={{
                        padding:
                          "13px 20px",
                        textAlign:
                          "left",
                        fontSize:
                          "10px",
                        color:
                          "#858a94",
                      }}
                    >
                      #
                    </th>

                    <th
                      style={{
                        padding:
                          "13px 20px",
                        textAlign:
                          "left",
                        fontSize:
                          "10px",
                        color:
                          "#858a94",
                      }}
                    >
                      Product
                    </th>

                    <th
                      style={{
                        padding:
                          "13px 20px",
                        textAlign:
                          "left",
                        fontSize:
                          "10px",
                        color:
                          "#858a94",
                      }}
                    >
                      Quantity
                    </th>

                    <th
                      style={{
                        padding:
                          "13px 20px",
                        textAlign:
                          "left",
                        fontSize:
                          "10px",
                        color:
                          "#858a94",
                      }}
                    >
                      Revenue
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {productReport.map(
                    (
                      product,
                      index
                    ) => (
                      <tr
                        key={
                          product.id
                        }
                        style={{
                          borderBottom:
                            "1px solid #f2f4f7",
                        }}
                      >
                        <td
                          style={{
                            padding:
                              "14px 20px",
                            fontSize:
                              "11px",
                            color:
                              "#858a94",
                          }}
                        >
                          {index +
                            1}
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 20px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "600",
                          }}
                        >
                          {
                            product.name
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 20px",
                            fontSize:
                              "12px",
                          }}
                        >
                          {
                            product.quantity
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 20px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "600",
                          }}
                        >
                          {formatCurrency(
                            product.revenue
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Customers */}
      {activeTab ===
        "customers" && (
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding:
                "18px 20px",
                borderBottom:
                  "1px solid #eaecf0",
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            Customer Report
          </div>

          {customerReport.length ===
          0 ? (
            <div
              style={{
                padding: "50px",
                textAlign:
                  "center",
                color:
                  "#858a94",
                fontSize:
                  "12px",
              }}
            >
              No customer data found.
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#fafafa",
                    }}
                  >
                    {[
                      "Customer",
                      "Phone",
                      "Email",
                      "Orders",
                      "Spend",
                    ].map(
                      (
                        heading
                      ) => (
                        <th
                          key={
                            heading
                          }
                          style={{
                            padding:
                              "13px 18px",
                            textAlign:
                              "left",
                            fontSize:
                              "10px",
                            color:
                              "#858a94",
                          }}
                        >
                          {
                            heading
                          }
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {customerReport.map(
                    (
                      customer
                    ) => (
                      <tr
                        key={
                          customer.id
                        }
                        style={{
                          borderBottom:
                            "1px solid #f2f4f7",
                        }}
                      >
                        <td
                          style={{
                            padding:
                              "14px 18px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "600",
                          }}
                        >
                          {
                            customer.name
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 18px",
                            fontSize:
                              "11px",
                            color:
                              "#667085",
                          }}
                        >
                          {
                            customer.phone
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 18px",
                            fontSize:
                              "11px",
                            color:
                              "#667085",
                          }}
                        >
                          {
                            customer.email
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 18px",
                            fontSize:
                              "12px",
                          }}
                        >
                          {
                            customer.orders
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 18px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "600",
                          }}
                        >
                          {formatCurrency(
                            customer.spend
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payments */}
      {activeTab ===
        "payments" && (
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding:
                "18px 20px",
              borderBottom:
                "1px solid #eaecf0",
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            Payment Report
          </div>

          {paymentReport.length ===
          0 ? (
            <div
              style={{
                padding: "50px",
                textAlign:
                  "center",
                color:
                  "#858a94",
                fontSize:
                  "12px",
              }}
            >
              No payment data found.
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#fafafa",
                    }}
                  >
                    <th
                      style={{
                        padding:
                          "13px 20px",
                        textAlign:
                          "left",
                        fontSize:
                          "10px",
                        color:
                          "#858a94",
                      }}
                    >
                      Payment Method
                    </th>

                    <th
                      style={{
                        padding:
                          "13px 20px",
                        textAlign:
                          "left",
                        fontSize:
                          "10px",
                        color:
                          "#858a94",
                      }}
                    >
                      Transactions
                    </th>

                    <th
                      style={{
                        padding:
                          "13px 20px",
                        textAlign:
                          "left",
                        fontSize:
                          "10px",
                        color:
                          "#858a94",
                      }}
                    >
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paymentReport.map(
                    (
                      payment
                    ) => (
                      <tr
                        key={
                          payment.method
                        }
                        style={{
                          borderBottom:
                            "1px solid #f2f4f7",
                        }}
                      >
                        <td
                          style={{
                            padding:
                              "14px 20px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "600",
                          }}
                        >
                          {
                            payment.method
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 20px",
                            fontSize:
                              "12px",
                          }}
                        >
                          {
                            payment.transactions
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 20px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "600",
                          }}
                        >
                          {formatCurrency(
                            payment.amount
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Coupons */}
      {activeTab ===
        "coupons" && (
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding:
                "18px 20px",
              borderBottom:
                "1px solid #eaecf0",
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            Coupon Report
          </div>

          {couponReport.length ===
          0 ? (
            <div
              style={{
                padding: "50px",
                textAlign:
                  "center",
                color:
                  "#858a94",
                fontSize:
                  "12px",
              }}
            >
              No coupon usage found.
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#fafafa",
                    }}
                  >
                    <th
                      style={{
                        padding:
                          "13px 20px",
                        textAlign:
                          "left",
                        fontSize:
                          "10px",
                        color:
                          "#858a94",
                      }}
                    >
                      Coupon
                    </th>

                    <th
                      style={{
                        padding:
                          "13px 20px",
                        textAlign:
                          "left",
                        fontSize:
                          "10px",
                        color:
                          "#858a94",
                      }}
                    >
                      Orders
                    </th>

                    <th
                      style={{
                        padding:
                          "13px 20px",
                        textAlign:
                          "left",
                        fontSize:
                          "10px",
                        color:
                          "#858a94",
                      }}
                    >
                      Discount Given
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {couponReport.map(
                    (
                      coupon
                    ) => (
                      <tr
                        key={
                          coupon.id
                        }
                        style={{
                          borderBottom:
                            "1px solid #f2f4f7",
                        }}
                      >
                        <td
                          style={{
                            padding:
                              "14px 20px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "600",
                          }}
                        >
                          {
                            coupon.code
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 20px",
                            fontSize:
                              "12px",
                          }}
                        >
                          {
                            coupon.orders
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 20px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "600",
                          }}
                        >
                          {formatCurrency(
                            coupon.discount
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}