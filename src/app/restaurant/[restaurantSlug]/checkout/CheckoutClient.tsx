
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CartItem,
  clearCart,
  getCart,
  getCartTotal,
} from "@/lib/cart";

type OrderType = "DINE_IN" | "TAKEAWAY";
type PaymentMethod = "CASH" | "UPI";

type CheckoutItem = {
  id: number;
  key: string;
  productId: number;
  productSlug: string;
  name: string;
  imageUrl: string | null;
  variantId: number | null;
  variantName: string | null;
  quantity: number;
  price: number;
  total: number;
};

type SharedCartResponse = {
  success: boolean;
  items: CheckoutItem[];
  total: number;
  session: {
    id: number;
    restaurantId: number;
    tableId: number;
    groupCode: string;
  };
};

import { formatCurrency as formatCurrencyWithCode } from "@/lib/currency";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  padding: "11px 12px",
  fontSize: "12px",
  color: "#202228",
  background: "#fff",
};

export default function CheckoutClient({
  restaurantSlug,
}: {
  restaurantSlug: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderType: OrderType =
    searchParams.get("orderType") === "DINE_IN"
      ? "DINE_IN"
      : "TAKEAWAY";

  const tableIdParam = searchParams.get("tableId");
  const sessionIdParam = searchParams.get("sessionId");

  const tableId = tableIdParam ? Number(tableIdParam) : null;
  const sessionId = sessionIdParam ? Number(sessionIdParam) : null;

  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(orderType === "DINE_IN");

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("CASH");

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("INR");

  useEffect(() => {
    fetch(`/api/customer/storefront/${restaurantSlug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.restaurant?.features?.currency) {
          setCurrency(data.restaurant.features.currency);
        }
      })
      .catch(() => {});
  }, [restaurantSlug]);

  const formatCurrency = (value: number) => formatCurrencyWithCode(value, currency);

  // Load the correct cart for the selected order type.
  useEffect(() => {
    let cancelled = false;

    async function loadCheckoutCart() {
      // Always reset submission state on fresh load — fixes the glitch where
      // Next.js reuses a cached component instance that still has submitted=true
      setSubmitted(false);
      setError("");
      setMounted(false);

      if (orderType === "TAKEAWAY") {
        const cart: CartItem[] = getCart(restaurantSlug);

        if (cancelled) return;

        setItems(
          cart.map((item) => ({
            id: 0,
            key: item.key,
            productId: item.productId,
            productSlug: item.productSlug,
            name: item.name,
            imageUrl: item.imageUrl,
            variantId: item.variantId,
            variantName: item.variantName,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
          }))
        );

        setSubtotal(getCartTotal(cart));
        setLoading(false);
        setMounted(true);
        return;
      }

      if (
        !tableId ||
        Number.isNaN(tableId) ||
        !sessionId ||
        Number.isNaN(sessionId)
      ) {
        setError("Table session not found.");
        setLoading(false);
        setMounted(true);
        return;
      }

      try {
        setLoading(true);

        const response = await fetch(
          `/api/customer/table-session/items?restaurantSlug=${encodeURIComponent(
            restaurantSlug
          )}&tableSessionId=${encodeURIComponent(String(sessionId))}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load shared cart."
          );
        }

        if (cancelled) return;

        const cartData = data as SharedCartResponse;

        setItems(cartData.items || []);
        setSubtotal(Number(cartData.total) || 0);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load cart."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setMounted(true);
        }
      }
    }

    void loadCheckoutCart();

    return () => {
      cancelled = true;
    };
  }, [orderType, restaurantSlug, tableId, sessionId]);

  const applyCoupon = async () => {
    setError("");

    if (!couponCode.trim()) {
      setError("Enter a coupon code.");
      return;
    }

    try {
      setCouponLoading(true);

      const response = await fetch("/api/customer/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantSlug,
          code: couponCode.trim(),
          subtotal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to apply coupon.");
      }

      setAppliedCoupon(data.code);
      setCouponDiscount(Number(data.discount) || 0);
    } catch (err) {
      setAppliedCoupon("");
      setCouponDiscount(0);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to apply coupon."
      );
    } finally {
      setCouponLoading(false);
    }
  };

  const total = Math.max(0, subtotal - couponDiscount);

  const menuUrl =
    orderType === "DINE_IN"
      ? `/restaurant/${encodeURIComponent(
          restaurantSlug
        )}?orderType=DINE_IN&tableId=${encodeURIComponent(
          String(tableId)
        )}&sessionId=${encodeURIComponent(String(sessionId))}`
      : `/restaurant/${encodeURIComponent(restaurantSlug)}`;

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }

    if (!/^\+?[0-9\s-]{10,}$/.test(phone.trim())) {
      setError("Enter a valid phone number.");
      return;
    }

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (orderType === "DINE_IN") {
      if (!tableId || Number.isNaN(tableId)) {
        setError("Invalid table.");
        return;
      }

      if (!sessionId || Number.isNaN(sessionId)) {
        setError("Invalid table session.");
        return;
      }
    }

    try {
      setSubmitting(true);

      const orderPayload = {
        restaurantSlug,
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          address: null,
        },
        orderType,
        paymentMethod,
        couponCode: appliedCoupon || null,
        ...(orderType === "DINE_IN"
          ? {
              tableId,
              tableSessionId: sessionId,
            }
          : {}),
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          variantName: item.variantName ?? null,
          quantity: item.quantity,
        })),
      };

      const response = await fetch("/api/customer/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to place order.");
      }

      // Clear only the cart belonging to this order type.
      if (orderType === "DINE_IN" && sessionId) {
        try {
          const clearResponse = await fetch(
            "/api/customer/table-session/items",
            {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                restaurantSlug,
                tableSessionId: sessionId,
                clearAll: true,
              }),
            }
          );

          if (!clearResponse.ok) {
            console.error("Order placed, but shared cart cleanup failed.");
          }
        } catch {
          console.error("Order placed, but shared cart cleanup failed.");
        }
      } else {
        clearCart(restaurantSlug);
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to place order."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f9fb",
          color: "#667085",
          fontSize: "14px",
        }}
      >
        Loading checkout...
      </main>
    );
  }

  if (submitted) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f8f9fb",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "450px",
            padding: "34px 24px",
            textAlign: "center",
            background: "#fff",
            border: "1px solid #eaecf0",
            borderRadius: "16px",
          }}
        >
          <div style={{ fontSize: "42px", marginBottom: "12px" }}>
            ✓
          </div>

          <h1 style={{ margin: 0, fontSize: "22px" }}>
            Order request received
          </h1>

          <p
            style={{
              color: "#667085",
              fontSize: "13px",
              lineHeight: 1.5,
              margin: "10px 0 22px",
            }}
          >
            {orderType === "DINE_IN"
              ? "The restaurant will confirm your table order shortly."
              : "Your takeaway order has been submitted."}
            <br />
            Your total is {formatCurrency(total)}.
          </p>

          <button
            onClick={() => router.push(menuUrl)}
            style={{
              width: "100%",
              border: "none",
              background: "#202228",
              color: "#fff",
              padding: "13px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            Back to Menu
          </button>
        </section>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main
        className="checkout-page"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f8f9fb",
        }}
      >
        <section style={{ textAlign: "center" }}>
          <div style={{ fontSize: "42px", marginBottom: "12px" }}>
            🛒
          </div>

          <h1 style={{ margin: 0, fontSize: "21px" }}>
            {orderType === "DINE_IN"
              ? "Shared cart is empty"
              : "Your cart is empty"}
          </h1>

          {error && (
            <p
              role="alert"
              style={{ color: "#b42318", fontSize: "12px" }}
            >
              {error}
            </p>
          )}

          <button
            onClick={() => router.push(menuUrl)}
            style={{
              marginTop: "18px",
              border: "none",
              background: "#202228",
              color: "#fff",
              padding: "11px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            Browse Menu
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f9fb",
        color: "#202228",
      }}
    >
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #eaecf0",
          padding: "16px 22px",
        }}
      >
        <div
          className="checkout-header-inner"
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: "15px",
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              border: "1px solid #eaecf0",
              background: "#fff",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "17px",
            }}
          >
            ←
          </button>

          <div>
            <h1 style={{ margin: 0, fontSize: "18px" }}>
              {orderType === "DINE_IN"
                ? "Table Checkout"
                : "Takeaway Checkout"}
            </h1>

            <div
              style={{
                marginTop: "3px",
                fontSize: "11px",
                color: "#858a94",
              }}
            >
              {orderType === "DINE_IN"
                ? "Shared table order"
                : "Review your takeaway order"}
            </div>
          </div>
        </div>
      </header>

      <div
        className="checkout-content"
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "28px 22px 60px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "22px",
          alignItems: "start",
        }}
      >
        <form
          className="checkout-form"
          id="checkout-form"
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: "16px", minWidth: 0 }}
        >
          <section
            className="checkout-section"
            style={{
              background: "#fff",
              border: "1px solid #eaecf0",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: "16px" }}>
              Contact details
            </h2>

            <label
              style={{
                display: "grid",
                gap: "6px",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                required
                style={inputStyle}
              />
            </label>

            <label
              style={{
                display: "grid",
                gap: "6px",
                marginTop: "14px",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Phone number
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="10-digit phone number"
                inputMode="tel"
                required
                style={inputStyle}
              />
            </label>
          </section>

          <section
            className="checkout-section"
            style={{
              background: "#fff",
              border: "1px solid #eaecf0",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: "16px" }}>
              Payment method
            </h2>

            <div style={{ display: "grid", gap: "10px" }}>
              {(["CASH", "UPI"] as PaymentMethod[]).map((method) => (
                <label
                  key={method}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "12px",
                    border: `1px solid ${
                      paymentMethod === method ? "#202228" : "#d0d5dd"
                    }`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                  />
                  {method === "CASH" ? "Cash" : "UPI"}
                </label>
              ))}
            </div>
          </section>

          {error && (
            <p
              role="alert"
              style={{ margin: 0, color: "#b42318", fontSize: "12px" }}
            >
              {error}
            </p>
          )}

        </form>

        <aside
          className="checkout-summary"
          style={{
            background: "#fff",
            border: "1px solid #eaecf0",
            borderRadius: "12px",
            padding: "20px",
            position: "sticky",
            top: "90px",
            minWidth: 0,
          }}
        >
          <h2 style={{ margin: "0 0 16px", fontSize: "16px" }}>
            {orderType === "DINE_IN"
              ? "Shared Order Summary"
              : "Order Summary"}
          </h2>

          {items.map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "12px",
                fontSize: "12px",
              }}
            >
              <span>
                {item.name} × {item.quantity}
                {item.variantName ? ` (${item.variantName})` : ""}
              </span>

              <strong>
                {formatCurrency(item.price * item.quantity)}
              </strong>
            </div>
          ))}

          <div
            style={{
              borderTop: "1px solid #eaecf0",
              marginTop: "16px",
              paddingTop: "15px",
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "700",
            }}
          >
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          <div
            className="checkout-coupon"
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "16px",
            }}
          >
            <input
              value={couponCode}
              onChange={(event) => {
                setCouponCode(event.target.value.toUpperCase());
                setAppliedCoupon("");
                setCouponDiscount(0);
              }}
              placeholder="Coupon code"
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />

            <button
              type="button"
              onClick={applyCoupon}
              disabled={couponLoading}
              style={{
                border: "1px solid #d0d5dd",
                background: "#fff",
                borderRadius: "8px",
                padding: "0 12px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              {couponLoading ? "..." : "Apply"}
            </button>
          </div>

          {couponDiscount > 0 && (
            <div
              style={{
                marginTop: "8px",
                fontSize: "11px",
                color: "#027a48",
              }}
            >
              {appliedCoupon} applied · You save{" "}
              {formatCurrency(couponDiscount)}
            </div>
          )}

          <div
            style={{
              borderTop: "1px solid #eaecf0",
              marginTop: "16px",
              paddingTop: "15px",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "15px",
              fontWeight: "700",
            }}
          >
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>

          <button
            type="submit"
            form="checkout-form"
            disabled={submitting}
            style={{
              width: "100%",
              marginTop: "16px",
              border: "none",
              background: "#202228",
              color: "#fff",
              padding: "14px",
              borderRadius: "8px",
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: "12px",
              fontWeight: "600",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting
              ? "Placing order..."
              : `Place Order · ${formatCurrency(total)}`}
          </button>
        </aside>
      </div>
    </main>
  );
}
