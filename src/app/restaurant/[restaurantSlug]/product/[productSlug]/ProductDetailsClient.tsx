"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { addToCart } from "@/lib/cart";

type Restaurant = {
  id: number;
  name: string;
  slug: string;
  accent_color: string | null;
  is_open: boolean;
  accept_orders: boolean;
};

type Product = {
  id: number;
  restaurant_id: number;
  category_id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  mrp: number | null;
  image_url: string | null;
  is_vegetarian: boolean;
  is_available: boolean;
  is_active: boolean;
};

type ProductVariant = {
  id: number;
  product_id: number;
  name: string;
  description: string | null;
  price: number;
  mrp: number | null;
  image_url: string | null;
  discount_percent: number | null;
  sort_order: number;
  is_available: boolean;
  is_active: boolean;
};

type TableSession = {
  id: number;
  restaurant_id: number;
  table_id: number;
  status: string;
  started_at: string;
  ended_at: string | null;
  group_code: string;
};

export default function ProductDetailsClient({
  restaurantSlug,
  productSlug,
}: {
  restaurantSlug: string;
  productSlug: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderType =
    searchParams.get("orderType") === "DINE_IN"
      ? "DINE_IN"
      : "TAKEAWAY";

  const tableIdParam = searchParams.get("tableId");

  const tableId = tableIdParam
    ? Number(tableIdParam)
    : null;

  /*
   * IMPORTANT:
   * For DINE-IN, sessionId is the exact shared
   * table session that every customer at the table
   * must use.
   */
  const sessionIdParam = searchParams.get("sessionId");

  const sessionId = sessionIdParam
    ? Number(sessionIdParam)
    : null;

  const [restaurant, setRestaurant] =
    useState<Restaurant | null>(null);

  const [product, setProduct] =
    useState<Product | null>(null);

  const [variants, setVariants] =
    useState<ProductVariant[]>([]);

  const [selectedVariant, setSelectedVariant] =
    useState<ProductVariant | null>(null);

  const [quantity, setQuantity] =
    useState(1);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [sessionLoading, setSessionLoading] =
    useState(false);

  const [tableSession, setTableSession] =
    useState<TableSession | null>(null);

  const [addingToCart, setAddingToCart] =
    useState(false);

  useEffect(() => {
    loadProduct();
  }, [restaurantSlug, productSlug]);

  /*
   * Load product
   */
  const loadProduct = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/customer/product/${restaurantSlug}/${productSlug}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load product."
        );
      }

      setRestaurant(data.restaurant);
      setProduct(data.product);
      setVariants(data.variants || []);

      // Select first variant automatically
      if (data.variants?.length > 0) {
        setSelectedVariant(
          data.variants[0]
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load product."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Load the exact shared table session.
   *
   * Priority:
   *
   * 1. sessionId from URL
   * 2. otherwise create/load session using tableId
   *
   * This prevents another browser from accidentally
   * falling back to a different session.
   */
  useEffect(() => {
    if (
      orderType !== "DINE_IN" ||
      !tableId ||
      Number.isNaN(tableId)
    ) {
      return;
    }

    loadTableSession();
  }, [
    orderType,
    tableId,
    sessionId,
    restaurantSlug,
  ]);

  const loadTableSession = async () => {
    if (
      !tableId ||
      Number.isNaN(tableId)
    ) {
      return;
    }

    try {
      setSessionLoading(true);
      setError("");

      /*
       * If a sessionId was supplied by the QR/session
       * flow, verify and use that exact session.
       */
      if (
        sessionId &&
        !Number.isNaN(sessionId)
      ) {
        const response = await fetch(
          `/api/customer/table-session/${encodeURIComponent(
            String(sessionId)
          )}?restaurantSlug=${encodeURIComponent(
            restaurantSlug
          )}&tableId=${encodeURIComponent(
            String(tableId)
          )}`,
          {
            cache: "no-store",
          }
        );

        if (response.ok) {
          const data = await response.json();

          if (data.session) {
            setTableSession(data.session);

            try {
              localStorage.setItem(
                `soraminds-table-session-${restaurantSlug}`,
                JSON.stringify({
                  sessionId:
                    data.session.id,
                  restaurantId:
                    data.session.restaurant_id,
                  tableId:
                    data.session.table_id,
                  groupCode:
                    data.session.group_code,
                })
              );
            } catch {
              // Ignore localStorage errors.
            }

            return;
          }
        }
      }

      /*
       * No usable sessionId was supplied.
       *
       * Fall back to the existing endpoint which
       * returns the active session for this table.
       */
      const response = await fetch(
        "/api/customer/table-session",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            restaurantSlug,
            tableId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to start table session."
        );
      }

      setTableSession(data.session);

      try {
        localStorage.setItem(
          `soraminds-table-session-${restaurantSlug}`,
          JSON.stringify({
            sessionId:
              data.session.id,
            restaurantId:
              data.session.restaurant_id,
            tableId:
              data.session.table_id,
            groupCode:
              data.session.group_code,
          })
        );
      } catch {
        // Ignore localStorage errors.
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start table session."
      );
    } finally {
      setSessionLoading(false);
    }
  };

  const currentPrice =
    selectedVariant?.price ??
    product?.price ??
    0;

  const currentMrp =
    selectedVariant?.mrp ??
    product?.mrp ??
    null;

  const increaseQuantity = () => {
    setQuantity((current) =>
      Math.min(current + 1, 20)
    );
  };

  const decreaseQuantity = () => {
    setQuantity((current) =>
      Math.max(current - 1, 1)
    );
  };

  /*
   * Add item to shared DINE-IN cart.
   *
   * The shared cart is stored in:
   *
   * table_session_items
   */
  const addToSharedCart = async () => {
    if (
      !product ||
      !restaurant ||
      !tableSession
    ) {
      throw new Error(
        "Table session is not ready."
      );
    }

    const response = await fetch(
      "/api/customer/table-session/items",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          restaurantSlug,
          tableSessionId:
            tableSession.id,
          productId: product.id,
          variantId:
            selectedVariant?.id ?? null,
          quantity,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Unable to add item to shared cart."
      );
    }

    return data;
  };

  /*
   * Add to cart
   */
  const handleAddToCart = async () => {
    if (!product || !restaurant) {
      return;
    }

    if (
      !product.is_active ||
      !product.is_available ||
      !restaurant.is_open ||
      !restaurant.accept_orders
    ) {
      return;
    }

    try {
      setAddingToCart(true);

      /*
       * DINE-IN
       *
       * Add directly to the shared
       * table session cart.
       */
      if (orderType === "DINE_IN") {
        if (
          !tableId ||
          Number.isNaN(tableId)
        ) {
          throw new Error(
            "Invalid table."
          );
        }

        /*
         * If the exact session from the URL
         * is already loaded, use it.
         *
         * Otherwise load/create the active
         * session for this table.
         */
        let activeSession =
          tableSession;

        if (
          !activeSession &&
          sessionId &&
          !Number.isNaN(sessionId)
        ) {
          await loadTableSession();
          activeSession =
            tableSession;
        }

        if (!activeSession) {
          const response = await fetch(
            "/api/customer/table-session",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                restaurantSlug,
                tableId,
              }),
            }
          );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.error ||
                "Unable to start table session."
            );
          }

          activeSession =
            data.session;

          setTableSession(
            activeSession
          );
        }

        if (!activeSession) {
          throw new Error(
            "Unable to start table session."
          );
        }

        const response = await fetch(
          "/api/customer/table-session/items",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              restaurantSlug,
              tableSessionId:
                activeSession.id,
              productId: product.id,
              variantId:
                selectedVariant?.id ??
                null,
              quantity,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to add item to shared cart."
          );
        }

        /*
         * KEEP THE EXACT TABLE SESSION
         * WHILE NAVIGATING.
         */
        router.push(
          `/restaurant/${encodeURIComponent(
            restaurantSlug
          )}/cart?orderType=DINE_IN&tableId=${encodeURIComponent(
            String(tableId)
          )}&sessionId=${encodeURIComponent(
            String(activeSession.id)
          )}`
        );

        return;
      }

      /*
       * TAKEAWAY
       *
       * Keep the existing local cart
       * implementation unchanged.
       */
      const item = {
        key: selectedVariant
          ? `${product.id}-${selectedVariant.id}`
          : `${product.id}-base`,

        productId: product.id,

        productSlug: product.slug,

        name: product.name,

        imageUrl:
          selectedVariant?.image_url ||
          product.image_url ||
          null,

        price:
          selectedVariant?.price ??
          product.price,

        quantity,

        variantId:
          selectedVariant?.id ??
          null,

        variantName:
          selectedVariant?.name ??
          null,
      };

      addToCart(
        restaurantSlug,
        item
      );

      router.push(
        `/restaurant/${encodeURIComponent(
          restaurantSlug
        )}/cart?orderType=TAKEAWAY`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add item to cart."
      );
    } finally {
      setAddingToCart(false);
    }
  };

  /*
   * Loading
   */
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#667085",
          fontSize: "14px",
        }}
      >
        Loading product...
      </div>
    );
  }

  /*
   * Error
   */
  if (
    error ||
    !product ||
    !restaurant
  ) {
    const backUrl =
      orderType === "DINE_IN" &&
      tableId
        ? `/restaurant/${encodeURIComponent(
            restaurantSlug
          )}?orderType=DINE_IN&tableId=${encodeURIComponent(
            String(tableId)
          )}${
            sessionId &&
            !Number.isNaN(sessionId)
              ? `&sessionId=${encodeURIComponent(
                  String(sessionId)
                )}`
              : ""
          }`
        : `/restaurant/${encodeURIComponent(
            restaurantSlug
          )}?orderType=TAKEAWAY`;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "30px",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "40px",
              marginBottom: "12px",
            }}
          >
            🍽️
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: "20px",
            }}
          >
            Product not found
          </h2>

          <p
            style={{
              marginTop: "7px",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            {error ||
              "This product is unavailable."}
          </p>

          <button
            onClick={() =>
              router.push(backUrl)
            }
            style={{
              marginTop: "15px",
              border: "none",
              background: "#202228",
              color: "#fff",
              padding: "10px 15px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const accent =
    restaurant.accent_color ||
    "#202228";

  const canOrder =
    restaurant.is_open &&
    restaurant.accept_orders &&
    product.is_available;

  /*
   * Helper for preserving customer context.
   */
  const getRestaurantUrl = () => {
    if (
      orderType === "DINE_IN" &&
      tableId
    ) {
      return `/restaurant/${encodeURIComponent(
        restaurantSlug
      )}?orderType=DINE_IN&tableId=${encodeURIComponent(
        String(tableId)
      )}${
        tableSession
          ? `&sessionId=${encodeURIComponent(
              String(tableSession.id)
            )}`
          : sessionId &&
            !Number.isNaN(sessionId)
          ? `&sessionId=${encodeURIComponent(
              String(sessionId)
            )}`
          : ""
      }`;
    }

    return `/restaurant/${encodeURIComponent(
      restaurantSlug
    )}?orderType=TAKEAWAY`;
  };

  const getCartUrl = () => {
    if (
      orderType === "DINE_IN" &&
      tableId
    ) {
      const activeSessionId =
        tableSession?.id ?? sessionId;

      return `/restaurant/${encodeURIComponent(
        restaurantSlug
      )}/cart?orderType=DINE_IN&tableId=${encodeURIComponent(
        String(tableId)
      )}${
        activeSessionId &&
        !Number.isNaN(activeSessionId)
          ? `&sessionId=${encodeURIComponent(
              String(activeSessionId)
            )}`
          : ""
      }`;
    }

    return `/restaurant/${encodeURIComponent(
      restaurantSlug
    )}/cart?orderType=TAKEAWAY`;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f9fb",
      }}
    >
      {/* HEADER */}

      <header
        style={{
          background: "#fff",
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
            padding: "15px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
          }}
        >
          <button
            onClick={() =>
              router.push(
                getRestaurantUrl()
              )
            }
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "13px",
              color: "#475467",
              padding: 0,
            }}
          >
            ← Back
          </button>

          <div
            style={{
              fontSize: "16px",
              fontWeight: "700",
            }}
          >
            {restaurant.name}
          </div>

          <button
            onClick={() =>
              router.push(
                getCartUrl()
              )
            }
            style={{
              border: "none",
              background: accent,
              color: "#fff",
              padding: "8px 13px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600",
            }}
          >
            Cart
          </button>
        </div>
      </header>

      {/* ORDER MODE */}

      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "16px 22px 0",
        }}
      >
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
              }}
            >
              {orderType === "DINE_IN"
                ? `DINE-IN${
                    tableId
                      ? ` • TABLE ${tableId}`
                      : ""
                  }`
                : "TAKEAWAY"}
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "11px",
                color: "#667085",
              }}
            >
              {orderType === "DINE_IN"
                ? tableSession
                  ? `Shared table cart • Join code: ${tableSession.group_code}`
                  : sessionLoading
                  ? "Preparing shared table cart..."
                  : "Preparing table session..."
                : "Your order will be prepared for takeaway."}
            </div>
          </div>

          {orderType === "DINE_IN" &&
            tableSession && (
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  background: "#f2f4f7",
                  padding: "7px 9px",
                  borderRadius: "7px",
                  whiteSpace: "nowrap",
                }}
              >
                {tableSession.group_code}
              </div>
            )}
        </div>
      </div>

      {/* PRODUCT */}

      <main
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "30px 22px 60px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) minmax(0, 1fr)",
            gap: "40px",
            alignItems: "start",
          }}
        >
          {/* IMAGE */}

          <div
            style={{
              background: "#fff",
              border:
                "1px solid #eaecf0",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            {(
              selectedVariant?.image_url ||
              product.image_url
            ) ? (
              <img
                src={
                  selectedVariant?.image_url ||
                  product.image_url ||
                  ""
                }
                alt={product.name}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f2f4f7",
                  fontSize: "60px",
                }}
              >
                🍽️
              </div>
            )}
          </div>

          {/* DETAILS */}

          <div>
            {/* VEG */}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                marginBottom: "10px",
              }}
            >
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  border: `1px solid ${
                    product.is_vegetarian
                      ? "#12b76a"
                      : "#f04438"
                  }`,
                  borderRadius: "3px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background:
                      product.is_vegetarian
                        ? "#12b76a"
                        : "#f04438",
                  }}
                />
              </span>

              <span
                style={{
                  fontSize: "11px",
                  color: "#667085",
                }}
              >
                {product.is_vegetarian
                  ? "Vegetarian"
                  : "Non-vegetarian"}
              </span>
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "30px",
                lineHeight: 1.2,
              }}
            >
              {product.name}
            </h1>

            {product.description && (
              <p
                style={{
                  margin: "12px 0 0",
                  color: "#667085",
                  fontSize: "13px",
                  lineHeight: 1.7,
                }}
              >
                {product.description}
              </p>
            )}

            {/* PRICE */}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                }}
              >
                ₹{currentPrice}
              </span>

              {currentMrp &&
                currentMrp >
                  currentPrice && (
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#98a2b3",
                      textDecoration:
                        "line-through",
                    }}
                  >
                    ₹{currentMrp}
                  </span>
                )}

              {selectedVariant
                ?.discount_percent &&
                selectedVariant
                  .discount_percent >
                  0 && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#027a48",
                      background:
                        "#ecfdf3",
                      padding: "4px 7px",
                      borderRadius: "5px",
                    }}
                  >
                    {
                      selectedVariant.discount_percent
                    }
                    % OFF
                  </span>
                )}
            </div>

            {/* VARIANTS */}

            {variants.length > 0 && (
              <div
                style={{
                  marginTop: "28px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "700",
                    marginBottom: "10px",
                  }}
                >
                  Choose an option
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection:
                      "column",
                    gap: "9px",
                  }}
                >
                  {variants.map(
                    (variant) => {
                      const selected =
                        selectedVariant?.id ===
                        variant.id;

                      return (
                        <button
                          key={variant.id}
                          onClick={() =>
                            setSelectedVariant(
                              variant
                            )
                          }
                          style={{
                            width: "100%",
                            textAlign:
                              "left",
                            border: selected
                              ? `2px solid ${accent}`
                              : "1px solid #d0d5dd",
                            background:
                              selected
                                ? "#f9fafb"
                                : "#fff",
                            borderRadius:
                              "10px",
                            padding:
                              "12px 14px",
                            cursor:
                              "pointer",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize:
                                  "13px",
                                fontWeight:
                                  "600",
                              }}
                            >
                              {
                                variant.name
                              }
                            </div>

                            {variant.description && (
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
                                {
                                  variant.description
                                }
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              fontSize:
                                "13px",
                              fontWeight:
                                "700",
                            }}
                          >
                            ₹
                            {
                              variant.price
                            }
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* QUANTITY */}

            <div
              style={{
                marginTop: "28px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  marginBottom: "10px",
                }}
              >
                Quantity
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <button
                  onClick={
                    decreaseQuantity
                  }
                  disabled={quantity <= 1}
                  style={{
                    width: "38px",
                    height: "38px",
                    border: "none",
                    background: "#fff",
                    cursor:
                      quantity <= 1
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "17px",
                    color:
                      quantity <= 1
                        ? "#d0d5dd"
                        : "#202228",
                  }}
                >
                  −
                </button>

                <span
                  style={{
                    width: "38px",
                    textAlign:
                      "center",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  {quantity}
                </span>

                <button
                  onClick={
                    increaseQuantity
                  }
                  disabled={quantity >= 20}
                  style={{
                    width: "38px",
                    height: "38px",
                    border: "none",
                    background: "#fff",
                    cursor:
                      quantity >= 20
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "17px",
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* ADD */}

            <button
              onClick={
                handleAddToCart
              }
              disabled={
                !canOrder ||
                addingToCart ||
                (orderType ===
                  "DINE_IN" &&
                  sessionLoading)
              }
              style={{
                width: "100%",
                border: "none",
                background:
                  !canOrder ||
                  addingToCart ||
                  (orderType ===
                    "DINE_IN" &&
                    sessionLoading)
                    ? "#98a2b3"
                    : "#202228",
                color: "#fff",
                padding: "13px",
                borderRadius: "8px",
                cursor:
                  !canOrder ||
                  addingToCart ||
                  (orderType ===
                    "DINE_IN" &&
                    sessionLoading)
                    ? "not-allowed"
                    : "pointer",
                fontSize: "12px",
                fontWeight: "600",
                marginTop: "20px",
              }}
            >
              {addingToCart
                ? "Adding..."
                : orderType ===
                  "DINE_IN"
                ? "Add to Shared Cart"
                : "Add to Cart"}
            </button>

            {orderType ===
              "DINE_IN" &&
              tableSession && (
                <div
                  style={{
                    marginTop: "10px",
                    fontSize: "11px",
                    color: "#667085",
                    textAlign:
                      "center",
                  }}
                >
                  Everyone at this table shares
                  the same cart.
                </div>
              )}
          </div>
        </div>
      </main>
    </div>
  );
}