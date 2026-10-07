"use client";

import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  CartItem,
  getCart,
  getCartTotal,
  updateCartItem,
  removeCartItem,
} from "@/lib/cart";

export default function CartClient({
  restaurantSlug,
}: {
  restaurantSlug: string;
}) {
  const router = useRouter();

  const [items, setItems] =
    useState<CartItem[]>([]);

  const [mounted, setMounted] =
    useState(false);

  useEffect(() => {
    setItems(
      getCart(restaurantSlug)
    );

    setMounted(true);
  }, [restaurantSlug]);

  const updateQuantity = (
    key: string,
    quantity: number
  ) => {
    const updated =
      updateCartItem(
        restaurantSlug,
        key,
        quantity
      );

    setItems(updated);
  };

  const removeItem = (
    key: string
  ) => {
    const updated =
      removeCartItem(
        restaurantSlug,
        key
      );

    setItems(updated);
  };

  const total = getCartTotal(items);

  if (!mounted) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f9fb",
        color: "#202228",
      }}
    >
      {/* HEADER */}

      <header
        style={{
          background: "#ffffff",
          borderBottom:
            "1px solid #eaecf0",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding:
              "16px 22px",
            display: "flex",
            alignItems: "center",
            gap: "15px",
          }}
        >
          <button
            onClick={() =>
              router.back()
            }
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
            <div
              style={{
                fontSize: "18px",
                fontWeight: "700",
              }}
            >
              Your Cart
            </div>

            <div
              style={{
                marginTop: "3px",
                fontSize: "11px",
                color: "#858a94",
              }}
            >
              Review your items
              before checkout
            </div>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding:
            "28px 22px 60px",
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              minHeight: "400px",
              display: "flex",
              alignItems: "center",
              justifyContent:
                "center",
            }}
          >
            <div
              style={{
                textAlign: "center",
                maxWidth: "350px",
              }}
            >
              <div
                style={{
                  fontSize: "48px",
                  marginBottom: "12px",
                }}
              >
                🛒
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                }}
              >
                Your cart is empty
              </h2>

              <p
                style={{
                  color: "#858a94",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  margin:
                    "8px 0 20px",
                }}
              >
                Add some delicious
                items from the menu
                to get started.
              </p>

              <button
                onClick={() =>
                  router.push(
                    `/restaurant/${restaurantSlug}`
                  )
                }
                style={{
                  border: "none",
                  background:
                    "#202228",
                  color: "#fff",
                  padding:
                    "11px 18px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                Browse Menu
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1fr) 320px",
                gap: "22px",
                alignItems:
                  "start",
              }}
            >
              {/* ITEMS */}

              <div
                style={{
                  display: "flex",
                  flexDirection:
                    "column",
                  gap: "12px",
                }}
              >
                {items.map(
                  (item) => (
                    <div
                      key={item.key}
                      style={{
                        background:
                          "#fff",
                        border:
                          "1px solid #eaecf0",
                        borderRadius:
                          "12px",
                        padding:
                          "14px",
                        display:
                          "flex",
                        gap: "14px",
                      }}
                    >
                      {/* IMAGE */}

                      <div
                        style={{
                          width:
                            "90px",
                          height:
                            "90px",
                          borderRadius:
                            "9px",
                          overflow:
                            "hidden",
                          background:
                            "#f2f4f7",
                          flexShrink: 0,
                        }}
                      >
                        {item.imageUrl ? (
                          <img
                            src={
                              item.imageUrl
                            }
                            alt={
                              item.name
                            }
                            style={{
                              width:
                                "100%",
                              height:
                                "100%",
                              objectFit:
                                "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width:
                                "100%",
                              height:
                                "100%",
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              fontSize:
                                "25px",
                            }}
                          >
                            🍽️
                          </div>
                        )}
                      </div>

                      {/* DETAILS */}

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap: "10px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize:
                                  "14px",
                                fontWeight:
                                  "600",
                              }}
                            >
                              {
                                item.name
                              }
                            </div>

                            {item.variantName && (
                              <div
                                style={{
                                  marginTop:
                                    "4px",
                                  fontSize:
                                    "11px",
                                  color:
                                    "#858a94",
                                }}
                              >
                                {
                                  item.variantName
                                }
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() =>
                              removeItem(
                                item.key
                              )
                            }
                            style={{
                              border:
                                "none",
                              background:
                                "transparent",
                              color:
                                "#98a2b3",
                              cursor:
                                "pointer",
                              fontSize:
                                "18px",
                              padding:
                                "0 4px",
                            }}
                          >
                            ×
                          </button>
                        </div>

                        <div
                          style={{
                            marginTop:
                              "14px",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                            gap: "15px",
                          }}
                        >
                          <div
                            style={{
                              fontSize:
                                "14px",
                              fontWeight:
                                "700",
                            }}
                          >
                            ₹
                            {item.price.toFixed(
                              2
                            )}
                          </div>

                          {/* QUANTITY */}

                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              border:
                                "1px solid #d0d5dd",
                              borderRadius:
                                "7px",
                              overflow:
                                "hidden",
                            }}
                          >
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.key,
                                  item.quantity -
                                    1
                                )
                              }
                              style={{
                                border:
                                  "none",
                                background:
                                  "#fff",
                                width:
                                  "30px",
                                height:
                                  "30px",
                                cursor:
                                  "pointer",
                                fontSize:
                                  "16px",
                              }}
                            >
                              −
                            </button>

                            <span
                              style={{
                                width:
                                  "30px",
                                textAlign:
                                  "center",
                                fontSize:
                                  "12px",
                                fontWeight:
                                  "600",
                              }}
                            >
                              {
                                item.quantity
                              }
                            </span>

                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.key,
                                  item.quantity +
                                    1
                                )
                              }
                              style={{
                                border:
                                  "none",
                                background:
                                  "#fff",
                                width:
                                  "30px",
                                height:
                                  "30px",
                                cursor:
                                  "pointer",
                                fontSize:
                                  "16px",
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop:
                              "8px",
                            fontSize:
                              "11px",
                            color:
                              "#858a94",
                          }}
                        >
                          Item total: ₹
                          {(
                            item.price *
                            item.quantity
                          ).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )
                )}

                <button
                  onClick={() =>
                    router.push(
                      `/restaurant/${restaurantSlug}`
                    )
                  }
                  style={{
                    alignSelf:
                      "flex-start",
                    border:
                      "1px solid #d0d5dd",
                    background:
                      "#fff",
                    color:
                      "#344054",
                    padding:
                      "10px 15px",
                    borderRadius:
                      "8px",
                    cursor:
                      "pointer",
                    fontSize:
                      "12px",
                    fontWeight:
                      "600",
                  }}
                >
                  ← Continue
                  Shopping
                </button>
              </div>

              {/* SUMMARY */}

              <div
                style={{
                  background:
                    "#fff",
                  border:
                    "1px solid #eaecf0",
                  borderRadius:
                    "12px",
                  padding:
                    "20px",
                  position:
                    "sticky",
                  top: "90px",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "16px",
                    fontWeight:
                      "700",
                    marginBottom:
                      "18px",
                  }}
                >
                  Order Summary
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    fontSize:
                      "12px",
                    color:
                      "#667085",
                    marginBottom:
                      "10px",
                  }}
                >
                  <span>
                    Subtotal
                  </span>

                  <span>
                    ₹
                    {total.toFixed(
                      2
                    )}
                  </span>
                </div>

                <div
                  style={{
                    height: "1px",
                    background:
                      "#eaecf0",
                    margin:
                      "15px 0",
                  }}
                />

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    fontSize:
                      "15px",
                    fontWeight:
                      "700",
                  }}
                >
                  <span>
                    Total
                  </span>

                  <span>
                    ₹
                    {total.toFixed(
                      2
                    )}
                  </span>
                </div>

                <button
                  onClick={() =>
                    router.push(
                      `/restaurant/${restaurantSlug}/checkout`
                    )
                  }
                  style={{
                    width:
                      "100%",
                    marginTop:
                      "18px",
                    border:
                      "none",
                    background:
                      "#202228",
                    color:
                      "#fff",
                    padding:
                      "13px",
                    borderRadius:
                      "8px",
                    cursor:
                      "pointer",
                    fontSize:
                      "12px",
                    fontWeight:
                      "600",
                  }}
                >
                  Proceed to
                  Checkout
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}