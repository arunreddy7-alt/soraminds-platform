"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  CartItem,
  getCart,
  getCartTotal,
  updateCartItem,
  removeCartItem,
} from "@/lib/cart";

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

export default function CartClient({
  restaurantSlug,
}: {
  restaurantSlug: string;
}) {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const orderType =
    searchParams.get("orderType") ===
    "DINE_IN"
      ? "DINE_IN"
      : "TAKEAWAY";

  const tableIdParam =
    searchParams.get("tableId");

  const sessionIdParam =
    searchParams.get("sessionId");

  const tableId = tableIdParam
    ? Number(tableIdParam)
    : null;

  const sessionId = sessionIdParam
    ? Number(sessionIdParam)
    : null;

  const [items, setItems] =
    useState<
      CartItem[] | SharedCartItem[]
    >([]);

  const [total, setTotal] =
    useState(0);

  const [mounted, setMounted] =
    useState(false);

  const [loading, setLoading] =
    useState(
      orderType === "DINE_IN"
    );

  const [error, setError] =
    useState("");

  const [sessionCode, setSessionCode] =
    useState("");

  /* --------------------------------
     TAKEAWAY CART
  -------------------------------- */

  useEffect(() => {
    if (orderType !== "TAKEAWAY") {
      return;
    }

    setItems(
      getCart(restaurantSlug)
    );

    setTotal(
      getCartTotal(
        getCart(restaurantSlug)
      )
    );

    setMounted(true);
  }, [
    restaurantSlug,
    orderType,
  ]);

  /* --------------------------------
     DINE-IN SHARED CART
  -------------------------------- */

  useEffect(() => {
    if (
      orderType !== "DINE_IN"
    ) {
      return;
    }

    if (
      !sessionId ||
      Number.isNaN(sessionId)
    ) {
      setError(
        "Table session not found."
      );
      setLoading(false);
      setMounted(true);
      return;
    }

    loadSharedCart();

    /*
     * Poll every 2 seconds.
     *
     * This makes changes from another
     * phone appear automatically.
     */
    const interval =
      window.setInterval(() => {
        loadSharedCart(true);
      }, 2000);

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    orderType,
    restaurantSlug,
    sessionId,
  ]);

  const loadSharedCart = async (
    silent = false
  ) => {
    if (
      !sessionId ||
      Number.isNaN(sessionId)
    ) {
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }

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
          "error" in data &&
            data.error
            ? data.error
            : "Unable to load shared cart."
        );
      }

      const cartData =
        data as SharedCartResponse;

      setItems(
        cartData.items
      );

      setTotal(
        Number(cartData.total)
      );

      setSessionCode(
  cartData.session?.groupCode || ""
);

      setError("");
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load shared cart."
        );
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setMounted(true);
      }
    }
  };

  /* --------------------------------
     UPDATE QUANTITY
  -------------------------------- */

  const updateQuantity = async (
    key: string,
    quantity: number
  ) => {
    /*
     * TAKEAWAY
     */
    if (
      orderType === "TAKEAWAY"
    ) {
      const updated =
        updateCartItem(
          restaurantSlug,
          key,
          quantity
        );

      setItems(updated);
      setTotal(
        getCartTotal(updated)
      );

      return;
    }

    /*
     * DINE-IN
     */
    if (
      !sessionId ||
      Number.isNaN(sessionId)
    ) {
      return;
    }

    const item = (
      items as SharedCartItem[]
    ).find(
      (current) =>
        current.key === key
    );

    if (!item) {
      return;
    }

    try {
      const response =
        await fetch(
          "/api/customer/table-session/items",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              restaurantSlug,
              tableSessionId:
                sessionId,
              itemId: item.id,
              quantity,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update quantity."
        );
      }

      await loadSharedCart(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update quantity."
      );
    }
  };

  /* --------------------------------
     REMOVE ITEM
  -------------------------------- */

  const removeItem = async (
    key: string
  ) => {
    /*
     * TAKEAWAY
     */
    if (
      orderType === "TAKEAWAY"
    ) {
      const updated =
        removeCartItem(
          restaurantSlug,
          key
        );

      setItems(updated);
      setTotal(
        getCartTotal(updated)
      );

      return;
    }

    /*
     * DINE-IN
     */
    if (
      !sessionId ||
      Number.isNaN(sessionId)
    ) {
      return;
    }

    const item = (
      items as SharedCartItem[]
    ).find(
      (current) =>
        current.key === key
    );

    if (!item) {
      return;
    }

    try {
      const response =
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
              itemId: item.id,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to remove item."
        );
      }

      await loadSharedCart(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove item."
      );
    }
  };

  /* --------------------------------
     NAVIGATION HELPERS
  -------------------------------- */

  const restaurantUrl =
    orderType === "DINE_IN" &&
    tableId &&
    sessionId
      ? `/restaurant/${encodeURIComponent(
          restaurantSlug
        )}?orderType=DINE_IN&tableId=${encodeURIComponent(
          String(tableId)
        )}&sessionId=${encodeURIComponent(
          String(sessionId)
        )}`
      : `/restaurant/${encodeURIComponent(
          restaurantSlug
        )}?orderType=TAKEAWAY`;

  const checkoutUrl =
    orderType === "DINE_IN" &&
    tableId &&
    sessionId
      ? `/restaurant/${encodeURIComponent(
          restaurantSlug
        )}/checkout?orderType=DINE_IN&tableId=${encodeURIComponent(
          String(tableId)
        )}&sessionId=${encodeURIComponent(
          String(sessionId)
        )}`
      : `/restaurant/${encodeURIComponent(
          restaurantSlug
        )}/checkout?orderType=TAKEAWAY`;

  /* --------------------------------
     LOADING
  -------------------------------- */

  if (!mounted || loading) {
    return (
      <div
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
        Loading cart...
      </div>
    );
  }

  /* --------------------------------
     ERROR
  -------------------------------- */

  if (error && items.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f8f9fb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "30px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "360px",
          }}
        >
          <div
            style={{
              fontSize: "45px",
              marginBottom: "12px",
            }}
          >
            ⚠️
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: "20px",
            }}
          >
            Unable to load cart
          </h2>

          <p
            style={{
              color: "#858a94",
              fontSize: "12px",
              lineHeight: 1.5,
              marginTop: "8px",
            }}
          >
            {error}
          </p>

          <button
            onClick={() =>
              router.push(
                restaurantUrl
              )
            }
            style={{
              marginTop: "15px",
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
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  /* --------------------------------
     RENDER
  -------------------------------- */

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
            padding: "16px 22px",
            display: "flex",
            alignItems: "center",
            gap: "15px",
          }}
        >
          <button
            onClick={() =>
              router.push(
                restaurantUrl
              )
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
              {orderType ===
              "DINE_IN"
                ? sessionCode
                  ? `Shared Table Cart • ${sessionCode}`
                  : "Shared Table Cart"
                : "Review your items before checkout"}
            </div>
          </div>
        </div>
      </header>

      {/* ERROR BANNER */}

      {error && (
        <div
          style={{
            maxWidth: "1100px",
            margin: "15px auto 0",
            padding: "0 22px",
          }}
        >
          <div
            style={{
              background: "#fef3f2",
              border:
                "1px solid #fecdca",
              color: "#b42318",
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          >
            {error}
          </div>
        </div>
      )}

      {/* DINE-IN INFO */}

      {orderType === "DINE_IN" && sessionCode && (
  <div
    style={{
      maxWidth: "1100px",
      margin: "15px auto 0",
      padding: "0 22px",
    }}
  >
    <div
      style={{
        background: "#fff",
        border: "1px solid #eaecf0",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: "600",
          color: "#667085",
          marginBottom: "8px",
        }}
      >
        👥 Shared Table Cart
      </div>

      <div
        style={{
          fontSize: "11px",
          color: "#858a94",
          marginBottom: "10px",
        }}
      >
        Everyone at this table is using the same
        cart. Share this code with others at your
        table so they can join.
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#f2f4f7",
          borderRadius: "8px",
          padding: "9px 14px",
          fontSize: "18px",
          fontWeight: "800",
          letterSpacing: "3px",
          color: "#202228",
        }}
      >
        {sessionCode}
      </div>
    </div>
  </div>
)}

      <main
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "28px 22px 60px",
        }}
      >
        {/* EMPTY */}

        {items.length === 0 ? (
          <div
            style={{
              minHeight: "400px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
                  margin: "8px 0 20px",
                }}
              >
                Add some delicious
                items from the menu
                to get started.
              </p>

              <button
                onClick={() =>
                  router.push(
                    restaurantUrl
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
                        padding: "14px",
                        display:
                          "flex",
                        gap: "14px",
                      }}
                    >
                      {/* IMAGE */}

                      <div
                        style={{
                          width: "90px",
                          height: "90px",
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
                            {Number(
                              item.price
                            ).toFixed(2)}
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
                                  Math.max(
                                    0,
                                    item.quantity -
                                      1
                                  )
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
                                  Math.min(
                                    20,
                                    item.quantity +
                                      1
                                  )
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
                            Number(
                              item.price
                            ) *
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
                      restaurantUrl
                    )
                  }
                  style={{
                    alignSelf:
                      "flex-start",
                    border:
                      "1px solid #d0d5dd",
                    background: "#fff",
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
                  padding: "20px",
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
                    {Number(
                      total
                    ).toFixed(2)}
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
                    {Number(
                      total
                    ).toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() =>
                    router.push(
                      checkoutUrl
                    )
                  }
                  style={{
                    width: "100%",
                    marginTop:
                      "18px",
                    border: "none",
                    background:
                      "#202228",
                    color: "#fff",
                    padding: "13px",
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