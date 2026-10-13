
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearDeliveryCart,
  getDeliveryCart,
  getDeliveryCartTotal,
  type DeliveryCartItem,
} from "@/lib/customer/delivery-cart";

type DeliveryDetails = {
  customerName: string;
  phone: string;
  address: string;
  pincode: string;
};

export default function DeliveryCheckoutClient({
  restaurantSlug,
}: {
  restaurantSlug: string;
}) {
  const router = useRouter();

  const [items, setItems] = useState<DeliveryCartItem[]>([]);
  const [details, setDetails] = useState<DeliveryDetails>({
    customerName: "",
    phone: "",
    address: "",
    pincode: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successOrderId, setSuccessOrderId] = useState<string | number | null>(
    null
  );

  useEffect(() => {
    setItems(getDeliveryCart(restaurantSlug));

    try {
      const saved = sessionStorage.getItem(
        `soraminds_delivery_details_${restaurantSlug}`
      );

      if (saved) {
        setDetails((current) => ({
          ...current,
          ...JSON.parse(saved),
        }));
      }
    } catch {
      // Ignore invalid saved delivery details.
    }

    async function loadSettings() {
      try {
        const response = await fetch(
          `/api/customer/storefront/${encodeURIComponent(
            restaurantSlug
          )}/delivery`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (response.ok) {
          setDeliveryFee(
            Number(data.deliverySettings?.delivery_fee ?? 0)
          );
        }
      } catch {
        // Settings can be rechecked by the server when placing the order.
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, [restaurantSlug]);

  const subtotal = getDeliveryCartTotal(items);
  const total = subtotal + deliveryFee;

  function updateDetail<K extends keyof DeliveryDetails>(
    field: K,
    value: DeliveryDetails[K]
  ) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  async function placeOrder() {
    setError("");

    if (items.length === 0) {
      setError("Your delivery cart is empty.");
      return;
    }

    if (
      !details.customerName.trim() ||
      !details.phone.trim() ||
      !details.address.trim() ||
      !details.pincode.trim()
    ) {
      setError("Please complete all delivery details.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(details.phone.trim())) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!/^\d{6}$/.test(details.pincode.trim())) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/customer/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantSlug,
          orderType: "DELIVERY",
          paymentMethod,
          customer: {
            name: details.customerName.trim(),
            phone: details.phone.trim(),
            address: `${details.address.trim()}, PIN: ${details.pincode.trim()}`,
          },
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          delivery: {
            pincode: details.pincode.trim(),
            address: details.address.trim(),
            deliveryFee,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to place your order.");
      }

      const orderId =
        data.order?.id ??
        data.order?.order_id ??
        data.orderId ??
        data.id ??
        null;

      clearDeliveryCart(restaurantSlug);
      setItems([]);
      setSuccessOrderId(orderId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while placing your order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main style={{ padding: 30 }}>Loading checkout...</main>;
  }

  if (successOrderId !== null) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <h1>Order placed successfully!</h1>
          <p>
            Your order number is <strong>#{successOrderId}</strong>.
          </p>
          <p style={{ color: "#667085" }}>
            Your restaurant will process your delivery order.
          </p>
          <button
            style={primaryButton}
            onClick={() =>
              router.push(`/restaurant/${encodeURIComponent(restaurantSlug)}/delivery`)
            }
          >
            Back to menu
          </button>
        </section>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1>Your delivery cart is empty</h1>
          <button
            style={primaryButton}
            onClick={() =>
              router.push(`/restaurant/${encodeURIComponent(restaurantSlug)}/delivery`)
            }
          >
            Browse menu
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        <button
          onClick={() =>
            router.push(`/restaurant/${encodeURIComponent(restaurantSlug)}/delivery/cart`)
          }
          style={backButton}
        >
          ← Back to cart
        </button>

        <h1>Delivery checkout</h1>
        <p style={{ color: "#667085" }}>
          Confirm your address and payment method.
        </p>

        <div style={layoutStyle}>
          <section style={cardStyle}>
            <h2 style={sectionHeading}>Delivery address</h2>

            <div style={fieldGroup}>
              <label>Full name</label>
              <input
                style={inputStyle}
                value={details.customerName}
                onChange={(e) =>
                  updateDetail("customerName", e.target.value)
                }
                placeholder="Your name"
                autoComplete="name"
              />

              <label>Mobile number</label>
              <input
                style={inputStyle}
                value={details.phone}
                onChange={(e) =>
                  updateDetail("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="10-digit mobile number"
                inputMode="numeric"
                autoComplete="tel"
              />

              <label>Full address</label>
              <textarea
                style={inputStyle}
                value={details.address}
                onChange={(e) => updateDetail("address", e.target.value)}
                placeholder="Flat/house, street, area and landmark"
                rows={4}
                autoComplete="street-address"
              />

              <label>Pincode</label>
              <input
                style={inputStyle}
                value={details.pincode}
                onChange={(e) =>
                  updateDetail("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6-digit pincode"
                inputMode="numeric"
                autoComplete="postal-code"
              />
            </div>

            <h2 style={{ ...sectionHeading, marginTop: 28 }}>
              Payment method
            </h2>

            <div style={{ display: "grid", gap: 10 }}>
              <label style={paymentOption}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "CASH"}
                  onChange={() => setPaymentMethod("CASH")}
                />
                <span>
                  <strong>Cash on delivery</strong>
                  <br />
                  <small style={{ color: "#667085" }}>
                    Pay when your order arrives
                  </small>
                </span>
              </label>

              <label style={paymentOption}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "UPI"}
                  onChange={() => setPaymentMethod("UPI")}
                />
                <span>
                  <strong>UPI</strong>
                  <br />
                  <small style={{ color: "#667085" }}>
                    UPI payment option
                  </small>
                </span>
              </label>
            </div>

            {paymentMethod === "UPI" && (
              <p style={{ color: "#946200", fontSize: 13 }}>
                Note: selecting UPI here does not initiate a payment. A UPI
                payment integration is needed to collect payment online.
              </p>
            )}

            {error && (
              <p style={{ color: "#d92d20", fontSize: 13 }}>{error}</p>
            )}

            <button
              onClick={placeOrder}
              disabled={submitting}
              style={{
                ...primaryButton,
                width: "100%",
                marginTop: 20,
                opacity: submitting ? 0.65 : 1,
              }}
            >
              {submitting ? "Placing order..." : `Place order · ₹${total.toFixed(2)}`}
            </button>
          </section>

          <section style={{ ...cardStyle, height: "fit-content" }}>
            <h2 style={sectionHeading}>Order summary</h2>

            {items.map((item) => (
              <div key={item.key} style={summaryRow}>
                <span>
                  {item.name}
                  {item.variantName ? ` (${item.variantName})` : ""}
                  {" × "}
                  {item.quantity}
                </span>
                <strong>₹{(item.price * item.quantity).toFixed(2)}</strong>
              </div>
            ))}

            <hr style={{ border: 0, borderTop: "1px solid #eaecf0" }} />

            <div style={summaryRow}>
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>

            <div style={summaryRow}>
              <span>Delivery fee</span>
              <span>₹{deliveryFee.toFixed(2)}</span>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid #eaecf0" }} />

            <div style={{ ...summaryRow, fontWeight: 700 }}>
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "30px 16px",
  background: "#f8f9fb",
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 20,
  alignItems: "start",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: 22,
  border: "1px solid #eaecf0",
  borderRadius: 14,
};

const sectionHeading: React.CSSProperties = {
  fontSize: 17,
  margin: "0 0 18px",
};

const fieldGroup: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  fontSize: 14,
};

const paymentOption: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  border: "1px solid #d0d5dd",
  padding: 13,
  borderRadius: 9,
  cursor: "pointer",
};

const primaryButton: React.CSSProperties = {
  padding: 13,
  border: 0,
  borderRadius: 8,
  background: "#202228",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const backButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  padding: 0,
  marginBottom: 15,
  cursor: "pointer",
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  margin: "13px 0",
  fontSize: 13,
};
