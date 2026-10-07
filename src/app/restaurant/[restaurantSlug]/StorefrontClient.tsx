"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCartCount,
} from "@/lib/customer/cart";

type Restaurant = {
  id: number;
  name: string;
  slug: string;
  phone: string | null;
  cuisine: string | null;
  address: string | null;
  accent_color: string | null;
  is_open: boolean;
  accept_orders: boolean;
  features: {
    delivery: boolean;
    vip_lounge: boolean;
    bar: boolean;
    live_entertainment: boolean;
  } | null;
};

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

type Product = {
  id: number;
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

type Combo = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  combo_price: number;
  original_price: number;
  is_active: boolean;
};

type Banner = {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export default function StorefrontClient() {
  const params = useParams();
  const router = useRouter();

  const restaurantSlug =
    typeof params.restaurantSlug === "string"
      ? params.restaurantSlug
      : "";

  const [restaurant, setRestaurant] =
    useState<Restaurant | null>(null);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [combos, setCombos] =
    useState<Combo[]>([]);

  const [banners, setBanners] =
    useState<Banner[]>([]);

  const [selectedCategory, setSelectedCategory] =
    useState<number | null>(null);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStorefront();
  }, [restaurantSlug]);

  const loadStorefront = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/customer/storefront/${restaurantSlug}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load restaurant."
        );
      }

      setRestaurant(data.restaurant);
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setCombos(data.combos || []);
      setBanners(data.banners || []);

      
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load restaurant."
      );
    } finally {
      setLoading(false);
    }
  };


  const [cartCount, setCartCount] =
  useState(0);

  useEffect(() => {
  const updateCartCount = () => {
    setCartCount(
      getCartCount(restaurantSlug)
    );
  };

  updateCartCount();

  window.addEventListener(
    "soraminds-cart-updated",
    updateCartCount
  );

  return () => {
    window.removeEventListener(
      "soraminds-cart-updated",
      updateCartCount
    );
  };
}, [restaurantSlug]);

  const filteredProducts = products.filter(
    (product) => {
      const matchesCategory =
        selectedCategory === null ||
        product.category_id ===
          selectedCategory;

      const searchValue = search
        .trim()
        .toLowerCase();

      const matchesSearch =
        !searchValue ||
        product.name
          .toLowerCase()
          .includes(searchValue) ||
        product.description
          ?.toLowerCase()
          .includes(searchValue);

      return (
        matchesCategory &&
        matchesSearch
      );
    }
  );

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          color: "#667085",
        }}
      >
        Loading restaurant...
      </div>
    );
  }

  if (error || !restaurant) {
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
              color: "#202228",
            }}
          >
            Restaurant not found
          </h2>

          <p
            style={{
              marginTop: "7px",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            {error ||
              "This restaurant is unavailable."}
          </p>
        </div>
      </div>
    );
  }

  const accent =
    restaurant.accent_color || "#202228";

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
          background: "#fff",
          borderBottom:
            "1px solid #eaecf0",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "16px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "19px",
                fontWeight: "700",
              }}
            >
              {restaurant.name}
            </div>

            {restaurant.cuisine && (
              <div
                style={{
                  marginTop: "3px",
                  fontSize: "11px",
                  color: "#858a94",
                }}
              >
                {restaurant.cuisine}
              </div>
            )}
          </div>

          <button
  onClick={() =>
    (window.location.href =
      `/restaurant/${restaurantSlug}/cart`)
  }
  style={{
    border: "none",
    background: accent,
    color: "#fff",
    padding: "9px 14px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  }}
>
  Cart
{cartCount > 0
  ? ` (${cartCount})`
  : ""}
</button>
        </div>
      </header>

      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "24px 22px 50px",
        }}
      >
        {/* STATUS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "18px",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background:
                restaurant.is_open &&
                restaurant.accept_orders
                  ? "#12b76a"
                  : "#f04438",
            }}
          />

          <span
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color:
                restaurant.is_open &&
                restaurant.accept_orders
                  ? "#027a48"
                  : "#b42318",
            }}
          >
            {restaurant.is_open &&
            restaurant.accept_orders
              ? "Open • Accepting orders"
              : "Currently unavailable"}
          </span>
        </div>

        {/* BANNERS */}
        {banners.length > 0 && (
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "14px",
              marginBottom: "28px",
            }}
          >
            {banners.map((banner) => (
              <div
                key={banner.id}
                style={{
                  minHeight: "180px",
                  borderRadius: "14px",
                  overflow: "hidden",
                  position: "relative",
                  background:
                    accent,
                  color: "#fff",
                }}
              >
                {banner.image_url && (
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, rgba(0,0,0,.65), rgba(0,0,0,.1))",
                  }}
                />

                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    padding: "25px",
                    maxWidth: "500px",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "22px",
                    }}
                  >
                    {banner.title}
                  </h2>

                  {banner.description && (
                    <p
                      style={{
                        margin:
                          "8px 0 0",
                        fontSize: "12px",
                        lineHeight: 1.5,
                      }}
                    >
                      {banner.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* SEARCH */}
        <div
          style={{
            marginBottom: "20px",
          }}
        >
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search dishes..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 15px",
              border:
                "1px solid #d0d5dd",
              borderRadius: "9px",
              background: "#fff",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

       {/* CATEGORIES */}
<div
  style={{
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: "8px",
    marginBottom: "25px",
    scrollbarWidth: "thin",
  }}
>
  {/* ALL */}
  <button
    onClick={() => setSelectedCategory(null)}
    style={{
      flexShrink: 0,
      border:
        selectedCategory === null
          ? "none"
          : "1px solid #eaecf0",
      background:
        selectedCategory === null
          ? accent
          : "#fff",
      color:
        selectedCategory === null
          ? "#fff"
          : "#475467",
      padding: "9px 16px",
      borderRadius: "999px",
      whiteSpace: "nowrap",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: "600",
    }}
  >
    All
  </button>

  {/* CATEGORIES */}
  {categories.map((category) => (
    <button
      key={category.id}
      onClick={() =>
        setSelectedCategory(category.id)
      }
      style={{
        flexShrink: 0,
        border:
          selectedCategory === category.id
            ? "none"
            : "1px solid #eaecf0",
        background:
          selectedCategory === category.id
            ? accent
            : "#fff",
        color:
          selectedCategory === category.id
            ? "#fff"
            : "#475467",
        padding: "9px 14px",
        borderRadius: "999px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: "600",
      }}
    >
      {category.name}
    </button>
  ))}
</div>
        {/* COMBOS */}
        {combos.length > 0 && (
          <section
            style={{
              marginBottom: "35px",
            }}
          >
            <h2
              style={{
                margin: "0 0 14px",
                fontSize: "18px",
              }}
            >
              Combos
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(230px, 1fr))",
                gap: "14px",
              }}
            >
              {combos.map((combo) => (
                <div
                  key={combo.id}
                  style={{
                    background: "#fff",
                    border:
                      "1px solid #eaecf0",
                    borderRadius: "12px",
                    overflow: "hidden",
                  }}
                >
                  {combo.image_url && (
                    <img
                      src={combo.image_url}
                      alt={combo.name}
                      style={{
                        width: "100%",
                        height: "160px",
                        objectFit: "cover",
                      }}
                    />
                  )}

                  <div
                    style={{
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                      }}
                    >
                      {combo.name}
                    </div>

                    {combo.description && (
                      <div
                        style={{
                          marginTop: "5px",
                          fontSize: "11px",
                          color: "#858a94",
                        }}
                      >
                        {combo.description}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent:
                          "space-between",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "700",
                          fontSize: "15px",
                        }}
                      >
                        ₹
                        {combo.combo_price}
                      </div>

                      {combo.original_price >
                        combo.combo_price && (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#98a2b3",
                            textDecoration:
                              "line-through",
                          }}
                        >
                          ₹
                          {
                            combo.original_price
                          }
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PRODUCTS */}
        <section>
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: "18px",
            }}
          >
            Menu
          </h2>

          {filteredProducts.length === 0 ? (
            <div
              style={{
                background: "#fff",
                border:
                  "1px solid #eaecf0",
                borderRadius: "12px",
                padding: "45px",
                textAlign: "center",
                color: "#858a94",
                fontSize: "12px",
              }}
            >
              No dishes found.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(250px, 1fr))",
                gap: "14px",
              }}
            >
              {filteredProducts.map(
                (product) => (
                  <div
                    key={product.id}
                    onClick={() =>
  router.push(
    `/restaurant/${restaurantSlug}/product/${product.slug}`
  )
}   
                    style={{
                      background: "#fff",
                      border:
                        "1px solid #eaecf0",
                      borderRadius: "12px",
                      overflow: "hidden",
                      opacity:
                        product.is_available
                          ? 1
                          : 0.55,
                    }}
                  >
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        style={{
                          width: "100%",
                          height: "180px",
                          objectFit: "cover",
                        }}
                      />
                    )}

                    <div
                      style={{
                        padding: "15px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          gap: "7px",
                        }}
                      >
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            border:
                              "1px solid #12b76a",
                            display: "inline-block",
                            borderRadius:
                              "2px",
                          }}
                        />

                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: "600",
                          }}
                        >
                          {product.name}
                        </span>
                      </div>

                      {product.description && (
                        <p
                          style={{
                            margin:
                              "7px 0 0",
                            color: "#858a94",
                            fontSize: "11px",
                            lineHeight: 1.5,
                          }}
                        >
                          {
                            product.description
                          }
                        </p>
                      )}

                      <div
                        style={{
                          marginTop: "12px",
                          display: "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: "700",
                          }}
                        >
                          ₹{product.price}
                        </div>

                        <button
 onClick={(event) => {
  event.stopPropagation();

  router.push(
    `/restaurant/${restaurantSlug}/product/${product.slug}`
  );
}}
  disabled={
    !product.is_available ||
    !restaurant.accept_orders
  }
  style={{
    border: "none",
    background:
      !product.is_available ||
      !restaurant.accept_orders
        ? "#d0d5dd"
        : accent,
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "7px",
    cursor:
      !product.is_available ||
      !restaurant.accept_orders
        ? "not-allowed"
        : "pointer",
    fontSize: "11px",
    fontWeight: "600",
  }}
>
  {product.is_available ? "View" : "Unavailable"}
</button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}