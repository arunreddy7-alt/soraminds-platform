"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Coupon = {
  id: number;
  restaurant_id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  start_at: string;
  end_at: string;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function CouponsClient() {
  const supabase = createClient();

  const [restaurantId, setRestaurantId] = useState<number | null>(
    null
  );
  const [restaurantName, setRestaurantName] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] =
    useState<Coupon | null>(null);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] =
    useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("You are not logged in.");
      }

      const { data: userData, error: userDataError } =
        await supabase
          .from("users")
          .select("restaurant_id")
          .eq("auth_user_id", user.id)
          .eq("is_active", true)
          .single();

      if (userDataError) throw userDataError;

      if (!userData?.restaurant_id) {
        throw new Error("Restaurant could not be found.");
      }

      const currentRestaurantId = userData.restaurant_id;

      setRestaurantId(currentRestaurantId);

      const [restaurantResult, couponsResult] =
        await Promise.all([
          supabase
            .from("restaurants")
            .select("name")
            .eq("id", currentRestaurantId)
            .single(),

          supabase
            .from("coupons")
            .select(
              `
                id,
                restaurant_id,
                code,
                discount_type,
                discount_value,
                min_order_amount,
                max_discount,
                start_at,
                end_at,
                usage_limit,
                used_count,
                is_active,
                created_at,
                updated_at
              `
            )
            .eq("restaurant_id", currentRestaurantId)
            .order("created_at", { ascending: false }),
        ]);

      if (restaurantResult.error) {
        throw restaurantResult.error;
      }

      if (couponsResult.error) {
        throw couponsResult.error;
      }

      setRestaurantName(restaurantResult.data?.name || "");
      setCoupons((couponsResult.data as Coupon[]) || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load coupons.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("");
    setMinOrderAmount("");
    setMaxDiscount("");
    setStartAt("");
    setEndAt("");
    setUsageLimit("");
    setEditingCoupon(null);
    setError("");
  }

  function openCreateModal() {
    resetForm();
    setShowModal(true);
  }

  function formatDateForInput(value: string) {
    if (!value) return "";

    const date = new Date(value);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function openEditModal(coupon: Coupon) {
    setEditingCoupon(coupon);

    setCode(coupon.code);
    setDiscountType(
      coupon.discount_type === "fixed"
        ? "fixed"
        : "percentage"
    );
    setDiscountValue(String(coupon.discount_value));
    setMinOrderAmount(String(coupon.min_order_amount));
    setMaxDiscount(
      coupon.max_discount !== null
        ? String(coupon.max_discount)
        : ""
    );
    setStartAt(formatDateForInput(coupon.start_at));
    setEndAt(formatDateForInput(coupon.end_at));
    setUsageLimit(
      coupon.usage_limit !== null
        ? String(coupon.usage_limit)
        : ""
    );

    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    resetForm();
  }

  async function handleSave() {
    try {
      setError("");
      setSuccess("");

      if (!restaurantId) {
        setError("Restaurant not found.");
        return;
      }

      const normalizedCode = code.trim().toUpperCase();

      if (!normalizedCode) {
        setError("Coupon code is required.");
        return;
      }

      const value = Number(discountValue);
      const minimumOrder = Number(minOrderAmount || 0);
      const maximumDiscount =
        maxDiscount.trim() === ""
          ? null
          : Number(maxDiscount);
      const limit =
        usageLimit.trim() === ""
          ? null
          : Number(usageLimit);

      if (!Number.isFinite(value) || value <= 0) {
        setError("Discount value must be greater than 0.");
        return;
      }

      if (
        discountType === "percentage" &&
        value > 100
      ) {
        setError("Percentage discount cannot exceed 100%.");
        return;
      }

      if (
        !Number.isFinite(minimumOrder) ||
        minimumOrder < 0
      ) {
        setError("Minimum order amount cannot be negative.");
        return;
      }

      if (
        maximumDiscount !== null &&
        (!Number.isFinite(maximumDiscount) ||
          maximumDiscount <= 0)
      ) {
        setError("Maximum discount must be greater than 0.");
        return;
      }

      if (
        discountType === "fixed" &&
        maximumDiscount !== null
      ) {
        setError(
          "Maximum discount is only applicable to percentage coupons."
        );
        return;
      }

      if (!startAt || !endAt) {
        setError("Start and end dates are required.");
        return;
      }

      const startDate = new Date(startAt);
      const endDate = new Date(endAt);

      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        setError("Please enter valid dates.");
        return;
      }

      if (endDate <= startDate) {
        setError("End date must be after the start date.");
        return;
      }

      if (
        limit !== null &&
        (!Number.isInteger(limit) || limit <= 0)
      ) {
        setError("Usage limit must be a positive whole number.");
        return;
      }

      if (
        editingCoupon &&
        limit !== null &&
        limit < editingCoupon.used_count
      ) {
        setError(
          `Usage limit cannot be lower than the current used count (${editingCoupon.used_count}).`
        );
        return;
      }

      setSaving(true);

      const now = new Date().toISOString();

      const payload = {
        restaurant_id: restaurantId,
        code: normalizedCode,
        discount_type: discountType,
        discount_value: value,
        min_order_amount: minimumOrder,
        max_discount:
          discountType === "percentage"
            ? maximumDiscount
            : null,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        usage_limit: limit,
        updated_at: now,
      };

      if (editingCoupon) {
        const { error: updateError } = await supabase
          .from("coupons")
          .update({
            code: payload.code,
            discount_type: payload.discount_type,
            discount_value: payload.discount_value,
            min_order_amount: payload.min_order_amount,
            max_discount: payload.max_discount,
            start_at: payload.start_at,
            end_at: payload.end_at,
            usage_limit: payload.usage_limit,
            updated_at: payload.updated_at,
          })
          .eq("id", editingCoupon.id)
          .eq("restaurant_id", restaurantId);

        if (updateError) {
          throw updateError;
        }

        setSuccess("Coupon updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("coupons")
          .insert({
            ...payload,
            used_count: 0,
            is_active: true,
            created_at: now,
          });

        if (insertError) {
          if (insertError.code === "23505") {
            throw new Error(
              "A coupon with this code already exists."
            );
          }

          throw insertError;
        }

        setSuccess("Coupon created successfully.");
      }

      setShowModal(false);
      resetForm();

      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCouponStatus(coupon: Coupon) {
    try {
      setError("");

      const { error: updateError } = await supabase
        .from("coupons")
        .update({
          is_active: !coupon.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", coupon.id)
        .eq("restaurant_id", restaurantId);

      if (updateError) {
        throw updateError;
      }

      setCoupons((current) =>
        current.map((item) =>
          item.id === coupon.id
            ? {
                ...item,
                is_active: !item.is_active,
              }
            : item
        )
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || "Failed to update coupon status."
      );
    }
  }

  function formatPrice(value: number) {
    return `₹${Number(value).toFixed(2)}`;
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getCouponStatus(coupon: Coupon) {
    const now = Date.now();
    const start = new Date(coupon.start_at).getTime();
    const end = new Date(coupon.end_at).getTime();

    if (!coupon.is_active) {
      return "Inactive";
    }

    if (now < start) {
      return "Scheduled";
    }

    if (now > end) {
      return "Expired";
    }

    if (
      coupon.usage_limit !== null &&
      coupon.used_count >= coupon.usage_limit
    ) {
      return "Limit Reached";
    }

    return "Active";
  }

  const filteredCoupons = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return coupons;

    return coupons.filter((coupon) =>
      coupon.code.toLowerCase().includes(value)
    );
  }, [coupons, search]);

  const activeCount = coupons.filter(
    (coupon) => coupon.is_active
  ).length;

  const totalUsed = coupons.reduce(
    (total, coupon) => total + Number(coupon.used_count || 0),
    0
  );

  if (loading) {
    return (
      <div
        style={{
          padding: "32px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            color: "#666",
          }}
        >
          Loading coupons...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "28px 32px",
        fontFamily: "Arial, sans-serif",
        color: "#171717",
        minHeight: "100%",
        background: "#fafafa",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: 700,
            }}
          >
            Coupons
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: "14px",
              color: "#737373",
            }}
          >
            Create and manage discount coupons
            {restaurantName ? ` for ${restaurantName}` : ""}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          style={{
            border: "none",
            background: "#171717",
            color: "#fff",
            padding: "11px 18px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          + Create Coupon
        </button>
      </div>

      {/* ALERTS */}

      {error && !showModal && (
        <div
          style={{
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#be123c",
            padding: "12px 14px",
            borderRadius: "8px",
            marginBottom: "18px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {success && !showModal && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#15803d",
            padding: "12px 14px",
            borderRadius: "8px",
            marginBottom: "18px",
            fontSize: "14px",
          }}
        >
          {success}
        </div>
      )}

      {/* STATS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "10px",
            padding: "18px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#737373",
            }}
          >
            Total Coupons
          </div>

          <div
            style={{
              fontSize: "25px",
              fontWeight: 700,
              marginTop: "6px",
            }}
          >
            {coupons.length}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "10px",
            padding: "18px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#737373",
            }}
          >
            Active
          </div>

          <div
            style={{
              fontSize: "25px",
              fontWeight: 700,
              marginTop: "6px",
            }}
          >
            {activeCount}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "10px",
            padding: "18px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#737373",
            }}
          >
            Total Uses
          </div>

          <div
            style={{
              fontSize: "25px",
              fontWeight: 700,
              marginTop: "6px",
            }}
          >
            {totalUsed}
          </div>
        </div>
      </div>

      {/* SEARCH */}

      {coupons.length > 0 && (
        <div
          style={{
            marginBottom: "18px",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coupon code..."
            style={{
              width: "100%",
              maxWidth: "420px",
              boxSizing: "border-box",
              padding: "11px 12px",
              border: "1px solid #d4d4d4",
              borderRadius: "8px",
              fontSize: "13px",
              outline: "none",
              background: "#fff",
            }}
          />
        </div>
      )}

      {/* COUPON LIST */}

      {coupons.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "10px",
            padding: "60px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: 600,
              marginBottom: "8px",
            }}
          >
            No coupons yet
          </div>

          <div
            style={{
              color: "#737373",
              fontSize: "14px",
              marginBottom: "18px",
            }}
          >
            Create your first discount coupon.
          </div>

          <button
            onClick={openCreateModal}
            style={{
              border: "none",
              background: "#171717",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: "7px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Create Coupon
          </button>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "10px",
            padding: "40px",
            textAlign: "center",
            color: "#737373",
            fontSize: "14px",
          }}
        >
          No coupons match your search.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(330px, 1fr))",
            gap: "18px",
          }}
        >
          {filteredCoupons.map((coupon) => {
            const status = getCouponStatus(coupon);

            const statusColor =
              status === "Active"
                ? "#15803d"
                : status === "Scheduled"
                ? "#0369a1"
                : status === "Inactive"
                ? "#737373"
                : "#b91c1c";

            const usagePercentage =
              coupon.usage_limit !== null &&
              coupon.usage_limit > 0
                ? Math.min(
                    100,
                    (coupon.used_count /
                      coupon.usage_limit) *
                      100
                  )
                : 0;

            return (
              <div
                key={coupon.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e5e5",
                  borderRadius: "12px",
                  padding: "18px",
                  opacity: coupon.is_active ? 1 : 0.65,
                }}
              >
                {/* TOP */}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "inline-block",
                        background: "#f5f5f5",
                        border: "1px dashed #bdbdbd",
                        borderRadius: "6px",
                        padding: "7px 10px",
                        fontSize: "15px",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                      }}
                    >
                      {coupon.code}
                    </div>
                  </div>

                  <div
                    style={{
                      background:
                        status === "Active"
                          ? "#dcfce7"
                          : status === "Scheduled"
                          ? "#e0f2fe"
                          : status === "Inactive"
                          ? "#f5f5f5"
                          : "#fee2e2",
                      color: statusColor,
                      borderRadius: "999px",
                      padding: "5px 9px",
                      fontSize: "11px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {status}
                  </div>
                </div>

                {/* DISCOUNT */}

                <div
                  style={{
                    marginTop: "18px",
                    fontSize: "22px",
                    fontWeight: 700,
                  }}
                >
                  {coupon.discount_type === "percentage"
                    ? `${Number(
                        coupon.discount_value
                      )}% OFF`
                    : `${formatPrice(
                        Number(coupon.discount_value)
                      )} OFF`}
                </div>

                {/* DETAILS */}

                <div
                  style={{
                    marginTop: "14px",
                    paddingTop: "13px",
                    borderTop: "1px solid #f0f0f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      marginBottom: "7px",
                    }}
                  >
                    <span style={{ color: "#737373" }}>
                      Minimum Order
                    </span>

                    <strong>
                      {formatPrice(
                        Number(coupon.min_order_amount)
                      )}
                    </strong>
                  </div>

                  {coupon.discount_type === "percentage" &&
                    coupon.max_discount !== null && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px",
                          marginBottom: "7px",
                        }}
                      >
                        <span
                          style={{
                            color: "#737373",
                          }}
                        >
                          Max Discount
                        </span>

                        <strong>
                          {formatPrice(
                            Number(coupon.max_discount)
                          )}
                        </strong>
                      </div>
                    )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      marginBottom: "7px",
                    }}
                  >
                    <span style={{ color: "#737373" }}>
                      Valid From
                    </span>

                    <span>
                      {formatDate(coupon.start_at)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ color: "#737373" }}>
                      Valid Until
                    </span>

                    <span>
                      {formatDate(coupon.end_at)}
                    </span>
                  </div>
                </div>

                {/* USAGE */}

                <div
                  style={{
                    marginTop: "15px",
                    paddingTop: "13px",
                    borderTop: "1px solid #f0f0f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      marginBottom: "7px",
                    }}
                  >
                    <span style={{ color: "#737373" }}>
                      Usage
                    </span>

                    <span>
                      {coupon.used_count}
                      {coupon.usage_limit !== null
                        ? ` / ${coupon.usage_limit}`
                        : " / Unlimited"}
                    </span>
                  </div>

                  {coupon.usage_limit !== null && (
                    <div
                      style={{
                        height: "6px",
                        background: "#eeeeee",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${usagePercentage}%`,
                          height: "100%",
                          background:
                            usagePercentage >= 100
                              ? "#dc2626"
                              : "#171717",
                          borderRadius: "999px",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* ACTIONS */}

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "16px",
                  }}
                >
                  <button
                    onClick={() => openEditModal(coupon)}
                    style={{
                      flex: 1,
                      border: "1px solid #d4d4d4",
                      background: "#fff",
                      color: "#171717",
                      padding: "9px",
                      borderRadius: "7px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={() =>
                      toggleCouponStatus(coupon)
                    }
                    style={{
                      flex: 1,
                      border: "1px solid #d4d4d4",
                      background: "#fff",
                      color: coupon.is_active
                        ? "#b91c1c"
                        : "#15803d",
                      padding: "9px",
                      borderRadius: "7px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {coupon.is_active
                      ? "Deactivate"
                      : "Activate"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "760px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            {/* MODAL HEADER */}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 22px",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "20px",
                  }}
                >
                  {editingCoupon
                    ? "Edit Coupon"
                    : "Create Coupon"}
                </h2>

                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#737373",
                    fontSize: "13px",
                  }}
                >
                  Configure discounts and coupon validity.
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={saving}
                style={{
                  border: "none",
                  background: "#f5f5f5",
                  width: "34px",
                  height: "34px",
                  borderRadius: "7px",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: "22px",
              }}
            >
              {error && (
                <div
                  style={{
                    background: "#fff1f2",
                    border: "1px solid #fecdd3",
                    color: "#be123c",
                    padding: "11px 13px",
                    borderRadius: "7px",
                    marginBottom: "18px",
                    fontSize: "13px",
                  }}
                >
                  {error}
                </div>
              )}

              {/* CODE */}

              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "7px",
                }}
              >
                Coupon Code *
              </label>

              <input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase())
                }
                maxLength={50}
                placeholder="Example: SAVE20"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 11px",
                  border: "1px solid #d4d4d4",
                  borderRadius: "7px",
                  fontSize: "13px",
                  outline: "none",
                  textTransform: "uppercase",
                }}
              />

              {/* DISCOUNT ROW */}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginTop: "17px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "7px",
                    }}
                  >
                    Discount Type *
                  </label>

                  <select
                    value={discountType}
                    onChange={(e) =>
                      setDiscountType(
                        e.target.value as
                          | "percentage"
                          | "fixed"
                      )
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 11px",
                      border: "1px solid #d4d4d4",
                      borderRadius: "7px",
                      fontSize: "13px",
                      outline: "none",
                      background: "#fff",
                    }}
                  >
                    <option value="percentage">
                      Percentage
                    </option>
                    <option value="fixed">
                      Fixed Amount
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "7px",
                    }}
                  >
                    Discount Value *
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountValue}
                    onChange={(e) =>
                      setDiscountValue(e.target.value)
                    }
                    placeholder={
                      discountType === "percentage"
                        ? "20"
                        : "100"
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 11px",
                      border: "1px solid #d4d4d4",
                      borderRadius: "7px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* ORDER / MAX DISCOUNT */}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginTop: "17px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "7px",
                    }}
                  >
                    Minimum Order Amount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minOrderAmount}
                    onChange={(e) =>
                      setMinOrderAmount(e.target.value)
                    }
                    placeholder="0"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 11px",
                      border: "1px solid #d4d4d4",
                      borderRadius: "7px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "7px",
                    }}
                  >
                    Max Discount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={maxDiscount}
                    onChange={(e) =>
                      setMaxDiscount(e.target.value)
                    }
                    disabled={discountType === "fixed"}
                    placeholder={
                      discountType === "fixed"
                        ? "Not applicable"
                        : "Example: 500"
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 11px",
                      border: "1px solid #d4d4d4",
                      borderRadius: "7px",
                      fontSize: "13px",
                      outline: "none",
                      background:
                        discountType === "fixed"
                          ? "#f5f5f5"
                          : "#fff",
                    }}
                  />

                  {discountType === "percentage" && (
                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "11px",
                        color: "#737373",
                      }}
                    >
                      Maximum amount the customer can save.
                    </div>
                  )}
                </div>
              </div>

              {/* DATES */}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginTop: "17px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "7px",
                    }}
                  >
                    Start Date & Time *
                  </label>

                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) =>
                      setStartAt(e.target.value)
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 11px",
                      border: "1px solid #d4d4d4",
                      borderRadius: "7px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "7px",
                    }}
                  >
                    End Date & Time *
                  </label>

                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) =>
                      setEndAt(e.target.value)
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 11px",
                      border: "1px solid #d4d4d4",
                      borderRadius: "7px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* USAGE LIMIT */}

              <div
                style={{
                  marginTop: "17px",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "7px",
                  }}
                >
                  Usage Limit
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={usageLimit}
                  onChange={(e) =>
                    setUsageLimit(e.target.value)
                  }
                  placeholder="Leave empty for unlimited"
                  style={{
                    width: "100%",
                    maxWidth: "320px",
                    boxSizing: "border-box",
                    padding: "10px 11px",
                    border: "1px solid #d4d4d4",
                    borderRadius: "7px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "12px",
                    color: "#737373",
                  }}
                >
                  Leave empty if the coupon can be used
                  unlimited times.
                </div>
              </div>

              {/* EXISTING USAGE */}

              {editingCoupon && (
                <div
                  style={{
                    marginTop: "17px",
                    background: "#fafafa",
                    border: "1px solid #e5e5e5",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "#737373" }}>
                    Current usage:
                  </span>{" "}
                  <strong>
                    {editingCoupon.used_count}
                  </strong>
                </div>
              )}

              {/* FOOTER */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "9px",
                  marginTop: "24px",
                  paddingTop: "18px",
                  borderTop: "1px solid #e5e5e5",
                }}
              >
                <button
                  onClick={closeModal}
                  disabled={saving}
                  style={{
                    border: "1px solid #d4d4d4",
                    background: "#fff",
                    color: "#171717",
                    padding: "10px 18px",
                    borderRadius: "7px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    border: "none",
                    background: saving
                      ? "#a3a3a3"
                      : "#171717",
                    color: "#fff",
                    padding: "10px 20px",
                    borderRadius: "7px",
                    cursor: saving
                      ? "not-allowed"
                      : "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingCoupon
                    ? "Update Coupon"
                    : "Create Coupon"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}