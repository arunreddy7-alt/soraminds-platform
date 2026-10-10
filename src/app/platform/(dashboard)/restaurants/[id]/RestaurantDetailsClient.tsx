"use client";

import { useEffect, useState } from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
type Features = {
  delivery?: boolean;
  vip_lounge?: boolean;
  bar?: boolean;
  live_entertainment?: boolean;
};

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
  is_active: boolean;
  features: Features | null;
  created_at: string;
  updated_at: string;
};

export default function RestaurantDetailsClient() {
  const params = useParams();
  const router = useRouter();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const restaurantId = params.id as string;

  const [restaurant, setRestaurant] =
    useState<Restaurant | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] =
    useState(false);

  useEffect(() => {
    async function loadRestaurant() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/platform/restaurants/${restaurantId}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to load restaurant."
          );
        }

        setRestaurant(data);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load restaurant."
        );
      } finally {
        setLoading(false);
      }
    }

    if (restaurantId) {
      loadRestaurant();
    }
  }, [restaurantId]);

  async function toggleStatus() {
    if (!restaurant || actionLoading) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const response = await fetch(
        `/api/platform/restaurants/${restaurant.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !restaurant.is_active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update restaurant status."
        );
      }

      setRestaurant(data);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update restaurant status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeactivateInstead() {
  if (!restaurant || actionLoading) return;

  try {
    setActionLoading(true);
    setError("");

    const response = await fetch(
      `/api/platform/restaurants/${restaurant.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: false,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to deactivate restaurant."
      );
    }

    setRestaurant(data);
    setDeleteModalOpen(false);
    setDeleteConfirmStep(1);
    setDeleteConfirmName("");
  } catch (err) {
    console.error(err);

    setError(
      err instanceof Error
        ? err.message
        : "Failed to deactivate restaurant."
    );
  } finally {
    setActionLoading(false);
  }
}

  async function handleDelete() {
  if (!restaurant || actionLoading) return;

  if (deleteConfirmName.trim() !== restaurant.name) {
    setError("Enter the exact restaurant name to confirm deletion.");
    return;
  }

  try {
    setActionLoading(true);
    setError("");

    const response = await fetch(
      `/api/platform/restaurants/${restaurant.id}`,
      { method: "DELETE" }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to delete restaurant."
      );
    }

    router.replace("/platform/restaurants");
    router.refresh();
  } catch (err) {
    console.error(err);

    setError(
      err instanceof Error
        ? err.message
        : "Failed to delete restaurant."
    );
  } finally {
    setActionLoading(false);
  }
}

  if (loading) {
    return (
      <div
    style={{
        maxWidth: "1400px",
        margin: "0 auto",
        paddingTop: "30px",
        paddingRight: "30px",
        paddingBottom: "50px",
        paddingLeft: "30px",
  }}
>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            color: "#777d87",
          }}
        >
          Loading restaurant...
        </p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "30px",
        }}
      >
        <button
          onClick={() =>
            router.push("/platform/restaurants")
          }
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            color: "#555",
            fontSize: "14px",
            cursor: "pointer",
            marginBottom: "20px",
          }}
        >
          ← Back to Restaurants
        </button>

        <div
          style={{
            padding: "16px",
            background: "#fff1f1",
            border: "1px solid #f0caca",
            borderRadius: "10px",
            color: "#c62828",
            fontSize: "14px",
          }}
        >
          {error || "Restaurant not found."}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        paddingTop: "30px",
  paddingRight: "30px",
  paddingBottom: "50px",
  paddingLeft: "30px"
      }}
    >
      {/* Back */}

      <div
        style={{
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() =>
            router.push("/platform/restaurants")
          }
          style={{
            border: "none",
            background: "transparent",
            color: "#555",
            fontSize: "14px",
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← Back to Restaurants
        </button>
      </div>

      {/* Header */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "24px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "21px",
              fontWeight: "700",
              background:
                restaurant.accent_color || "#E53935",
            }}
          >
            {restaurant.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "26px",
                fontWeight: "700",
                color: "#202228",
              }}
            >
              {restaurant.name}
            </h1>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: "14px",
                color: "#777d87",
              }}
            >
              /{restaurant.slug}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() =>
              router.push(
                `/platform/restaurants/${restaurant.id}/edit`
              )
            }
            disabled={actionLoading}
            style={{
              border: "1px solid #dfe2e7",
              background: "#ffffff",
              color: "#343840",
              padding: "10px 15px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: actionLoading
                ? "not-allowed"
                : "pointer",
            }}
          >
            Edit Restaurant
          </button>

          <button
            onClick={toggleStatus}
            disabled={actionLoading}
            style={{
              border: "none",
              background: restaurant.is_active
                ? "#fef2f2"
                : "#ecfdf3",
              color: restaurant.is_active
                ? "#b42318"
                : "#027a48",
              padding: "10px 15px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: actionLoading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {actionLoading
              ? "Updating..."
              : restaurant.is_active
                ? "Deactivate"
                : "Activate"}
          </button>

          <button
           onClick={() => {
  setError("");
  setDeleteConfirmStep(1);
  setDeleteConfirmName("");
  setDeleteModalOpen(true);
}}
            disabled={actionLoading}
            style={{
              border: "none",
              background: "#b42318",
              color: "#ffffff",
              padding: "10px 15px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: actionLoading
                ? "not-allowed"
                : "pointer",
            }}
          >
            Delete Restaurant
          </button>
        </div>
      </div>

      {/* Error */}

      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "14px 16px",
            background: "#fff1f1",
            border: "1px solid #f0caca",
            borderRadius: "10px",
            color: "#c62828",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {/* Status Cards */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "16px",
          marginBottom: "22px",
        }}
      >
        <StatusCard
          label="Platform Status"
          value={
            restaurant.is_active
              ? "Active"
              : "Inactive"
          }
          dot
          dotColor={
            restaurant.is_active
              ? "#12b76a"
              : "#f04438"
          }
        />

        <StatusCard
          label="Restaurant Status"
          value={
            restaurant.is_open ? "Open" : "Closed"
          }
        />

        <StatusCard
          label="Orders"
          value={
            restaurant.accept_orders
              ? "Accepting Orders"
              : "Orders Paused"
          }
        />
      </div>

      {/* Restaurant Information */}

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e7e9ed",
          borderRadius: "14px",
          padding: "24px",
          marginBottom: "22px",
        }}
      >
        <h2
          style={{
            margin: "0 0 20px",
            fontSize: "18px",
            fontWeight: "700",
            color: "#202228",
          }}
        >
          Restaurant Information
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "20px",
          }}
        >
          <InfoItem
            label="Restaurant Name"
            value={restaurant.name}
          />

          <InfoItem
            label="Slug"
            value={restaurant.slug}
          />

          <InfoItem
            label="Cuisine"
            value={restaurant.cuisine || "—"}
          />

          <InfoItem
            label="Phone"
            value={restaurant.phone || "—"}
          />

          <InfoItem
            label="Address"
            value={restaurant.address || "—"}
          />

          <InfoItem
            label="Accent Color"
            value={restaurant.accent_color || "—"}
          />
        </div>
      </section>

      {/* Advanced Features */}

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e7e9ed",
          borderRadius: "14px",
          padding: "24px",
        }}
      >
        <h2
          style={{
            margin: "0 0 6px",
            fontSize: "18px",
            fontWeight: "700",
            color: "#202228",
          }}
        >
          Advanced Features
        </h2>

        <p
          style={{
            margin: "0 0 20px",
            fontSize: "13px",
            color: "#777d87",
          }}
        >
          Advanced platform features for this
          restaurant.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "14px",
          }}
        >
          <FeatureCard
            title="Delivery"
            enabled={restaurant.features?.delivery}
          />

          <FeatureCard
            title="VIP Lounge"
            enabled={
              restaurant.features?.vip_lounge
            }
          />

          <FeatureCard
            title="Bar"
            enabled={restaurant.features?.bar}
          />

          <FeatureCard
            title="Live Entertainment"
            enabled={
              restaurant.features?.live_entertainment
            }
          />
        </div>
      </section>
      {deleteModalOpen && restaurant && (
  <div
    onClick={(event) => {
      if (event.target === event.currentTarget && !actionLoading) {
        setDeleteModalOpen(false);
        setDeleteConfirmStep(1);
        setDeleteConfirmName("");
      }
    }}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      background: "rgba(15, 23, 42, 0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-restaurant-title"
      style={{
        width: "100%",
        maxWidth: "480px",
        background: "#ffffff",
        borderRadius: "16px",
        padding: "28px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "46px",
          height: "46px",
          borderRadius: "12px",
          background: "#fef2f2",
          color: "#b42318",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "23px",
          marginBottom: "18px",
        }}
      >
        !
      </div>

      <h2
        id="delete-restaurant-title"
        style={{
          margin: "0 0 10px",
          fontSize: "22px",
          fontWeight: 700,
          color: "#111827",
        }}
      >
        {deleteConfirmStep === 1
          ? "Delete this restaurant?"
          : "Confirm permanent deletion"}
      </h2>

      {deleteConfirmStep === 1 ? (
        <>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: "14px",
              lineHeight: 1.7,
              color: "#6b7280",
            }}
          >
            Choose what you want to do with{" "}
            <strong style={{ color: "#111827" }}>
              {restaurant.name}
            </strong>
            .
          </p>

          <div
            style={{
              border: "1px solid #fecaca",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "14px",
            }}
          >
            <h3
              style={{
                margin: "0 0 6px",
                fontSize: "15px",
                color: "#b42318",
              }}
            >
              Permanently delete
            </h3>

            <p
              style={{
                margin: "0 0 14px",
                fontSize: "13px",
                lineHeight: 1.6,
                color: "#6b7280",
              }}
            >
              Permanently removes the restaurant, its order
              history, and associated database records.
              This cannot be undone.
            </p>

            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                setError("");
                setDeleteConfirmStep(2);
              }}
              style={{
                width: "100%",
                border: "none",
                borderRadius: "8px",
                padding: "11px",
                background: "#b42318",
                color: "#ffffff",
                fontWeight: 600,
                cursor: actionLoading ? "not-allowed" : "pointer",
              }}
            >
              Continue to permanent deletion
            </button>
          </div>

          <div
            style={{
              border: "1px solid #d1fae5",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <h3
              style={{
                margin: "0 0 6px",
                fontSize: "15px",
                color: "#027a48",
              }}
            >
              Deactivate instead
            </h3>

            <p
              style={{
                margin: "0 0 14px",
                fontSize: "13px",
                lineHeight: 1.6,
                color: "#6b7280",
              }}
            >
              Preserve order history and restaurant records
              while marking this restaurant inactive.
            </p>

            <button
              type="button"
              disabled={actionLoading}
              onClick={handleDeactivateInstead}
              style={{
                width: "100%",
                border: "1px solid #a7f3d0",
                borderRadius: "8px",
                padding: "11px",
                background: "#ecfdf5",
                color: "#027a48",
                fontWeight: 600,
                cursor: actionLoading ? "not-allowed" : "pointer",
              }}
            >
              {actionLoading ? "Processing..." : "Deactivate restaurant"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "14px",
              lineHeight: 1.7,
              color: "#6b7280",
            }}
          >
            This will permanently remove{" "}
            <strong style={{ color: "#111827" }}>
              {restaurant.name}
            </strong>
            , including its orders and associated records.
            Type the restaurant's exact name below to confirm.
          </p>

          <label
            htmlFor="delete-restaurant-name"
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "7px",
            }}
          >
            Restaurant name
          </label>

          <input
            id="delete-restaurant-name"
            autoComplete="off"
            value={deleteConfirmName}
            onChange={(event) =>
              setDeleteConfirmName(event.target.value)
            }
            placeholder={restaurant.name}
            disabled={actionLoading}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "18px",
              fontSize: "14px",
              color: "#111827",
            }}
          />

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                setDeleteConfirmStep(1);
                setDeleteConfirmName("");
                setError("");
              }}
              style={{
                flex: 1,
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "11px",
                background: "#ffffff",
                color: "#374151",
                fontWeight: 600,
                cursor: actionLoading ? "not-allowed" : "pointer",
              }}
            >
              Back
            </button>

            <button
              type="button"
              disabled={
                actionLoading ||
                deleteConfirmName.trim() !== restaurant.name
              }
              onClick={handleDelete}
              style={{
                flex: 1,
                border: "none",
                borderRadius: "8px",
                padding: "11px",
                background:
                  actionLoading ||
                  deleteConfirmName.trim() !== restaurant.name
                    ? "#fca5a5"
                    : "#b42318",
                color: "#ffffff",
                fontWeight: 600,
                cursor:
                  actionLoading ||
                  deleteConfirmName.trim() !== restaurant.name
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {actionLoading ? "Deleting..." : "Delete permanently"}
            </button>
          </div>
        </>
      )}

      <button
        type="button"
        disabled={actionLoading}
        onClick={() => {
          setDeleteModalOpen(false);
          setDeleteConfirmStep(1);
          setDeleteConfirmName("");
          setError("");
        }}
        style={{
          width: "100%",
          marginTop: "12px",
          padding: "10px",
          border: "none",
          background: "transparent",
          color: "#6b7280",
          fontSize: "13px",
          cursor: actionLoading ? "not-allowed" : "pointer",
        }}
      >
        Cancel
      </button>
    </div>
  </div>
)}
    </div>
  );
}

function StatusCard({
  label,
  value,
  dot,
  dotColor,
}: {
  label: string;
  value: string;
  dot?: boolean;
  dotColor?: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e7e9ed",
        borderRadius: "14px",
        padding: "20px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#777d87",
          marginBottom: "10px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "16px",
          fontWeight: "600",
          color: "#202228",
        }}
      >
        {dot && (
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: dotColor || "#12b76a",
              display: "inline-block",
            }}
          />
        )}

        {value}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: "600",
          color: "#8a9099",
          marginBottom: "6px",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#30343b",
          lineHeight: "1.5",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  enabled,
}: {
  title: string;
  enabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        padding: "16px",
        border: "1px solid #e7e9ed",
        borderRadius: "10px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#30343b",
            marginBottom: "4px",
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#777d87",
          }}
        >
          {enabled ? "Enabled" : "Disabled"}
        </div>
      </div>

      <div
        style={{
          padding: "5px 9px",
          borderRadius: "6px",
          background: enabled
            ? "#ecfdf3"
            : "#f3f4f6",
          color: enabled
            ? "#027a48"
            : "#6b7280",
          fontSize: "11px",
          fontWeight: "700",
        }}
      >
        {enabled ? "ON" : "OFF"}
      </div>
      
    </div>
  );
}