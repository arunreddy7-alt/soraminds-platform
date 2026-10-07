"use client";

import { useEffect, useState } from "react";

type Features = {
  delivery: boolean;
  vip_lounge: boolean;
  bar: boolean;
  live_entertainment: boolean;
};

type RestaurantSettings = {
  id: number;
  name: string;
  slug: string;
  phone: string | null;
  cuisine: string | null;
  address: string | null;
  accent_color: string | null;
  is_open: boolean;
  accept_orders: boolean;
  features: Features | null;
  is_active: boolean;
};

const DEFAULT_FEATURES: Features = {
  delivery: false,
  vip_lounge: false,
  bar: false,
  live_entertainment: false,
};

export default function SettingsClient() {
  const [settings, setSettings] =
    useState<RestaurantSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/restaurant/settings",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load restaurant settings."
        );
      }

      setSettings({
        ...data.restaurant,
        features: {
          ...DEFAULT_FEATURES,
          ...(data.restaurant.features || {}),
        },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load restaurant settings."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateField = (
    field: keyof RestaurantSettings,
    value: string | boolean
  ) => {
    setSettings((previous) =>
      previous
        ? {
            ...previous,
            [field]: value,
          }
        : previous
    );
  };

  const updateFeature = (
    feature: keyof Features,
    value: boolean
  ) => {
    setSettings((previous) =>
      previous
        ? {
            ...previous,
            features: {
              ...(previous.features ||
                DEFAULT_FEATURES),
              [feature]: value,
            },
          }
        : previous
    );
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        "/api/restaurant/settings",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: settings.name,
            slug: settings.slug,
            phone: settings.phone,
            cuisine: settings.cuisine,
            address: settings.address,
            accent_color: settings.accent_color,
            is_open: settings.is_open,
            accept_orders: settings.accept_orders,
            features:
              settings.features ||
              DEFAULT_FEATURES,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save restaurant settings."
        );
      }

      setSettings({
        ...data.restaurant,
        features: {
          ...DEFAULT_FEATURES,
          ...(data.restaurant.features || {}),
        },
      });

      setSuccess(
        "Restaurant settings saved successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save restaurant settings."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          color: "#858a94",
          fontSize: "13px",
        }}
      >
        Loading settings...
      </div>
    );
  }

  if (!settings) {
    return (
      <div
        style={{
          padding: "40px",
          color: "#b42318",
          fontSize: "13px",
        }}
      >
        Unable to load restaurant settings.
      </div>
    );
  }

  const features =
    settings.features || DEFAULT_FEATURES;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "900px",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: "700",
              color: "#202228",
            }}
          >
            Settings
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            Manage your restaurant information
            and operations.
          </p>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          style={{
            border: "none",
            background: saving
              ? "#98a2b3"
              : "#202228",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "8px",
            cursor: saving
              ? "not-allowed"
              : "pointer",
            fontSize: "12px",
            fontWeight: "600",
          }}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "#fff5f5",
            border: "1px solid #fecdca",
            color: "#b42318",
            borderRadius: "8px",
            padding: "12px 14px",
            marginBottom: "15px",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: "#ecfdf3",
            border: "1px solid #abefc6",
            color: "#027a48",
            borderRadius: "8px",
            padding: "12px 14px",
            marginBottom: "15px",
            fontSize: "12px",
          }}
        >
          {success}
        </div>
      )}

      {/* RESTAURANT INFORMATION */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #eaecf0",
          borderRadius: "12px",
          marginBottom: "18px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #eaecf0",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "#202228",
            }}
          >
            Restaurant information
          </div>

          <div
            style={{
              marginTop: "5px",
              color: "#858a94",
              fontSize: "12px",
            }}
          >
            Basic information displayed across
            your restaurant platform.
          </div>
        </div>

        <div
          style={{
            padding: "20px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "18px",
          }}
        >
          <Field
            label="Restaurant name"
            value={settings.name}
            onChange={(value) =>
              updateField("name", value)
            }
            required
          />

          <Field
            label="Slug"
            value={settings.slug}
            onChange={(value) =>
              updateField("slug", value)
            }
            required
          />

          <Field
            label="Phone"
            value={settings.phone || ""}
            onChange={(value) =>
              updateField("phone", value)
            }
          />

          <Field
            label="Cuisine"
            value={settings.cuisine || ""}
            onChange={(value) =>
              updateField("cuisine", value)
            }
          />

          <div
            style={{
              gridColumn: "1 / -1",
            }}
          >
            <Field
              label="Address"
              value={settings.address || ""}
              onChange={(value) =>
                updateField("address", value)
              }
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontSize: "11px",
                fontWeight: "600",
                color: "#344054",
              }}
            >
              Accent color
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <input
                type="color"
                value={
                  settings.accent_color ||
                  "#202228"
                }
                onChange={(event) =>
                  updateField(
                    "accent_color",
                    event.target.value
                  )
                }
                style={{
                  width: "42px",
                  height: "38px",
                  padding: "2px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius: "7px",
                  cursor: "pointer",
                  background: "#fff",
                }}
              />

              <input
                value={
                  settings.accent_color ||
                  "#202228"
                }
                onChange={(event) =>
                  updateField(
                    "accent_color",
                    event.target.value
                  )
                }
                style={{
                  flex: 1,
                  boxSizing: "border-box",
                  padding: "10px 11px",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius: "7px",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* OPERATIONS */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #eaecf0",
          borderRadius: "12px",
          marginBottom: "18px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #eaecf0",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "#202228",
            }}
          >
            Restaurant operations
          </div>

          <div
            style={{
              marginTop: "5px",
              color: "#858a94",
              fontSize: "12px",
            }}
          >
            Control whether your restaurant is
            open and accepting orders.
          </div>
        </div>

        <div
          style={{
            padding: "6px 20px",
          }}
        >
          <ToggleRow
            title="Restaurant open"
            description="Controls whether your restaurant is currently open."
            enabled={settings.is_open}
            onChange={(value) =>
              updateField("is_open", value)
            }
          />

          <ToggleRow
            title="Accept orders"
            description="Allow customers to place new orders."
            enabled={settings.accept_orders}
            onChange={(value) =>
              updateField(
                "accept_orders",
                value
              )
            }
          />
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: "7px",
          fontSize: "11px",
          fontWeight: "600",
          color: "#344054",
        }}
      >
        {label}
        {required ? " *" : ""}
      </label>

      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 11px",
          border: "1px solid #d0d5dd",
          borderRadius: "7px",
          fontSize: "12px",
          outline: "none",
        }}
      />
    </div>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "20px",
        padding: "16px 0",
        borderBottom: "1px solid #f2f4f7",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "#202228",
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: "4px",
            fontSize: "11px",
            color: "#858a94",
          }}
        >
          {description}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange(!enabled)}
        style={{
          width: "42px",
          height: "24px",
          padding: "3px",
          border: "none",
          borderRadius: "999px",
          background: enabled
            ? "#202228"
            : "#d0d5dd",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: enabled
            ? "flex-end"
            : "flex-start",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: "#fff",
            display: "block",
          }}
        />
      </button>
    </div>
  );
}