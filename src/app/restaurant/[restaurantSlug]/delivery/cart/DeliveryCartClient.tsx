"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  clearDeliveryCart,
  getDeliveryCart,
  getDeliveryCartTotal,
  removeDeliveryCartItem,
  updateDeliveryCartItem,
  type DeliveryCartItem,
} from "@/lib/customer/delivery-cart";

export default function DeliveryCartClient({
  restaurantSlug,
}: {
  restaurantSlug: string;
}) {
  const router = useRouter();

  const [items, setItems] = useState<DeliveryCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(0);
  const [freeDeliveryMinimum, setFreeDeliveryMinimum] =
    useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(getDeliveryCart(restaurantSlug));
    loadDeliverySettings();
    setLoading(false);
  }, [restaurantSlug]);

  async function loadDeliverySettings() {
    try {
      const response = await fetch(
        `/api/customer/storefront/${encodeURIComponent(
          restaurantSlug
        )}/delivery`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Delivery is unavailable.");
      }

      setRestaurantName(data.restaurant?.name || "");
      setDeliveryFee(
        Number(data.deliverySettings?.delivery_fee ?? 0)
      );
      setMinimumOrderAmount(
        Number(data.deliverySettings?.minimum_order_amount ?? 0)
      );
      setFreeDeliveryMinimum(
        data.deliverySettings?.free_delivery_minimum == null
          ? null
          : Number(data.deliverySettings.free_delivery_minimum)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load delivery settings."
      );
    }
  }

  const subtotal = getDeliveryCartTotal(items);

  const effectiveDeliveryFee =
    freeDeliveryMinimum !== null &&
    subtotal >= freeDeliveryMinimum
      ? 0
      : deliveryFee;

  const total = subtotal + effectiveDeliveryFee;

  function refreshCart(nextItems: DeliveryCartItem[]) {
    setItems(nextItems);
  }

  function changeQuantity(item: DeliveryCartItem, quantity: number) {
    refreshCart(
      updateDeliveryCartItem(
        restaurantSlug,
        item.key,
        quantity
      )
    );
  }

  function removeItem(key: string) {
    refreshCart(removeDeliveryCartItem(restaurantSlug, key));
  }

  function handleContinue() {
    setError("");

    if (items.length === 0) {
      setError("Your delivery cart is empty.");
      return;
    }

    if (!customerName.trim() || !phone.trim() ||
        !address.trim() || !pincode.trim()) {
      setError("Please fill in all delivery details.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }

    if (subtotal < minimumOrderAmount) {
      setError(
        `Minimum order amount is ₹${minimumOrderAmount}.`
      );
      return;
    }

    const deliveryDetails = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      pincode: pincode.trim(),
    };

    sessionStorage.setItem(
      `soraminds_delivery_details_${restaurantSlug}`,
      JSON.stringify(deliveryDetails)
    );

    router.push(
      `/restaurant/${encodeURIComponent(
        restaurantSlug
      )}/delivery/checkout`
    );
  }

  if (loading) {
    return <main style={{ padding: 40 }}>Loading delivery cart...</main>;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f9fb",
        padding: "30px 16px",
      }}
    >
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        <button
          onClick={() =>
            router.push(`/restaurant/${restaurantSlug}/delivery`)
          }
          style={{
            border: 0,
            background: "transparent",
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          ← Back to menu
        </button>

        <h1 style={{ marginBottom: 5 }}>Your delivery cart</h1>
        <p style={{ color: "#667085", marginTop: 0 }}>
          {restaurantName || "Review your items and delivery address"}
        </p>

        {items.length === 0 ? (
          <section
            style={{
              background: "#fff",
              padding: 28,
              borderRadius: 14,
              textAlign: "center",
            }}
          >
            <p>Your cart is empty.</p>
            <button onClick={() =>
              router.push(`/restaurant/${restaurantSlug}/delivery`)
            }>
              Browse menu
            </button>
          </section>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
              alignItems: "start",
            }}
          >
            <section
              style={{
                background: "#fff",
                padding: 20,
                borderRadius: 14,
              }}
            >
              <h2 style={{ fontSize: 17 }}>Items</h2>

              {items.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "14px 0",
                    borderBottom: "1px solid #eaecf0",
                  }}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={{
                        width: 70,
                        height: 70,
                        borderRadius: 8,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 70,
                        height: 70,
                        background: "#f2f4f7",
                        borderRadius: 8,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      🍽️
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    <strong>{item.name}</strong>

                    {item.variantName && (
                      <div style={{ fontSize: 12, color: "#667085" }}>
                        {item.variantName}
                      </div>
                    )}

                    <div style={{ marginTop: 5 }}>₹{item.price}</div>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        marginTop: 8,
                      }}
                    >
                      <button
                        onClick={() =>
                          changeQuantity(item, item.quantity - 1)
                        }
                        disabled={item.quantity <= 1}
                      >
                        −
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        onClick={() =>
                          changeQuantity(item, item.quantity + 1)
                        }
                      >
                        +
                      </button>

                      <button
                        onClick={() => removeItem(item.key)}
                        style={{
                          marginLeft: "auto",
                          border: 0,
                          background: "transparent",
                          color: "#d92d20",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <strong>₹{item.price * item.quantity}</strong>
                </div>
              ))}

              <button
                onClick={() => {
                  clearDeliveryCart(restaurantSlug);
                  setItems([]);
                }}
                style={{
                  marginTop: 15,
                  border: 0,
                  background: "transparent",
                  color: "#d92d20",
                  cursor: "pointer",
                }}
              >
                Clear cart
              </button>
            </section>

            <div style={{ display: "grid", gap: 20 }}>
              <section
                style={{
                  background: "#fff",
                  padding: 20,
                  borderRadius: 14,
                }}
              >
                <h2 style={{ fontSize: 17 }}>Delivery details</h2>

                <div style={{ display: "grid", gap: 12 }}>
                  <input
                    placeholder="Full name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={inputStyle}
                  />

                  <input
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, ""))
                    }
                    style={inputStyle}
                  />

                  <textarea
                    placeholder="House/flat number, street, area and landmark"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    style={inputStyle}
                  />

                  <input
                    placeholder="6-digit pincode"
                    inputMode="numeric"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) =>
                      setPincode(e.target.value.replace(/\D/g, ""))
                    }
                    style={inputStyle}
                  />
                </div>
              </section>

              <section
                style={{
                  background: "#fff",
                  padding: 20,
                  borderRadius: 14,
                }}
              >
                <h2 style={{ fontSize: 17 }}>Bill details</h2>

                <BillRow label="Subtotal" value={subtotal} />
                <BillRow
                  label="Delivery fee"
                  value={effectiveDeliveryFee}
                />

                {freeDeliveryMinimum !== null &&
                  subtotal < freeDeliveryMinimum && (
                    <p style={{ fontSize: 12, color: "#667085" }}>
                      Add ₹{Math.max(0, freeDeliveryMinimum - subtotal).toFixed(2)}
                      {" "}more for free delivery.
                    </p>
                  )}

                <hr style={{ border: 0, borderTop: "1px solid #eaecf0" }} />

                <BillRow label="Total" value={total} bold />

                {minimumOrderAmount > 0 && (
                  <p style={{ fontSize: 12, color: "#667085" }}>
                    Minimum order: ₹{minimumOrderAmount}
                  </p>
                )}

                {error && (
                  <p style={{ color: "#d92d20", fontSize: 13 }}>
                    {error}
                  </p>
                )}

                <button
                  onClick={handleContinue}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: 14,
                    border: 0,
                    borderRadius: 9,
                    background: "#202228",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Continue to checkout
                </button>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function BillRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        margin: "12px 0",
        fontWeight: bold ? 700 : 400,
      }}
    >
      <span>{label}</span>
      <span>₹{value.toFixed(2)}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
};