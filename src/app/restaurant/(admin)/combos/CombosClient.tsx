"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: number;
  restaurant_id: number;
  name: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_active: boolean;
};

type ComboItem = {
  id: number;
  combo_id: number;
  product_id: number;
  quantity: number;
  is_active: boolean;
};

type Combo = {
  id: number;
  restaurant_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  combo_price: number;
  original_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  combo_items?: ComboItem[];
};

type SelectedProduct = {
  product_id: number;
  quantity: number;
};

export default function CombosClient() {
  const supabase = createClient();

  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);

  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [comboPrice, setComboPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [selectedProducts, setSelectedProducts] = useState<
    SelectedProduct[]
  >([]);

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

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You are not logged in.");
      }

      const { data: userData, error: userDataError } = await supabase
        .from("users")
        .select("restaurant_id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .single();

      if (userDataError) {
        throw userDataError;
      }

      if (!userData?.restaurant_id) {
        throw new Error("Restaurant could not be found.");
      }

      const currentRestaurantId = userData.restaurant_id;

      setRestaurantId(currentRestaurantId);

      const [restaurantResult, productsResult, combosResult] =
        await Promise.all([
          supabase
            .from("restaurants")
            .select("name")
            .eq("id", currentRestaurantId)
            .single(),

          supabase
            .from("products")
            .select(
              "id, restaurant_id, name, price, image_url, is_available, is_active"
            )
            .eq("restaurant_id", currentRestaurantId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("combos")
            .select(
              `
                id,
                restaurant_id,
                name,
                description,
                image_url,
                combo_price,
                original_price,
                is_active,
                created_at,
                updated_at,
                combo_items (
                  id,
                  combo_id,
                  product_id,
                  quantity,
                  is_active
                )
              `
            )
            .eq("restaurant_id", currentRestaurantId)
            .order("created_at", { ascending: false }),
        ]);

      if (restaurantResult.error) {
        throw restaurantResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (combosResult.error) {
        throw combosResult.error;
      }

      setRestaurantName(restaurantResult.data?.name || "");
      setProducts(productsResult.data || []);
      setCombos((combosResult.data as Combo[]) || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load combos.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setComboPrice("");
    setImageUrl("");
    setSelectedProducts([]);
    setEditingCombo(null);
    setError("");
  }

  function openCreateModal() {
    resetForm();
    setShowModal(true);
  }

  function openEditModal(combo: Combo) {
    setEditingCombo(combo);

    setName(combo.name);
    setDescription(combo.description || "");
    setComboPrice(String(combo.combo_price));
    setImageUrl(combo.image_url || "");

    const activeItems =
      combo.combo_items
        ?.filter((item) => item.is_active)
        .map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })) || [];

    setSelectedProducts(activeItems);
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving || uploadingImage) return;

    setShowModal(false);
    resetForm();
  }

  function toggleProduct(productId: number) {
    setSelectedProducts((current) => {
      const exists = current.some(
        (item) => item.product_id === productId
      );

      if (exists) {
        return current.filter(
          (item) => item.product_id !== productId
        );
      }

      return [
        ...current,
        {
          product_id: productId,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(productId: number, quantity: number) {
    const safeQuantity = Math.max(1, quantity);

    setSelectedProducts((current) =>
      current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity: safeQuantity,
            }
          : item
      )
    );
  }

  function isProductSelected(productId: number) {
    return selectedProducts.some(
      (item) => item.product_id === productId
    );
  }

  const originalPrice = useMemo(() => {
    return selectedProducts.reduce((total, selected) => {
      const product = products.find(
        (item) => item.id === selected.product_id
      );

      if (!product) return total;

      return total + Number(product.price) * selected.quantity;
    }, 0);
  }, [selectedProducts, products]);

  const numericComboPrice = Number(comboPrice) || 0;

  const savings = Math.max(
    0,
    originalPrice - numericComboPrice
  );

  const savingsPercentage =
    originalPrice > 0
      ? Math.round((savings / originalPrice) * 100)
      : 0;

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  const activeCombos = combos.filter((combo) => combo.is_active);
  const inactiveCombos = combos.filter((combo) => !combo.is_active);

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

      setUploadingImage(true);
      setError("");

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const fileName = `combo-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}.${extension}`;

      const filePath = `combos/${restaurantId}/${fileName}`;

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

      if (!name.trim()) {
        setError("Combo name is required.");
        return;
      }

      if (selectedProducts.length === 0) {
        setError("Select at least one product.");
        return;
      }

      if (numericComboPrice <= 0) {
        setError("Combo price must be greater than 0.");
        return;
      }

      if (originalPrice <= 0) {
        setError("Original price must be greater than 0.");
        return;
      }

      if (numericComboPrice >= originalPrice) {
        setError(
          "Combo price should be lower than the original price."
        );
        return;
      }

      setSaving(true);

      if (editingCombo) {
        const { error: comboError } = await supabase
          .from("combos")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            image_url: imageUrl || null,
            combo_price: numericComboPrice,
            original_price: originalPrice,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingCombo.id)
          .eq("restaurant_id", restaurantId);

        if (comboError) {
          throw comboError;
        }

        const { error: deactivateError } = await supabase
          .from("combo_items")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("combo_id", editingCombo.id);

        if (deactivateError) {
          throw deactivateError;
        }

        const now = new Date().toISOString();

        const itemsToInsert = selectedProducts.map((item) => ({
          combo_id: editingCombo.id,
          product_id: item.product_id,
          quantity: item.quantity,
          is_active: true,
          created_at: now,
          updated_at: now,
        }));

        const { error: itemError } = await supabase
          .from("combo_items")
          .insert(itemsToInsert);

        if (itemError) {
          throw itemError;
        }

        setSuccess("Combo updated successfully.");
      } else {
        const now = new Date().toISOString();

        const { data: newCombo, error: comboError } =
          await supabase
            .from("combos")
            .insert({
              restaurant_id: restaurantId,
              name: name.trim(),
              description: description.trim() || null,
              image_url: imageUrl || null,
              combo_price: numericComboPrice,
              original_price: originalPrice,
              is_active: true,
              created_at: now,
              updated_at: now,
            })
            .select("id")
            .single();

        if (comboError) {
          throw comboError;
        }

        if (!newCombo) {
          throw new Error("Combo was created but ID was not returned.");
        }

        const itemsToInsert = selectedProducts.map((item) => ({
          combo_id: newCombo.id,
          product_id: item.product_id,
          quantity: item.quantity,
          is_active: true,
          created_at: now,
          updated_at: now,
        }));

        const { error: itemError } = await supabase
          .from("combo_items")
          .insert(itemsToInsert);

        if (itemError) {
          throw itemError;
        }

        setSuccess("Combo created successfully.");
      }

      setShowModal(false);
      resetForm();

      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save combo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleComboStatus(combo: Combo) {
    try {
      setError("");

      const { error } = await supabase
        .from("combos")
        .update({
          is_active: !combo.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", combo.id)
        .eq("restaurant_id", restaurantId);

      if (error) {
        throw error;
      }

      setCombos((current) =>
        current.map((item) =>
          item.id === combo.id
            ? {
                ...item,
                is_active: !item.is_active,
              }
            : item
        )
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to update combo status.");
    }
  }

  function getComboItems(combo: Combo) {
    return (
      combo.combo_items?.filter((item) => item.is_active) || []
    );
  }

  function getProductName(productId: number) {
    return (
      products.find((product) => product.id === productId)?.name ||
      "Unknown product"
    );
  }

  function formatPrice(value: number) {
    return `₹${Number(value).toFixed(2)}`;
  }

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
          Loading combos...
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
            Combos
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: "14px",
              color: "#737373",
            }}
          >
            Create product bundles and special combo offers
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
          + Create Combo
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
            Total Combos
          </div>

          <div
            style={{
              fontSize: "25px",
              fontWeight: 700,
              marginTop: "6px",
            }}
          >
            {combos.length}
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
            {activeCombos.length}
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
            {inactiveCombos.length}
          </div>
        </div>
      </div>

      {/* COMBOS */}

      {combos.length === 0 ? (
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
            No combos yet
          </div>

          <div
            style={{
              color: "#737373",
              fontSize: "14px",
              marginBottom: "18px",
            }}
          >
            Create your first combo by bundling products together.
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
            Create Combo
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "18px",
          }}
        >
          {combos.map((combo) => {
            const items = getComboItems(combo);

            const savingsAmount =
              Number(combo.original_price) -
              Number(combo.combo_price);

            const savingsPercent =
              Number(combo.original_price) > 0
                ? Math.round(
                    (savingsAmount /
                      Number(combo.original_price)) *
                      100
                  )
                : 0;

            return (
              <div
                key={combo.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e5e5",
                  borderRadius: "12px",
                  overflow: "hidden",
                  opacity: combo.is_active ? 1 : 0.65,
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
                  {combo.image_url ? (
                    <img
                      src={combo.image_url}
                      alt={combo.name}
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
                      background: combo.is_active
                        ? "#dcfce7"
                        : "#f5f5f5",
                      color: combo.is_active
                        ? "#15803d"
                        : "#737373",
                      borderRadius: "999px",
                      padding: "5px 9px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {combo.is_active ? "ACTIVE" : "INACTIVE"}
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
                      alignItems: "flex-start",
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
                        {combo.name}
                      </h3>

                      {combo.description && (
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: "13px",
                            color: "#737373",
                            lineHeight: 1.5,
                          }}
                        >
                          {combo.description}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "17px",
                          fontWeight: 700,
                        }}
                      >
                        {formatPrice(
                          Number(combo.combo_price)
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: "12px",
                          color: "#a3a3a3",
                          textDecoration: "line-through",
                        }}
                      >
                        {formatPrice(
                          Number(combo.original_price)
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ITEMS */}

                  <div
                    style={{
                      marginTop: "15px",
                      paddingTop: "13px",
                      borderTop: "1px solid #f0f0f0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#737373",
                        marginBottom: "7px",
                      }}
                    >
                      Includes
                    </div>

                    {items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px",
                          marginBottom: "5px",
                        }}
                      >
                        <span>
                          {getProductName(item.product_id)}
                        </span>

                        <span
                          style={{
                            color: "#737373",
                          }}
                        >
                          × {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* SAVINGS */}

                  {savingsAmount > 0 && (
                    <div
                      style={{
                        marginTop: "12px",
                        background: "#f0fdf4",
                        color: "#15803d",
                        padding: "8px 10px",
                        borderRadius: "7px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      Save {formatPrice(savingsAmount)} (
                      {savingsPercent}%)
                    </div>
                  )}

                  {/* ACTIONS */}

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginTop: "15px",
                    }}
                  >
                    <button
                      onClick={() => openEditModal(combo)}
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
                      onClick={() => toggleComboStatus(combo)}
                      style={{
                        flex: 1,
                        border: "1px solid #d4d4d4",
                        background: "#fff",
                        color: combo.is_active
                          ? "#b91c1c"
                          : "#15803d",
                        padding: "9px",
                        borderRadius: "7px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      {combo.is_active
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                  </div>
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
              maxWidth: "850px",
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
                  {editingCombo
                    ? "Edit Combo"
                    : "Create Combo"}
                </h2>

                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#737373",
                    fontSize: "13px",
                  }}
                >
                  Bundle products together and set a special
                  combo price.
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
              {/* MODAL ERROR */}

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

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "18px",
                }}
              >
                {/* LEFT */}

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "7px",
                    }}
                  >
                    Combo Name *
                  </label>

                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Example: Burger + Fries + Coke"
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
                    placeholder="Describe what's included..."
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

                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginTop: "17px",
                      marginBottom: "7px",
                    }}
                  >
                    Combo Price *
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={comboPrice}
                    onChange={(e) =>
                      setComboPrice(e.target.value)
                    }
                    placeholder="Enter combo price"
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

                  {/* PRICE SUMMARY */}

                  <div
                    style={{
                      marginTop: "18px",
                      background: "#fafafa",
                      border: "1px solid #e5e5e5",
                      borderRadius: "8px",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          color: "#737373",
                        }}
                      >
                        Original Price
                      </span>

                      <strong>
                        {formatPrice(originalPrice)}
                      </strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          color: "#737373",
                        }}
                      >
                        Combo Price
                      </span>

                      <strong>
                        {formatPrice(numericComboPrice)}
                      </strong>
                    </div>

                    <div
                      style={{
                        borderTop: "1px solid #e5e5e5",
                        paddingTop: "9px",
                        display: "flex",
                        justifyContent: "space-between",
                        color:
                          savings > 0
                            ? "#15803d"
                            : "#b91c1c",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      <span>
                        {savings > 0 ? "Customer Saves" : "Savings"}
                      </span>

                      <span>
                        {formatPrice(savings)}
                      </span>
                    </div>
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
                    Combo Image
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
                        marginTop: "10px",
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt="Combo preview"
                        style={{
                          width: "100%",
                          height: "140px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          border: "1px solid #e5e5e5",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* RIGHT — PRODUCTS */}

                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "7px",
                    }}
                  >
                    <label
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      Products *
                    </label>

                    <span
                      style={{
                        fontSize: "12px",
                        color: "#737373",
                      }}
                    >
                      {selectedProducts.length} selected
                    </span>
                  </div>

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products..."
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 11px",
                      border: "1px solid #d4d4d4",
                      borderRadius: "7px",
                      fontSize: "13px",
                      outline: "none",
                      marginBottom: "10px",
                    }}
                  />

                  <div
                    style={{
                      border: "1px solid #e5e5e5",
                      borderRadius: "8px",
                      maxHeight: "430px",
                      overflowY: "auto",
                    }}
                  >
                    {filteredProducts.length === 0 ? (
                      <div
                        style={{
                          padding: "25px",
                          textAlign: "center",
                          color: "#737373",
                          fontSize: "13px",
                        }}
                      >
                        No products found.
                      </div>
                    ) : (
                      filteredProducts.map((product) => {
                        const selected =
                          selectedProducts.find(
                            (item) =>
                              item.product_id === product.id
                          );

                        return (
                          <div
                            key={product.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "10px 11px",
                              borderBottom:
                                "1px solid #f0f0f0",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(selected)}
                              onChange={() =>
                                toggleProduct(product.id)
                              }
                              style={{
                                width: "16px",
                                height: "16px",
                                cursor: "pointer",
                              }}
                            />

                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  objectFit: "cover",
                                  borderRadius: "6px",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  background: "#f5f5f5",
                                  borderRadius: "6px",
                                }}
                              />
                            )}

                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {product.name}
                              </div>

                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#737373",
                                  marginTop: "3px",
                                }}
                              >
                                {formatPrice(
                                  Number(product.price)
                                )}
                              </div>
                            </div>

                            {selected && (
                              <input
                                type="number"
                                min="1"
                                value={selected.quantity}
                                onChange={(e) =>
                                  updateQuantity(
                                    product.id,
                                    Number(e.target.value)
                                  )
                                }
                                style={{
                                  width: "55px",
                                  padding: "7px",
                                  border:
                                    "1px solid #d4d4d4",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  textAlign: "center",
                                }}
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* SELECTED PRODUCTS */}

                  {selectedProducts.length > 0 && (
                    <div
                      style={{
                        marginTop: "14px",
                        padding: "12px",
                        background: "#fafafa",
                        border: "1px solid #e5e5e5",
                        borderRadius: "8px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          marginBottom: "8px",
                        }}
                      >
                        Selected Products
                      </div>

                      {selectedProducts.map((selected) => {
                        const product = products.find(
                          (item) =>
                            item.id === selected.product_id
                        );

                        if (!product) return null;

                        return (
                          <div
                            key={selected.product_id}
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              alignItems: "center",
                              fontSize: "12px",
                              marginBottom: "6px",
                            }}
                          >
                            <span>
                              {product.name} ×{" "}
                              {selected.quantity}
                            </span>

                            <strong>
                              {formatPrice(
                                Number(product.price) *
                                  selected.quantity
                              )}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

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
                    : editingCombo
                    ? "Update Combo"
                    : "Create Combo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}