"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  slug: string;
  phone: string | null;
  cuisine: string | null;
  accent_color: string | null;
  accept_orders: boolean;
  is_active: boolean;
  features: {
    delivery: boolean;
    vip_lounge: boolean;
    bar: boolean;
    live_entertainment: boolean;
  } | null;
};

export default function Restaurants() {
  const router = useRouter();
  const supabase = createClient();

  const [restaurants, setRestaurants] = useState<
    Restaurant[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      setError("");

      const { data, error: restaurantsError } =
        await supabase
          .from("restaurants")
          .select(
            `
              id,
    name,
    slug,
    phone,
    cuisine,
    accent_color,
    accept_orders,
    is_active,
    features,
    created_at,
    updated_at
            `
          )
          .order("created_at", {
            ascending: false,
          });

      if (restaurantsError) {
        console.error(
          "Failed to load restaurants:",
          restaurantsError
        );

        setError(
          restaurantsError.message ||
            "Failed to load restaurants."
        );

        return;
      }

      setRestaurants(data || []);
    } catch (err) {
      console.error(err);

      setError(
        "Failed to load restaurants."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRestaurants();
  }, []);

  const filteredRestaurants =
    restaurants.filter((restaurant) => {
      const query = search
        .toLowerCase()
        .trim();

      if (!query) {
        return true;
      }

      return (
        restaurant.name
          .toLowerCase()
          .includes(query) ||
        restaurant.slug
          .toLowerCase()
          .includes(query) ||
        (restaurant.cuisine || "")
          .toLowerCase()
          .includes(query)
      );
    });

  return (
    <div
      style={{
        padding: "30px",
        maxWidth: "1400px",
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "28px",
          gap: "20px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 700,
              color: "#111827",
            }}
          >
            Restaurants
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Manage all restaurants on the
            Soraminds Platform.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/platform/restaurants/create"
            )
          }
          style={{
            border: "none",
            background: "#111827",
            color: "#ffffff",
            padding: "11px 18px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Create Restaurant
        </button>
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
          gap: "20px",
        }}
      >
        <input
          type="text"
          placeholder="Search restaurants..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          style={{
            width: "320px",
            maxWidth: "100%",
            padding: "11px 14px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            outline: "none",
            fontSize: "14px",
            background: "#ffffff",
            color: "#111827",
            boxSizing: "border-box",
          }}
        />

        <div
          style={{
            color: "#6b7280",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          {filteredRestaurants.length} restaurant
          {filteredRestaurants.length !== 1
            ? "s"
            : ""}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 14px",
            marginBottom: "18px",
            background: "#fef2f2",
            color: "#b42318",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "60px 20px",
            textAlign: "center",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          Loading restaurants...
        </div>
      ) : filteredRestaurants.length === 0 ? (
        /* Empty */
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "60px 20px",
            textAlign: "center",
          }}
        >
          <h3
            style={{
              margin: "0 0 8px",
              fontSize: "18px",
              fontWeight: 600,
              color: "#111827",
            }}
          >
            No restaurants found
          </h3>

          <p
            style={{
              margin: 0,
              color: "#777777",
              fontSize: "14px",
            }}
          >
            {search
              ? "Try a different search."
              : "Create your first restaurant to get started."}
          </p>
        </div>
      ) : (
        /* Table */
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "850px",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "14px 18px",
                      background: "#f9fafb",
                      color: "#6b7280",
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    Restaurant
                  </th>

                  <th
                    style={{
                      textAlign: "left",
                      padding: "14px 18px",
                      background: "#f9fafb",
                      color: "#6b7280",
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    Cuisine
                  </th>

                  <th
                    style={{
                      textAlign: "left",
                      padding: "14px 18px",
                      background: "#f9fafb",
                      color: "#6b7280",
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    Phone
                  </th>

                  <th
                    style={{
                      textAlign: "left",
                      padding: "14px 18px",
                      background: "#f9fafb",
                      color: "#6b7280",
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    Orders
                  </th>

                  <th
                    style={{
                      textAlign: "left",
                      padding: "14px 18px",
                      background: "#f9fafb",
                      color: "#6b7280",
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    Status
                  </th>

                  <th
                    style={{
                      textAlign: "left",
                      padding: "14px 18px",
                      background: "#f9fafb",
                      color: "#6b7280",
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRestaurants.map(
                  (restaurant) => (
                    <tr key={restaurant.id}>
                      {/* Restaurant */}
                      <td
                        style={{
                          padding: "16px 18px",
                          borderBottom:
                            "1px solid #f1f1f1",
                          fontSize: "14px",
                          color: "#374151",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          <div
                            style={{
                              width: "38px",
                              height: "38px",
                              borderRadius: "9px",
                              display: "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              color: "#ffffff",
                              fontWeight: 700,
                              background:
                                restaurant.accent_color ||
                                "#E53935",
                              flexShrink: 0,
                            }}
                          >
                            {restaurant.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: "#111827",
                              }}
                            >
                              {restaurant.name}
                            </div>

                            <div
                              style={{
                                marginTop: "3px",
                                fontSize: "12px",
                                color: "#6b7280",
                                fontFamily:
                                  "monospace",
                              }}
                            >
                              /{restaurant.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cuisine */}
                      <td
                        style={{
                          padding: "16px 18px",
                          borderBottom:
                            "1px solid #f1f1f1",
                          fontSize: "14px",
                          color: "#374151",
                        }}
                      >
                        {restaurant.cuisine ||
                          "—"}
                      </td>

                      {/* Phone */}
                      <td
                        style={{
                          padding: "16px 18px",
                          borderBottom:
                            "1px solid #f1f1f1",
                          fontSize: "14px",
                          color: "#374151",
                        }}
                      >
                        {restaurant.phone ||
                          "—"}
                      </td>

                      {/* Orders */}
                      <td
                        style={{
                          padding: "16px 18px",
                          borderBottom:
                            "1px solid #f1f1f1",
                          fontSize: "14px",
                          color: "#374151",
                        }}
                      >
                        <span
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            padding:
                              "5px 10px",
                            borderRadius:
                              "20px",
                            background:
                              restaurant.accept_orders
                                ? "#ecfdf3"
                                : "#fef2f2",
                            color:
                              restaurant.accept_orders
                                ? "#027a48"
                                : "#b42318",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          {restaurant.accept_orders
                            ? "Accepting"
                            : "Paused"}
                        </span>
                      </td>

                      {/* Status */}
                      <td
                        style={{
                          padding: "16px 18px",
                          borderBottom:
                            "1px solid #f1f1f1",
                          fontSize: "14px",
                          color: "#374151",
                        }}
                      >
                        <span
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            gap: "6px",
                            padding:
                              "5px 10px",
                            borderRadius:
                              "20px",
                            background:
                              restaurant.is_active
                                ? "#ecfdf3"
                                : "#fef2f2",
                            color:
                              restaurant.is_active
                                ? "#027a48"
                                : "#b42318",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius:
                                "50%",
                              background:
                                restaurant.is_active
                                  ? "#12b76a"
                                  : "#f04438",
                            }}
                          />

                          {restaurant.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        style={{
                          padding: "16px 18px",
                          borderBottom:
                            "1px solid #f1f1f1",
                          fontSize: "14px",
                          color: "#374151",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/platform/restaurants/${restaurant.id}`
                            )
                          }
                          style={{
                            border:
                              "1px solid #d1d5db",
                            background:
                              "#ffffff",
                            color: "#111827",
                            padding:
                              "7px 13px",
                            borderRadius:
                              "7px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor:
                              "pointer",
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}