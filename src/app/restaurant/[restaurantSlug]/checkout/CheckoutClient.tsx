"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PaymentMethod = "CASH" | "UPI";

type SharedCartItem = {
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
  items: SharedCartItem[];
  total: number;
  session: {
    id: number;
    restaurantId: number;
    tableId: number;
    groupCode: string;
  };
};

function formatCurrency(value: number) {
  return `₹${value.toFixed(2)}`;
}

export default function CheckoutClient({
  restaurantSlug,
}: {
  restaurantSlug: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderType =
    searchParams.get("orderType") === "DINE_IN"
      ? "DINE_IN"
      : "TAKEAWAY";

  const tableIdParam = searchParams.get("tableId");
  const sessionIdParam = searchParams.get("sessionId");

  const tableId = tableIdParam
    ? Number(tableIdParam)
    : null;

  const sessionId = sessionIdParam
    ? Number(sessionIdParam)
    : null;

  const [items, setItems] = useState<SharedCartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(
    orderType === "DINE_IN"
  );

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

  /*
   * LOAD SHARED TABLE CART
   */
  useEffect(() => {
    if (orderType !== "DINE_IN") {
      setMounted(true);
      setLoading(false);
      return;
    }

    if (
      !sessionId ||
      Number.isNaN(sessionId)
    ) {
      setError("Table session not found.");
      setMounted(true);
      setLoading(false);
      return;
    }

    loadSharedCart();

  }, [
    orderType,
    restaurantSlug,
    sessionId,
  ]);

  const loadSharedCart = async () => {
    if (
      !sessionId ||
      Number.isNaN(sessionId)
    ) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/customer/table-session/items?restaurantSlug=${encodeURIComponent(
          restaurantSlug
        )}&tableSessionId=${encodeURIComponent(
          String(sessionId)
        )}`,
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as
          | SharedCartResponse
          | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Unable to load shared cart."
        );
      }

      const cartData =
        data as SharedCartResponse;

      setItems(cartData.items || []);
      setSubtotal(Number(cartData.total) || 0);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load shared cart."
      );
    } finally {
      setLoading(false);
      setMounted(true);
    }
  };

  /*
   * APPLY COUPON
   */
  const applyCoupon = async () => {
    setError("");

    if (!couponCode.trim()) {
      setError("Enter a coupon code.");
      return;
    }

    try {
      setCouponLoading(true);

      const response = await fetch(
        "/api/customer/coupons",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            restaurantSlug,
            code: couponCode,
            subtotal,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to apply coupon."
        );
      }

      setAppliedCoupon(data.code);
      setCouponDiscount(
        Number(data.discount) || 0
      );

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

  const total = Math.max(
    0,
    subtotal - couponDiscount
  );

  /*
   * LOADING
   */
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

  /*
   * SUBMITTED
   */
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
          <div
            style={{
              fontSize: "42px",
              marginBottom: "12px",
            }}
          >
            ✓
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "22px",
            }}
          >
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
            The restaurant will confirm your
            table order shortly.
            <br />
            Your total is{" "}
            {formatCurrency(total)}.
          </p>

          <button
            onClick={() =>
              router.push(
                `/restaurant/${encodeURIComponent(
                  restaurantSlug
                )}?orderType=DINE_IN&tableId=${encodeURIComponent(
                  String(tableId)
                )}&sessionId=${encodeURIComponent(
                  String(sessionId)
                )}`
              )
            }
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

  /*
   * EMPTY CART
   */
  if (items.length === 0) {
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
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "42px",
              marginBottom: "12px",
            }}
          >
            🛒
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "21px",
            }}
          >
            Shared cart is empty
          </h1>

          <button
            onClick={() =>
              router.push(
                `/restaurant/${encodeURIComponent(
                  restaurantSlug
                )}?orderType=DINE_IN&tableId=${encodeURIComponent(
                  String(tableId)
                )}&sessionId=${encodeURIComponent(
                  String(sessionId)
                )}`
              )
            }
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

  /*
   * PLACE ORDER
   */
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }

    if (
      !/^\+?[0-9\s-]{10,}$/.test(
        phone.trim()
      )
    ) {
      setError(
        "Enter a valid phone number."
      );
      return;
    }

    if (
      !tableId ||
      Number.isNaN(tableId)
    ) {
      setError("Invalid table.");
      return;
    }

    if (
      !sessionId ||
      Number.isNaN(sessionId)
    ) {
      setError("Invalid table session.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        "/api/customer/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            restaurantSlug,

            customer: {
              name,
              phone,
              address: null,
            },

            orderType: "DINE_IN",

            paymentMethod,

            couponCode:
              appliedCoupon || null,

            tableId,

            tableSessionId: sessionId,

            items: items.map((item) => ({
              productId:
                item.productId,

              variantId:
                item.variantId,

              quantity:
                item.quantity,
            })),
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to place order."
        );
      }

      /*
       * Clear the shared table cart
       * after successful order.
       */
      try {
        await fetch(
          "/api/customer/table-session/items",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              restaurantSlug,
              tableSessionId:
                sessionId,
              clearAll: true,
            }),
          }
        );
      } catch {
        // Order is already created.
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
          borderBottom:
            "1px solid #eaecf0",
          padding: "16px 22px",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: "15px",
          }}
        >
          <button
            onClick={() => router.back()}
            style={{
              border:
                "1px solid #eaecf0",
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
            <h1
              style={{
                margin: 0,
                fontSize: "18px",
              }}
            >
              Table Checkout
            </h1>

            <div
              style={{
                marginTop: "3px",
                fontSize: "11px",
                color: "#858a94",
              }}
            >
              Shared table order
            </div>
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "28px 22px 60px",
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) 320px",
          gap: "22px",
          alignItems: "start",
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          {/* CUSTOMER DETAILS */}
          <section
            style={{
              background: "#fff",
              border:
                "1px solid #eaecf0",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: "16px",
              }}
            >
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
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
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
                onChange={(event) =>
                  setPhone(
                    event.target.value
                  )
                }
                placeholder="10-digit phone number"
                inputMode="tel"
                required
                style={inputStyle}
              />
            </label>
          </section>

          {/* PAYMENT */}
          <section
            style={{
              background: "#fff",
              border:
                "1px solid #eaecf0",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: "16px",
              }}
            >
              Payment method
            </h2>

            <div
              style={{
                display: "grid",
                gap: "10px",
              }}
            >
              {(
                ["CASH", "UPI"] as PaymentMethod[]
              ).map((method) => (
                <label
                  key={method}
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: "9px",
                    padding: "12px",
                    border: `1px solid ${
                      paymentMethod ===
                      method
                        ? "#202228"
                        : "#d0d5dd"
                    }`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={
                      paymentMethod ===
                      method
                    }
                    onChange={() =>
                      setPaymentMethod(
                        method
                      )
                    }
                  />

                  {method === "CASH"
                    ? "Cash"
                    : "UPI"}
                </label>
              ))}
            </div>
          </section>

          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
                color: "#b42318",
                fontSize: "12px",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              border: "none",
              background: "#202228",
              color: "#fff",
              padding: "14px",
              borderRadius: "8px",
              cursor: submitting
                ? "not-allowed"
                : "pointer",
              fontSize: "12px",
              fontWeight: "600",
              opacity: submitting
                ? 0.7
                : 1,
            }}
          >
            {submitting
              ? "Placing order..."
              : `Place Order · ${formatCurrency(
                  total
                )}`}
          </button>
        </form>

        {/* ORDER SUMMARY */}
        <aside
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            padding: "20px",
            position: "sticky",
            top: "90px",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: "16px",
            }}
          >
            Shared Order Summary
          </h2>

          {items.map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: "12px",
                marginBottom: "12px",
                fontSize: "12px",
              }}
            >
              <span>
                {item.name} ×{" "}
                {item.quantity}

                {item.variantName
                  ? ` (${item.variantName})`
                  : ""}
              </span>

              <strong>
                {formatCurrency(
                  item.price *
                    item.quantity
                )}
              </strong>
            </div>
          ))}

          <div
            style={{
              borderTop:
                "1px solid #eaecf0",
              marginTop: "16px",
              paddingTop: "15px",
              display: "flex",
              justifyContent:
                "space-between",
              fontWeight: "700",
            }}
          >
            <span>Subtotal</span>
            <span>
              {formatCurrency(
                subtotal
              )}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "16px",
            }}
          >
            <input
              value={couponCode}
              onChange={(event) => {
                setCouponCode(
                  event.target.value.toUpperCase()
                );
                setAppliedCoupon("");
                setCouponDiscount(0);
              }}
              placeholder="Coupon code"
              style={{
                ...inputStyle,
                flex: 1,
              }}
            />

            <button
              type="button"
              onClick={applyCoupon}
              disabled={couponLoading}
              style={{
                border:
                  "1px solid #d0d5dd",
                background: "#fff",
                borderRadius: "8px",
                padding: "0 12px",
                cursor:
                  "pointer",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              {couponLoading
                ? "..."
                : "Apply"}
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
              {appliedCoupon} applied ·
              You save{" "}
              {formatCurrency(
                couponDiscount
              )}
            </div>
          )}

          <div
            style={{
              borderTop:
                "1px solid #eaecf0",
              marginTop: "16px",
              paddingTop: "15px",
              display: "flex",
              justifyContent:
                "space-between",
              fontSize: "15px",
              fontWeight: "700",
            }}
          >
            <span>Total</span>
            <span>
              {formatCurrency(total)}
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
}

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