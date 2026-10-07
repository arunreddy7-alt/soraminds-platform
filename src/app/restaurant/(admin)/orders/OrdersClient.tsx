"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: number;
  customer_id: number | null;
  order_type: string;
  table_id: number | null;
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

type Customer = {
  id: number;
  full_name: string | null;
  phone: string | null;
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

type SelectedOrder = {
  order: Order;
  customer: Customer | null;
  items: {
    item: OrderItem;
    product: Product | null;
  }[];
};

const STATUS_OPTIONS = [
  "ALL",
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

const ORDER_TYPE_OPTIONS = [
  "ALL",
  "DINE_IN",
  "TAKEAWAY",
  "DELIVERY",
];

function formatCurrency(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
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

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));
}

function getNextStatus(status: string) {
  switch (status) {
    case "NEW":
      return "CONFIRMED";

    case "CONFIRMED":
      return "PREPARING";

    case "PREPARING":
      return "READY";

    case "READY":
      return "COMPLETED";

    default:
      return null;
  }
}

function getNextStatusLabel(status: string) {
  switch (status) {
    case "NEW":
      return "Accept Order";

    case "CONFIRMED":
      return "Start Preparing";

    case "PREPARING":
      return "Mark Ready";

    case "READY":
      return "Complete Order";

    default:
      return null;
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [selectedOrder, setSelectedOrder] =
    useState<SelectedOrder | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const [restaurantId, setRestaurantId] =
    useState<number | null>(null);

  async function getRestaurantId() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data } = await supabase
      .from("users")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .single();

    return data?.restaurant_id || null;
  }

  async function loadOrders() {
    try {
      setError("");

      const supabase = createClient();

      const id = restaurantId || (await getRestaurantId());

      if (!id) {
        setError("Restaurant information could not be found.");
        setLoading(false);
        return;
      }

      setRestaurantId(id);

      const { data: ordersData, error: ordersError } =
        await supabase
          .from("orders")
          .select(
            `
              id,
              customer_id,
              order_type,
              table_id,
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
          .eq("restaurant_id", id)
          .order("created_at", {
            ascending: false,
          });

      if (ordersError) {
        throw ordersError;
      }

      const loadedOrders = (ordersData || []) as Order[];

      setOrders(loadedOrders);

      const customerIds = Array.from(
        new Set(
          loadedOrders
            .map((order) => order.customer_id)
            .filter(
              (id): id is number => id !== null
            )
        )
      );

      if (customerIds.length > 0) {
        const { data: customerData } =
          await supabase
            .from("customers")
            .select("id, full_name, phone")
            .in("id", customerIds);

        setCustomers(customerData || []);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();

    const interval = setInterval(() => {
      loadOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const customerMap = useMemo(() => {
    return new Map(
      customers.map((customer) => [
        customer.id,
        customer,
      ])
    );
  }, [customers]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const customer = order.customer_id
        ? customerMap.get(order.customer_id)
        : null;

      const customerName =
        customer?.full_name?.toLowerCase() || "";

      const customerPhone =
        customer?.phone?.toLowerCase() || "";

      const orderMatches =
        !query ||
        order.id.toString().includes(query) ||
        customerName.includes(query) ||
        customerPhone.includes(query);

      const statusMatches =
        statusFilter === "ALL" ||
        order.status === statusFilter;

      const typeMatches =
        typeFilter === "ALL" ||
        order.order_type === typeFilter;

      return (
        orderMatches &&
        statusMatches &&
        typeMatches
      );
    });
  }, [
    orders,
    customers,
    customerMap,
    search,
    statusFilter,
    typeFilter,
  ]);

  async function openOrder(order: Order) {
    try {
      const supabase = createClient();

      const { data: itemsData } = await supabase
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
        .eq("order_id", order.id);

      const items = (itemsData || []) as OrderItem[];

      const productIds = Array.from(
        new Set(
          items
            .map((item) => item.product_id)
            .filter(
              (id): id is number => id !== null
            )
        )
      );

      let products: Product[] = [];

      if (productIds.length > 0) {
        const { data: productsData } =
          await supabase
            .from("products")
            .select("id, name")
            .in("id", productIds);

        products = productsData || [];
      }

      const productMap = new Map(
        products.map((product) => [
          product.id,
          product,
        ])
      );

      const customer = order.customer_id
        ? customerMap.get(order.customer_id) || null
        : null;

      setSelectedOrder({
        order,
        customer,
        items: items.map((item) => ({
          item,
          product: item.product_id
            ? productMap.get(item.product_id) ||
              null
            : null,
        })),
      });
    } catch (err) {
      console.error(err);
      setError("Unable to load order details.");
    }
  }

  async function updateOrderStatus(
    orderId: number,
    newStatus: string
  ) {
    try {
      setUpdating(true);
      setError("");

      const supabase = createClient();

      const { data: authData } =
        await supabase.auth.getUser();

      if (!authData.user) {
        setError("You are not logged in.");
        return;
      }

      const { data: restaurantUser } =
        await supabase
          .from("users")
          .select("restaurant_id")
          .eq("auth_user_id", authData.user.id)
          .single();

      if (!restaurantUser?.restaurant_id) {
        setError(
          "Restaurant information could not be found."
        );
        return;
      }

      const { error: updateError } =
        await supabase
          .from("orders")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq(
            "restaurant_id",
            restaurantUser.restaurant_id
          );

      if (updateError) {
        throw updateError;
      }

      await loadOrders();

      if (selectedOrder?.order.id === orderId) {
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to update order status.");
    } finally {
      setUpdating(false);
    }
  }

  const stats = {
    total: orders.length,
    new: orders.filter(
      (order) => order.status === "NEW"
    ).length,
    preparing: orders.filter(
      (order) => order.status === "PREPARING"
    ).length,
    ready: orders.filter(
      (order) => order.status === "READY"
    ).length,
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: 700,
              color: "#202228",
              letterSpacing: "-0.4px",
            }}
          >
            Orders
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: "13px",
              color: "#858a94",
            }}
          >
            Manage incoming and past orders
          </p>
        </div>

        <button
          onClick={() => loadOrders()}
          style={{
            border: "1px solid #e1e3e7",
            background: "#ffffff",
            color: "#33363c",
            borderRadius: "8px",
            padding: "9px 14px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        {[
          ["Total Orders", stats.total],
          ["New", stats.new],
          ["Preparing", stats.preparing],
          ["Ready", stats.ready],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              background: "#ffffff",
              border: "1px solid #e7e9ed",
              borderRadius: "12px",
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#858a94",
                marginBottom: "10px",
              }}
            >
              {label}
            </div>

            <div
              style={{
                fontSize: "23px",
                fontWeight: 700,
                color: "#202228",
              }}
            >
              {value}
            </div>
          </div>
        ))}
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

      {/* Filters */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e7e9ed",
          borderRadius: "12px",
          padding: "14px",
          marginBottom: "18px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search order, customer or phone..."
          style={{
            flex: 1,
            minWidth: "220px",
            border: "1px solid #dfe2e7",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "12px",
            outline: "none",
            color: "#30333a",
          }}
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          style={{
            border: "1px solid #dfe2e7",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "12px",
            background: "#ffffff",
            color: "#555a63",
            cursor: "pointer",
          }}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status === "ALL"
                ? "All Statuses"
                : formatStatus(status)}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value)
          }
          style={{
            border: "1px solid #dfe2e7",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "12px",
            background: "#ffffff",
            color: "#555a63",
            cursor: "pointer",
          }}
        >
          {ORDER_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type === "ALL"
                ? "All Types"
                : formatOrderType(type)}
            </option>
          ))}
        </select>
      </div>

      {/* Orders table */}
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
            padding: "18px 22px",
            borderBottom: "1px solid #eef0f2",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 650,
              color: "#202228",
            }}
          >
            Orders
          </div>

          <div
            style={{
              fontSize: "11px",
              color: "#858a94",
            }}
          >
            {filteredOrders.length} results
          </div>
        </div>

        {loading ? (
          <div
            style={{
              padding: "50px",
              textAlign: "center",
              color: "#858a94",
              fontSize: "12px",
            }}
          >
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#30333a",
              }}
            >
              No orders found
            </div>

            <div
              style={{
                marginTop: "5px",
                fontSize: "12px",
                color: "#858a94",
              }}
            >
              Try changing your search or filters.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: "850px",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Order",
                    "Customer",
                    "Type",
                    "Amount",
                    "Payment",
                    "Status",
                    "Time",
                    "",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "11px 18px",
                        textAlign: "left",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#9a9da4",
                        textTransform:
                          "uppercase",
                        letterSpacing:
                          "0.06em",
                        background: "#fafafa",
                        borderBottom:
                          "1px solid #eef0f2",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((order) => {
                  const customer = order.customer_id
                    ? customerMap.get(
                        order.customer_id
                      )
                    : null;

                  const nextStatus =
                    getNextStatus(order.status);

                  const nextLabel =
                    getNextStatusLabel(
                      order.status
                    );

                  return (
                    <tr key={order.id}>
                      <td
                        style={{
                          padding: "15px 18px",
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
                          padding: "15px 18px",
                          borderBottom:
                            "1px solid #f0f1f3",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#30333a",
                          }}
                        >
                          {customer?.full_name ||
                            "Guest"}
                        </div>

                        {customer?.phone && (
                          <div
                            style={{
                              marginTop: "3px",
                              fontSize: "10px",
                              color: "#858a94",
                            }}
                          >
                            {customer.phone}
                          </div>
                        )}
                      </td>

                      <td
                        style={{
                          padding: "15px 18px",
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
                          padding: "15px 18px",
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
                          padding: "15px 18px",
                          borderBottom:
                            "1px solid #f0f1f3",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color:
                              order.payment_status ===
                              "PAID"
                                ? "#15803d"
                                : "#9a6700",
                          }}
                        >
                          {formatStatus(
                            order.payment_status
                          )}
                        </div>

                        {order.payment_method && (
                          <div
                            style={{
                              marginTop: "3px",
                              fontSize: "10px",
                              color: "#858a94",
                            }}
                          >
                            {formatStatus(
                              order.payment_method
                            )}
                          </div>
                        )}
                      </td>

                      <td
                        style={{
                          padding: "15px 18px",
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
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {formatStatus(
                            order.status
                          )}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: "15px 18px",
                          fontSize: "11px",
                          color: "#858a94",
                          whiteSpace:
                            "nowrap",
                          borderBottom:
                            "1px solid #f0f1f3",
                        }}
                      >
                        {formatDateTime(
                          order.created_at
                        )}
                      </td>

                      <td
                        style={{
                          padding: "15px 18px",
                          borderBottom:
                            "1px solid #f0f1f3",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "7px",
                          }}
                        >
                          <button
                            onClick={() =>
                              openOrder(order)
                            }
                            style={{
                              border:
                                "1px solid #e1e3e7",
                              background:
                                "#ffffff",
                              color:
                                "#44474e",
                              borderRadius:
                                "7px",
                              padding:
                                "7px 10px",
                              fontSize:
                                "10px",
                              fontWeight:
                                600,
                              cursor:
                                "pointer",
                            }}
                          >
                            View
                          </button>

                          {nextStatus &&
                            nextLabel && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(
                                    order.id,
                                    nextStatus
                                  )
                                }
                                disabled={
                                  updating
                                }
                                style={{
                                  border:
                                    "none",
                                  background:
                                    "#111111",
                                  color:
                                    "#ffffff",
                                  borderRadius:
                                    "7px",
                                  padding:
                                    "7px 10px",
                                  fontSize:
                                    "10px",
                                  fontWeight:
                                    600,
                                  cursor:
                                    updating
                                      ? "not-allowed"
                                      : "pointer",
                                  opacity:
                                    updating
                                      ? 0.6
                                      : 1,
                                }}
                              >
                                {nextLabel}
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "620px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #e7e9ed",
              boxShadow:
                "0 20px 50px rgba(0,0,0,0.15)",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: "20px 22px",
                borderBottom:
                  "1px solid #eef0f2",
                display: "flex",
                alignItems: "flex-start",
                justifyContent:
                  "space-between",
                gap: "20px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#202228",
                  }}
                >
                  Order #{selectedOrder.order.id}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "12px",
                    color: "#858a94",
                  }}
                >
                  {formatDateTime(
                    selectedOrder.order
                      .created_at
                  )}
                </div>
              </div>

              <button
                onClick={() =>
                  setSelectedOrder(null)
                }
                style={{
                  border: "none",
                  background: "#f3f4f6",
                  width: "30px",
                  height: "30px",
                  borderRadius: "7px",
                  cursor: "pointer",
                  color: "#555a63",
                  fontSize: "16px",
                }}
              >
                ×
              </button>
            </div>

            {/* Customer */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom:
                  "1px solid #eef0f2",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#9a9da4",
                  textTransform:
                    "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "8px",
                }}
              >
                Customer
              </div>

              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#30333a",
                }}
              >
                {selectedOrder.customer
                  ?.full_name || "Guest"}
              </div>

              {selectedOrder.customer?.phone && (
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "11px",
                    color: "#858a94",
                  }}
                >
                  {selectedOrder.customer.phone}
                </div>
              )}
            </div>

            {/* Items */}
            <div
              style={{
                padding: "18px 22px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#9a9da4",
                  textTransform:
                    "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "12px",
                }}
              >
                Items
              </div>

              {selectedOrder.items.length === 0 ? (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#858a94",
                  }}
                >
                  No items found.
                </div>
              ) : (
                <div>
                  {selectedOrder.items.map(
                    ({ item, product }) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: "15px",
                          padding:
                            "12px 0",
                          borderBottom:
                            "1px solid #f0f1f3",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize:
                                "12px",
                              fontWeight:
                                600,
                              color:
                                "#30333a",
                            }}
                          >
                            {product?.name ||
                              (item.combo_id
                                ? "Combo"
                                : "Product")}
                          </div>

                          <div
                            style={{
                              marginTop:
                                "3px",
                              fontSize:
                                "10px",
                              color:
                                "#858a94",
                            }}
                          >
                            Qty{" "}
                            {item.quantity} ×{" "}
                            {formatCurrency(
                              Number(
                                item.unit_price
                              )
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize:
                              "12px",
                            fontWeight:
                              650,
                            color:
                              "#202228",
                          }}
                        >
                          {formatCurrency(
                            Number(
                              item.total_price
                            )
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Totals */}
            <div
              style={{
                padding: "18px 22px",
                background: "#fafafa",
                borderTop:
                  "1px solid #eef0f2",
              }}
            >
              {[
                [
                  "Subtotal",
                  selectedOrder.order.subtotal,
                ],
                [
                  "Menu discount",
                  -selectedOrder.order
                    .menu_discount,
                ],
                [
                  "Coupon discount",
                  -selectedOrder.order
                    .coupon_discount,
                ],
                [
                  "Tax",
                  selectedOrder.order
                    .tax_amount,
                ],
                [
                  "Service charge",
                  selectedOrder.order
                    .service_charge,
                ],
                [
                  "Packaging",
                  selectedOrder.order
                    .packaging_charge,
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    padding:
                      "5px 0",
                    fontSize: "11px",
                    color: "#666b74",
                  }}
                >
                  <span>{label}</span>

                  <span>
                    {formatCurrency(
                      Number(value)
                    )}
                  </span>
                </div>
              ))}

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  marginTop: "10px",
                  paddingTop: "12px",
                  borderTop:
                    "1px solid #e2e4e8",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#202228",
                }}
              >
                <span>Total</span>

                <span>
                  {formatCurrency(
                    Number(
                      selectedOrder.order
                        .total
                    )
                  )}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                padding: "18px 22px",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#858a94",
                    marginBottom: "4px",
                  }}
                >
                  Current status
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 650,
                    color: "#202228",
                  }}
                >
                  {formatStatus(
                    selectedOrder.order
                      .status
                  )}
                </div>
              </div>

              {getNextStatus(
                selectedOrder.order.status
              ) && (
                <button
                  onClick={() =>
                    updateOrderStatus(
                      selectedOrder.order.id,
                      getNextStatus(
                        selectedOrder.order
                          .status
                      )!
                    )
                  }
                  disabled={updating}
                  style={{
                    border: "none",
                    background: "#111111",
                    color: "#ffffff",
                    borderRadius: "8px",
                    padding: "10px 15px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: updating
                      ? "not-allowed"
                      : "pointer",
                    opacity: updating ? 0.6 : 1,
                  }}
                >
                  {updating
                    ? "Updating..."
                    : getNextStatusLabel(
                        selectedOrder.order
                          .status
                      )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}