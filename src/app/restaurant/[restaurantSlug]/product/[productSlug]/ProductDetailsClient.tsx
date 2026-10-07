"use client";

import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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

export default function ProductDetailsClient({
  restaurantSlug,
  productSlug,
}: {
  restaurantSlug: string;
  productSlug: string;
}) {
  const router = useRouter();

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

  useEffect(() => {
    loadProduct();
  }, [restaurantSlug, productSlug]);

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

  const handleAddToCart = () => {
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
      `/restaurant/${restaurantSlug}/cart`
    );
  };
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

  if (error || !product || !restaurant) {
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
  router.push(
    `/restaurant/${restaurantSlug}`
  )
}
            style={{
              marginTop: "15px",
              border: "none",
              background: "#202228",
              color: "#fff",
              padding:
                "10px 15px",
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
            padding:
              "15px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
          }}
        >
          <button
            onClick={() =>
  router.push(
    `/restaurant/${restaurantSlug}`
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
            style={{
              border: "none",
              background: accent,
              color: "#fff",
              padding:
                "8px 13px",
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

      {/* PRODUCT */}

      <main
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding:
            "30px 22px 60px",
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
                    borderRadius:
                      "50%",
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
                  margin:
                    "12px 0 0",
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
                      padding:
                        "4px 7px",
                      borderRadius:
                        "5px",
                    }}
                  >
                    {selectedVariant.discount_percent}%
                    OFF
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
                    marginBottom:
                      "10px",
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
                          key={
                            variant.id
                          }
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
                  marginBottom:
                    "10px",
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
                  disabled={
                    quantity <= 1
                  }
                  style={{
                    width: "38px",
                    height: "38px",
                    border: "none",
                    background:
                      "#fff",
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
                    textAlign: "center",
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
                  disabled={
                    quantity >= 20
                  }
                  style={{
                    width: "38px",
                    height: "38px",
                    border: "none",
                    background:
                      "#fff",
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
  onClick={handleAddToCart}
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
  Add to Cart
</button>
          </div>
        </div>
      </main>
    </div>
  );
}