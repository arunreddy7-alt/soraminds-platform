"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateRestaurantPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    slug: "",
    phone: "",
    cuisine: "",
    address: "",
    accent_color: "#E53935",
    is_open: true,
    accept_orders: true,
    owner_full_name: "",
    owner_email: "",
    owner_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(
    field: string,
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
      slug: generateSlug(value),
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (form.owner_password.length < 8) {
      setError(
        "Owner password must be at least 8 characters."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/platform/restaurants",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create restaurant."
        );
      }

      router.push(
        `/platform/restaurants/${data.restaurant.id}`
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        paddingBottom: "40px",
      }}
    >
      {/* Header */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "28px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: "700",
              color: "#202228",
            }}
          >
            Create Restaurant
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: "14px",
              color: "#777d87",
            }}
          >
            Add a new restaurant to the Soraminds
            Platform.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push("/platform/restaurants")
          }
          style={{
            border: "1px solid #e1e4e8",
            background: "#ffffff",
            color: "#30343b",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Back
        </button>
      </div>

      {/* Error */}

      {error && (
        <div
          style={{
            background: "#fff1f1",
            border: "1px solid #f0caca",
            color: "#c62828",
            padding: "14px 16px",
            borderRadius: "10px",
            fontSize: "14px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Restaurant Information */}

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "14px",
            padding: "28px",
            marginBottom: "20px",
          }}
        >
          <h3
            style={{
              margin: "0 0 22px",
              fontSize: "18px",
              fontWeight: "700",
              color: "#202228",
            }}
          >
            Restaurant Information
          </h3>

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
                Restaurant Name *
              </label>

              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  handleNameChange(e.target.value)
                }
                required
                placeholder="e.g. Broccoli Restaurant"
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
                Slug *
              </label>

              <input
                type="text"
                value={form.slug}
                onChange={(e) =>
                  updateField(
                    "slug",
                    generateSlug(e.target.value)
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

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "12px",
                  color: "#8a9099",
                }}
              >
                Used as the unique restaurant identifier.
              </p>
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
                type="text"
                value={form.phone}
                onChange={(e) =>
                  updateField("phone", e.target.value)
                }
                placeholder="+91 9876543210"
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
                type="text"
                value={form.cuisine}
                onChange={(e) =>
                  updateField(
                    "cuisine",
                    e.target.value
                  )
                }
                placeholder="Indian, Italian, Chinese..."
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
                onChange={(e) =>
                  updateField(
                    "address",
                    e.target.value
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

            {/* Accent Color */}

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
                Accent Color
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <input
                  type="color"
                  value={form.accent_color}
                  onChange={(e) =>
                    updateField(
                      "accent_color",
                      e.target.value
                    )
                  }
                  style={{
                    width: "48px",
                    height: "42px",
                    border: "1px solid #dfe2e7",
                    borderRadius: "8px",
                    padding: "3px",
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                />

                <input
                  type="text"
                  value={form.accent_color}
                  onChange={(e) =>
                    updateField(
                      "accent_color",
                      e.target.value
                    )
                  }
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    border: "1px solid #dfe2e7",
                    borderRadius: "8px",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Operational Settings */}

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#343840",
                }}
              >
                Operational Settings
              </label>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    fontSize: "14px",
                    color: "#454a52",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.is_open}
                    onChange={(e) =>
                      updateField(
                        "is_open",
                        e.target.checked
                      )
                    }
                  />
                  Restaurant is open
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    fontSize: "14px",
                    color: "#454a52",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.accept_orders}
                    onChange={(e) =>
                      updateField(
                        "accept_orders",
                        e.target.checked
                      )
                    }
                  />
                  Accept orders
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Restaurant Owner */}

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "14px",
            padding: "28px",
            marginBottom: "20px",
          }}
        >
          <h3
            style={{
              margin: "0 0 6px",
              fontSize: "18px",
              fontWeight: "700",
              color: "#202228",
            }}
          >
            Restaurant Owner Account
          </h3>

          <p
            style={{
              margin: "0 0 22px",
              fontSize: "13px",
              color: "#777d87",
            }}
          >
            This account will be assigned the OWNER role
            for this restaurant.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "20px",
            }}
          >
            {/* Owner Name */}

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
                Owner Full Name *
              </label>

              <input
                type="text"
                value={form.owner_full_name}
                onChange={(e) =>
                  updateField(
                    "owner_full_name",
                    e.target.value
                  )
                }
                required
                placeholder="Owner name"
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

            {/* Owner Email */}

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
                Owner Email *
              </label>

              <input
                type="email"
                value={form.owner_email}
                onChange={(e) =>
                  updateField(
                    "owner_email",
                    e.target.value
                  )
                }
                required
                placeholder="owner@example.com"
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

            {/* Owner Password */}

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
                Owner Password *
              </label>

              <input
                type="password"
                value={form.owner_password}
                onChange={(e) =>
                  updateField(
                    "owner_password",
                    e.target.value
                  )
                }
                required
                minLength={8}
                placeholder="Minimum 8 characters"
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

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "12px",
                  color: "#8a9099",
                }}
              >
                The password is securely handled by
                Supabase Auth.
              </p>
            </div>
          </div>
        </div>

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
              router.push("/platform/restaurants")
            }
            disabled={loading}
            style={{
              padding: "12px 20px",
              border: "1px solid #dfe2e7",
              background: "#ffffff",
              color: "#343840",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 22px",
              border: "none",
              background: loading
                ? "#777d87"
                : "#202228",
              color: "#ffffff",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Creating..."
              : "Create Restaurant"}
          </button>
        </div>
      </form>
    </div>
  );
}