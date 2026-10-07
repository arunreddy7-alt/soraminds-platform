"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
};

type FormState = {
  name: string;
  slug: string;
  phone: string;
  cuisine: string;
  address: string;
  accent_color: string;
  is_open: boolean;
  accept_orders: boolean;
};

export default function RestaurantEditClient() {
  const params = useParams();
  const router = useRouter();

  const restaurantId = params.id as string;

  const [form, setForm] = useState<FormState>({
    name: "",
    slug: "",
    phone: "",
    cuisine: "",
    address: "",
    accent_color: "#E53935",
    is_open: true,
    accept_orders: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

        const data: Restaurant | { error: string } =
          await response.json();

        if (!response.ok) {
          throw new Error(
            "error" in data
              ? data.error
              : "Failed to load restaurant."
          );
        }

        if ("error" in data) {
          throw new Error(data.error);
        }

        setForm({
          name: data.name || "",
          slug: data.slug || "",
          phone: data.phone || "",
          cuisine: data.cuisine || "",
          address: data.address || "",
          accent_color:
            data.accent_color || "#E53935",
          is_open: data.is_open ?? true,
          accept_orders: data.accept_orders ?? true,
        });
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

  function updateField(
    field: keyof FormState,
    value: string | boolean
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function handleNameChange(value: string) {
    setForm((previous) => ({
      ...previous,
      name: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Restaurant name is required.");
      return;
    }

    if (!form.slug.trim()) {
      setError("Restaurant slug is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `/api/platform/restaurants/${restaurantId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name,
            slug: generateSlug(form.slug),
            phone: form.phone || null,
            cuisine: form.cuisine || null,
            address: form.address || null,
            accent_color: form.accent_color,
            is_open: form.is_open,
            accept_orders: form.accept_orders,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update restaurant."
        );
      }

      router.push(
        `/platform/restaurants/${data.id}`
      );
      router.refresh();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update restaurant."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          paddingBottom: "40px",
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

  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        paddingBottom: "50px",
      }}
    >
      {/* Back */}

      <button
        type="button"
        onClick={() =>
          router.push(
            `/platform/restaurants/${restaurantId}`
          )
        }
        style={{
          border: "none",
          background: "transparent",
          color: "#555",
          fontSize: "14px",
          cursor: "pointer",
          padding: 0,
          marginBottom: "20px",
        }}
      >
        ← Back to Restaurant
      </button>

      {/* Header */}

      <div
        style={{
          marginBottom: "28px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: "700",
            color: "#202228",
          }}
        >
          Edit Restaurant
        </h1>

        <p
          style={{
            margin: "6px 0 0",
            fontSize: "14px",
            color: "#777d87",
          }}
        >
          Update restaurant information and operational
          settings.
        </p>
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

      <form onSubmit={handleSubmit}>
        {/* Restaurant Information */}

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "14px",
            padding: "28px",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: "0 0 22px",
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
            {/* Name */}

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#343840",
                }}
              >
                Restaurant Name
              </label>

              <input
                value={form.name}
                onChange={(event) =>
                  handleNameChange(event.target.value)
                }
                required
                placeholder="Restaurant name"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  border: "1px solid #dfe2e7",
                  borderRadius: "8px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            {/* Slug */}

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#343840",
                }}
              >
                Slug
              </label>

              <input
                value={form.slug}
                onChange={(event) =>
                  updateField(
                    "slug",
                    generateSlug(event.target.value)
                  )
                }
                required
                placeholder="restaurant-slug"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  border: "1px solid #dfe2e7",
                  borderRadius: "8px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            {/* Phone */}

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#343840",
                }}
              >
                Phone
              </label>

              <input
                value={form.phone}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value
                  )
                }
                placeholder="Phone number"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  border: "1px solid #dfe2e7",
                  borderRadius: "8px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            {/* Cuisine */}

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#343840",
                }}
              >
                Cuisine
              </label>

              <input
                value={form.cuisine}
                onChange={(event) =>
                  updateField(
                    "cuisine",
                    event.target.value
                  )
                }
                placeholder="Indian, Italian, etc."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  border: "1px solid #dfe2e7",
                  borderRadius: "8px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            {/* Address */}

            <div
              style={{
                gridColumn: "1 / -1",
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#343840",
                }}
              >
                Address
              </label>

              <textarea
                value={form.address}
                onChange={(event) =>
                  updateField(
                    "address",
                    event.target.value
                  )
                }
                rows={3}
                placeholder="Restaurant address"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  border: "1px solid #dfe2e7",
                  borderRadius: "8px",
                  fontSize: "14px",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
        </section>

        {/* Branding */}

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "14px",
            padding: "28px",
            marginBottom: "20px",
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
            Branding
          </h2>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <input
              type="color"
              value={form.accent_color}
              onChange={(event) =>
                updateField(
                  "accent_color",
                  event.target.value
                )
              }
              style={{
                width: "52px",
                height: "44px",
                border: "1px solid #dfe2e7",
                borderRadius: "8px",
                padding: "3px",
                background: "#ffffff",
                cursor: "pointer",
              }}
            />

            <div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#30343b",
                }}
              >
                {form.accent_color}
              </div>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#777d87",
                }}
              >
                Restaurant accent color
              </div>
            </div>
          </div>
        </section>

        {/* Operations */}

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "14px",
            padding: "28px",
            marginBottom: "20px",
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
            Operations
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Restaurant Open */}

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.is_open}
                onChange={(event) =>
                  updateField(
                    "is_open",
                    event.target.checked
                  )
                }
                style={{
                  marginTop: "3px",
                }}
              />

              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#30343b",
                  }}
                >
                  Restaurant Open
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    color: "#777d87",
                  }}
                >
                  Controls whether the restaurant is
                  currently open.
                </div>
              </div>
            </label>

            {/* Accept Orders */}

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.accept_orders}
                onChange={(event) =>
                  updateField(
                    "accept_orders",
                    event.target.checked
                  )
                }
                style={{
                  marginTop: "3px",
                }}
              />

              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#30343b",
                  }}
                >
                  Accept Orders
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    color: "#777d87",
                  }}
                >
                  Controls whether customers can
                  currently place orders.
                </div>
              </div>
            </label>
          </div>
        </section>

        {/* Actions */}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push(
                `/platform/restaurants/${restaurantId}`
              )
            }
            disabled={saving}
            style={{
              padding: "12px 20px",
              border: "1px solid #dfe2e7",
              background: "#ffffff",
              color: "#343840",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "12px 22px",
              border: "none",
              background: saving
                ? "#777d87"
                : "#202228",
              color: "#ffffff",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
          >
            {saving
              ? "Saving..."
              : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}