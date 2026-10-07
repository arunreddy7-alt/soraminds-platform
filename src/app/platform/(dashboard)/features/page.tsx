"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  features: {
    delivery: boolean;
    vip_lounge: boolean;
    bar: boolean;
    live_entertainment: boolean;
  } | null;
};

type FeatureConfig = {
  delivery: boolean;
  vip_lounge: boolean;
  bar: boolean;
  live_entertainment: boolean;
};

type FeatureKey =
  | "delivery"
  | "vip_lounge"
  | "bar"
  | "live_entertainment";

const featureData: {
  key: FeatureKey;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    key: "delivery",
    title: "Delivery",
    description:
      "Enable delivery ordering and delivery-related functionality for this restaurant.",
    icon: "🚚",
  },
  {
    key: "vip_lounge",
    title: "VIP Lounge",
    description:
      "Enable VIP lounge management and related restaurant functionality.",
    icon: "⭐",
  },
  {
    key: "bar",
    title: "Bar",
    description:
      "Enable bar-related menu and management functionality.",
    icon: "🍸",
  },
  {
    key: "live_entertainment",
    title: "Live Entertainment",
    description:
      "Enable live entertainment management for this restaurant.",
    icon: "🎵",
  },
];

export default function FeaturesPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] =
    useState<string>("");

  const [features, setFeatures] = useState<FeatureConfig>({
  delivery: false,
  vip_lounge: false,
  bar: false,
  live_entertainment: false,
});
const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadRestaurants();
  }, []);

  useEffect(() => {
    if (!selectedRestaurantId) return;

    const restaurant = restaurants.find(
      (item) => item.id === Number(selectedRestaurantId)
    );

    if (restaurant) {
      setFeatures({
        delivery: restaurant.features?.delivery ?? false,
        vip_lounge: restaurant.features?.vip_lounge ?? false,
        bar: restaurant.features?.bar ?? false,
        live_entertainment:
          restaurant.features?.live_entertainment ?? false,
      });
    }
  }, [selectedRestaurantId, restaurants]);

  async function loadRestaurants() {
  try {
    setLoading(true);
    setError("");

    const { data, error: restaurantsError } = await supabase
      .from("restaurants")
      .select(`
        id,
        name,
        slug,
        is_active,
        features
      `)
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

    const restaurantList: Restaurant[] = data || [];

    setRestaurants(restaurantList);

    if (restaurantList.length > 0) {
      setSelectedRestaurantId(
        String(restaurantList[0].id)
      );
    }
  } catch (err) {
    console.error(err);

    setError("Failed to load restaurants.");
  } finally {
    setLoading(false);
  }
}

  function toggleFeature(key: FeatureKey) {
  setFeatures((current) => ({
    ...current,
    [key]: !current[key],
  }));
}

  async function saveFeatures() {
    if (!selectedRestaurantId) return;

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await fetch(
        `/api/platform/restaurants/${selectedRestaurantId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            features,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to update restaurant features"
        );
      }

      setRestaurants((current) =>
        current.map((restaurant) =>
          restaurant.id === Number(selectedRestaurantId)
            ? {
                ...restaurant,
                features,
              }
            : restaurant
        )
      );

      setMessage("Features updated successfully.");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update features."
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedRestaurant = restaurants.find(
    (restaurant) => restaurant.id === Number(selectedRestaurantId)
  );

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        paddingTop: "30px",
        paddingRight: "30px",
        paddingBottom: "50px",
        paddingLeft: "30px",
      }}
    >
      <div
        style={{
          marginBottom: "30px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 700,
            color: "#17191d",
          }}
        >
          Features
        </h1>

        <p
          style={{
            marginTop: "8px",
            marginBottom: 0,
            fontSize: "14px",
            color: "#777d87",
          }}
        >
          Control which advanced features are available for each
          restaurant.
        </p>
      </div>

      {loading ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "14px",
            paddingTop: "30px",
            paddingRight: "30px",
            paddingBottom: "30px",
            paddingLeft: "30px",
            color: "#777d87",
            fontSize: "14px",
          }}
        >
          Loading restaurants...
        </div>
      ) : error ? (
        <div
          style={{
            background: "#fff1f1",
            border: "1px solid #f1caca",
            borderRadius: "12px",
            paddingTop: "14px",
            paddingRight: "16px",
            paddingBottom: "14px",
            paddingLeft: "16px",
            color: "#c62828",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      ) : restaurants.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "14px",
            paddingTop: "40px",
            paddingRight: "30px",
            paddingBottom: "40px",
            paddingLeft: "30px",
            textAlign: "center",
            color: "#777d87",
          }}
        >
          No restaurants found.
        </div>
      ) : (
        <>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e7e9ed",
              borderRadius: "14px",
              paddingTop: "24px",
              paddingRight: "24px",
              paddingBottom: "24px",
              paddingLeft: "24px",
              marginBottom: "20px",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "9px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#343840",
              }}
            >
              Select Restaurant
            </label>

            <select
              value={selectedRestaurantId}
              onChange={(event) => {
                setSelectedRestaurantId(event.target.value);
                setMessage("");
                setError("");
              }}
              style={{
                width: "100%",
                maxWidth: "500px",
                height: "46px",
                paddingTop: "0",
                paddingRight: "14px",
                paddingBottom: "0",
                paddingLeft: "14px",
                border: "1px solid #dfe2e7",
                borderRadius: "9px",
                background: "#ffffff",
                color: "#17191d",
                fontSize: "14px",
                outline: "none",
              }}
            >
              {restaurants.map((restaurant) => (
                <option
                  key={restaurant.id}
                  value={restaurant.id}
                >
                  {restaurant.name}
                </option>
              ))}
            </select>

            {selectedRestaurant && (
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "13px",
                  color: "#8a9099",
                }}
              >
                {selectedRestaurant.slug}
              </div>
            )}
          </div>

          {message && (
            <div
              style={{
                marginBottom: "20px",
                background: "#edf8f0",
                border: "1px solid #c9e8d0",
                borderRadius: "10px",
                paddingTop: "12px",
                paddingRight: "15px",
                paddingBottom: "12px",
                paddingLeft: "15px",
                color: "#237a3b",
                fontSize: "14px",
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: "20px",
                background: "#fff1f1",
                border: "1px solid #f1caca",
                borderRadius: "10px",
                paddingTop: "12px",
                paddingRight: "15px",
                paddingBottom: "12px",
                paddingLeft: "15px",
                color: "#c62828",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "18px",
            }}
          >
            {featureData.map((feature) => {
              const enabled = features?.[feature.key] ?? false;

              return (
                <div
                  key={feature.key}
                  style={{
                    background: "#ffffff",
                    border: enabled
                      ? "1px solid #cfd2d7"
                      : "1px solid #e7e9ed",
                    borderRadius: "14px",
                    paddingTop: "22px",
                    paddingRight: "22px",
                    paddingBottom: "22px",
                    paddingLeft: "22px",
                    transition: "border-color 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "46px",
                          height: "46px",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "11px",
                          background: "#f5f6f8",
                          fontSize: "21px",
                        }}
                      >
                        {feature.icon}
                      </div>

                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "16px",
                            fontWeight: 650,
                            color: "#17191d",
                          }}
                        >
                          {feature.title}
                        </h3>

                        <p
                          style={{
                            marginTop: "7px",
                            marginBottom: 0,
                            fontSize: "13px",
                            lineHeight: 1.5,
                            color: "#777d87",
                          }}
                        >
                          {feature.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFeature(feature.key)}
                      aria-label={`Toggle ${feature.title}`}
                      style={{
                        width: "48px",
                        height: "27px",
                        flexShrink: 0,
                        border: "none",
                        borderRadius: "20px",
                        background: enabled
                          ? "#17191d"
                          : "#d9dce1",
                        paddingTop: "3px",
                        paddingRight: "3px",
                        paddingBottom: "3px",
                        paddingLeft: "3px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: enabled
                          ? "flex-end"
                          : "flex-start",
                        transition:
                          "background 0.2s ease, justify-content 0.2s ease",
                      }}
                    >
                      <span
                        style={{
                          width: "21px",
                          height: "21px",
                          borderRadius: "50%",
                          background: "#ffffff",
                          display: "block",
                        }}
                      />
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: "18px",
                      paddingTop: "9px",
                      paddingRight: "10px",
                      paddingBottom: "9px",
                      paddingLeft: "10px",
                      borderRadius: "8px",
                      background: enabled
                        ? "#f3f3f3"
                        : "#f8f8f9",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: enabled ? "#17191d" : "#8a9099",
                    }}
                  >
                    {enabled ? "Enabled" : "Disabled"}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "24px",
            }}
          >
            <button
              type="button"
              onClick={saveFeatures}
              disabled={saving}
              style={{
                minWidth: "150px",
                height: "44px",
                border: "none",
                borderRadius: "9px",
                background: saving ? "#55585e" : "#17191d",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.75 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}