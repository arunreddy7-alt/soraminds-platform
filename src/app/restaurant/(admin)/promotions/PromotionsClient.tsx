"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Banner = {
  id: number;
  restaurant_id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function PromotionsClient() {
  const supabase = createClient();

  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [banners, setBanners] = useState<Banner[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(
    null
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [imageUrl, setImageUrl] = useState("");

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

      const [restaurantResult, bannersResult] =
        await Promise.all([
          supabase
            .from("restaurants")
            .select("name")
            .eq("id", currentRestaurantId)
            .single(),

          supabase
            .from("banners")
            .select(
              `
                id,
                restaurant_id,
                title,
                description,
                image_url,
                sort_order,
                is_active,
                created_at,
                updated_at
              `
            )
            .eq("restaurant_id", currentRestaurantId)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: false }),
        ]);

      if (restaurantResult.error) {
        throw restaurantResult.error;
      }

      if (bannersResult.error) {
        throw bannersResult.error;
      }

      setRestaurantName(restaurantResult.data?.name || "");
      setBanners((bannersResult.data as Banner[]) || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load promotions.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setSortOrder("0");
    setImageUrl("");
    setEditingBanner(null);
    setError("");
  }

  function openCreateModal() {
    resetForm();
    setShowModal(true);
  }

  function openEditModal(banner: Banner) {
    setEditingBanner(banner);
    setTitle(banner.title);
    setDescription(banner.description || "");
    setSortOrder(String(banner.sort_order));
    setImageUrl(banner.image_url || "");
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving || uploadingImage) return;

    setShowModal(false);
    resetForm();
  }

  async function handleImageUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    try {
      const file = event.target.files?.[0];

      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file.");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be smaller than 5MB.");
        return;
      }

      if (!restaurantId) {
        setError("Restaurant not found.");
        return;
      }

      setUploadingImage(true);
      setError("");

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const fileName = `banner-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}.${extension}`;

      const filePath = `banners/${restaurantId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("menu-images")
        .getPublicUrl(filePath);

      setImageUrl(data.publicUrl);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Image upload failed.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  async function handleSave() {
    try {
      setError("");
      setSuccess("");

      if (!restaurantId) {
        setError("Restaurant not found.");
        return;
      }

      if (!title.trim()) {
        setError("Banner title is required.");
        return;
      }

      const parsedSortOrder = Number(sortOrder);

      if (
        !Number.isInteger(parsedSortOrder) ||
        parsedSortOrder < 0
      ) {
        setError("Sort order must be a whole number starting from 0.");
        return;
      }

      setSaving(true);

      const now = new Date().toISOString();

      if (editingBanner) {
        const { error: updateError } = await supabase
          .from("banners")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            image_url: imageUrl || null,
            sort_order: parsedSortOrder,
            updated_at: now,
          })
          .eq("id", editingBanner.id)
          .eq("restaurant_id", restaurantId);

        if (updateError) {
          throw updateError;
        }

        setSuccess("Banner updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("banners")
          .insert({
            restaurant_id: restaurantId,
            title: title.trim(),
            description: description.trim() || null,
            image_url: imageUrl || null,
            sort_order: parsedSortOrder,
            is_active: true,
            created_at: now,
            updated_at: now,
          });

        if (insertError) {
          throw insertError;
        }

        setSuccess("Banner created successfully.");
      }

      setShowModal(false);
      resetForm();

      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save banner.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleBannerStatus(banner: Banner) {
    try {
      setError("");

      const { error: updateError } = await supabase
        .from("banners")
        .update({
          is_active: !banner.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", banner.id)
        .eq("restaurant_id", restaurantId);

      if (updateError) {
        throw updateError;
      }

      setBanners((current) =>
        current.map((item) =>
          item.id === banner.id
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
        err?.message || "Failed to update banner status."
      );
    }
  }

  const filteredBanners = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return banners;

    return banners.filter(
      (banner) =>
        banner.title.toLowerCase().includes(value) ||
        (banner.description || "")
          .toLowerCase()
          .includes(value)
    );
  }, [banners, search]);

  const activeCount = banners.filter(
    (banner) => banner.is_active
  ).length;

  const inactiveCount = banners.filter(
    (banner) => !banner.is_active
  ).length;

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
          Loading promotions...
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
            Promotions
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: "14px",
              color: "#737373",
            }}
          >
            Manage customer homepage banners
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
          + Create Banner
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
            Total Banners
          </div>

          <div
            style={{
              fontSize: "25px",
              fontWeight: 700,
              marginTop: "6px",
            }}
          >
            {banners.length}
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
            Inactive
          </div>

          <div
            style={{
              fontSize: "25px",
              fontWeight: 700,
              marginTop: "6px",
            }}
          >
            {inactiveCount}
          </div>
        </div>
      </div>

      {/* SEARCH */}

      {banners.length > 0 && (
        <div
          style={{
            marginBottom: "18px",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search banners..."
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

      {/* EMPTY */}

      {banners.length === 0 ? (
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
            No banners yet
          </div>

          <div
            style={{
              color: "#737373",
              fontSize: "14px",
              marginBottom: "18px",
            }}
          >
            Create your first promotional banner.
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
            Create Banner
          </button>
        </div>
      ) : filteredBanners.length === 0 ? (
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
          No banners match your search.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "18px",
          }}
        >
          {filteredBanners.map((banner) => (
            <div
              key={banner.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e5e5",
                borderRadius: "12px",
                overflow: "hidden",
                opacity: banner.is_active ? 1 : 0.65,
              }}
            >
              {/* IMAGE */}

              <div
                style={{
                  height: "180px",
                  background: "#f5f5f5",
                  position: "relative",
                }}
              >
                {banner.image_url ? (
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#a3a3a3",
                      fontSize: "14px",
                    }}
                  >
                    No image
                  </div>
                )}

                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: banner.is_active
                      ? "#dcfce7"
                      : "#f5f5f5",
                    color: banner.is_active
                      ? "#15803d"
                      : "#737373",
                    borderRadius: "999px",
                    padding: "5px 9px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {banner.is_active ? "ACTIVE" : "INACTIVE"}
                </div>
              </div>

              {/* CONTENT */}

              <div
                style={{
                  padding: "17px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "17px",
                        fontWeight: 700,
                      }}
                    >
                      {banner.title}
                    </h3>

                    {banner.description && (
                      <p
                        style={{
                          margin: "7px 0 0",
                          color: "#737373",
                          fontSize: "13px",
                          lineHeight: 1.5,
                        }}
                      >
                        {banner.description}
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      flexShrink: 0,
                      textAlign: "right",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#737373",
                      }}
                    >
                      Order
                    </div>

                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        marginTop: "3px",
                      }}
                    >
                      {banner.sort_order}
                    </div>
                  </div>
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
                    onClick={() => openEditModal(banner)}
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
                    onClick={() => toggleBannerStatus(banner)}
                    style={{
                      flex: 1,
                      border: "1px solid #d4d4d4",
                      background: "#fff",
                      color: banner.is_active
                        ? "#b91c1c"
                        : "#15803d",
                      padding: "9px",
                      borderRadius: "7px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {banner.is_active
                      ? "Deactivate"
                      : "Activate"}
                  </button>
                </div>
              </div>
            </div>
          ))}
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
              maxWidth: "720px",
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
                  {editingBanner
                    ? "Edit Banner"
                    : "Create Banner"}
                </h2>

                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#737373",
                    fontSize: "13px",
                  }}
                >
                  Manage promotional content shown to customers.
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={saving || uploadingImage}
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

              {/* TITLE */}

              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "7px",
                }}
              >
                Title *
              </label>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Example: Weekend Special"
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

              {/* DESCRIPTION */}

              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginTop: "17px",
                  marginBottom: "7px",
                }}
              >
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="Describe the promotion..."
                rows={4}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 11px",
                  border: "1px solid #d4d4d4",
                  borderRadius: "7px",
                  fontSize: "13px",
                  resize: "vertical",
                  outline: "none",
                }}
              />

              {/* SORT ORDER */}

              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginTop: "17px",
                  marginBottom: "7px",
                }}
              >
                Display Order
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value)
                }
                style={{
                  width: "160px",
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
                Lower numbers appear first.
              </div>

              {/* IMAGE */}

              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginTop: "17px",
                  marginBottom: "7px",
                }}
              >
                Banner Image
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                style={{
                  width: "100%",
                  fontSize: "13px",
                }}
              />

              {uploadingImage && (
                <div
                  style={{
                    marginTop: "7px",
                    fontSize: "12px",
                    color: "#737373",
                  }}
                >
                  Uploading image...
                </div>
              )}

              {imageUrl && (
                <div
                  style={{
                    marginTop: "12px",
                  }}
                >
                  <img
                    src={imageUrl}
                    alt="Banner preview"
                    style={{
                      width: "100%",
                      height: "220px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      border: "1px solid #e5e5e5",
                    }}
                  />
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
                  disabled={saving || uploadingImage}
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
                  disabled={saving || uploadingImage}
                  style={{
                    border: "none",
                    background:
                      saving || uploadingImage
                        ? "#a3a3a3"
                        : "#171717",
                    color: "#fff",
                    padding: "10px 20px",
                    borderRadius: "7px",
                    cursor:
                      saving || uploadingImage
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingBanner
                    ? "Update Banner"
                    : "Create Banner"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}