"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/client";

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
  restaurant_id: number;
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

type Variant = {
  id: number;
  product_id: number;
  name: string;
  description: string | null;
  price: number;
  mrp: number | null;
  image_url: string | null;
  discount_percent: number | null;
  sort_order: number;
  is_available: boolean;
  is_active: boolean;
};

type ImportRow = {
  name: string;
  description: string;
  category: string;
  price: number;
  mrp: number | null;
  vegetarian: boolean;
  available: boolean;
  image: string;
  valid: boolean;
  error: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCategory(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatCurrency(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function MenuClient() {
  const [restaurantId, setRestaurantId] =
    useState<number | null>(null);

  const [categories, setCategories] = useState<Category[]>(
    []
  );

  const [products, setProducts] = useState<Product[]>([]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] =
    useState("ALL");

  const [loading, setLoading] = useState(true);

  const [showProductModal, setShowProductModal] =
    useState(false);

  const [showCategoryModal, setShowCategoryModal] =
    useState(false);

  const [showImportModal, setShowImportModal] =
    useState(false);

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [editingCategory, setEditingCategory] =
    useState<Category | null>(null);

  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [variants, setVariants] = useState<Variant[]>([]);

  const [error, setError] = useState("");

  // Menu write controls are enabled only after the server confirms permission.
  const [canManageMenu, setCanManageMenu] = useState(false);
  const [permissionLoaded, setPermissionLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMenuPermission() {
      try {
        const response = await fetch("/api/restaurant/me", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) setCanManageMenu(false);
          return;
        }

        const result = await response.json();
        const roleName = String(result?.role?.name || "").toUpperCase();
        const menuPermission = (result?.permissions || []).find(
          (permission: { module?: string; access?: string }) =>
            String(permission.module || "").toLowerCase() === "menu"
        );
        const access = String(menuPermission?.access || "NONE").toUpperCase();

        if (!cancelled) {
          setCanManageMenu(roleName === "OWNER" || access === "FULL");
        }
      } catch {
        if (!cancelled) setCanManageMenu(false);
      } finally {
        if (!cancelled) setPermissionLoaded(true);
      }
    }

    loadMenuPermission();
    return () => {
      cancelled = true;
    };
  }, []);

  async function getRestaurantId() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data } = await supabase
      .from("users")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .single();

    return data?.restaurant_id || null;
  }

  async function loadMenu(id?: number) {
    const supabase = createClient();

    const restaurant =
      id || restaurantId || (await getRestaurantId());

    if (!restaurant) {
      setError("Restaurant could not be found.");
      setLoading(false);
      return;
    }

    setRestaurantId(restaurant);

    const [
      categoriesResult,
      productsResult,
    ] = await Promise.all([
      supabase
        .from("categories")
        .select(
          "id, name, slug, description, image_url, sort_order, is_active"
        )
        .eq("restaurant_id", restaurant)
        .order("sort_order", {
          ascending: true,
        }),

      supabase
        .from("products")
        .select(
          "id, restaurant_id, category_id, name, slug, description, price, mrp, image_url, is_vegetarian, is_available, is_active"
        )
        .eq("restaurant_id", restaurant)
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (categoriesResult.error) {
      setError(categoriesResult.error.message);
    }

    if (productsResult.error) {
      setError(productsResult.error.message);
    }

    setCategories(categoriesResult.data || []);
    setProducts(productsResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadMenu();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const category =
        categories.find(
          (item) => item.id === product.category_id
        );

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.description
          ?.toLowerCase()
          .includes(query);

      const matchesCategory =
        categoryFilter === "ALL" ||
        product.category_id === Number(categoryFilter);

      const matchesAvailability =
        availabilityFilter === "ALL" ||
        (availabilityFilter === "AVAILABLE"
          ? product.is_available
          : !product.is_available);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesAvailability &&
        product.is_active
      );
    });
  }, [
    products,
    categories,
    search,
    categoryFilter,
    availabilityFilter,
  ]);

  
async function saveCategory(
  name: string,
  description: string
) {
  if (!restaurantId || !name.trim()) {
    return;
  }

  setError("");

  try {
    const isEditing = !!editingCategory;

    const response = await fetch(
      "/api/restaurant/menu/categories",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isEditing
            ? { categoryId: editingCategory.id }
            : {}),
          name: name.trim(),
          description: description.trim(),
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setError(
        result.error || "Failed to save category."
      );
      return;
    }

    setShowCategoryModal(false);
    setEditingCategory(null);
    setError("");

    await loadMenu(restaurantId);
  } catch (error) {
    console.error("Save category error:", error);
    setError("Something went wrong while saving the category.");
  }
}

  
async function saveProduct(product: {
  name: string;
  description: string;
  category_id: number;
  price: number;
  mrp: number | null;
  image_url: string;
  is_vegetarian: boolean;
  is_available: boolean;
}) {
  if (!restaurantId || !product.name.trim()) {
    return;
  }

  setError("");

  try {
    const isEditing = !!editingProduct;

    const response = await fetch(
      "/api/restaurant/menu/products",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isEditing
            ? { productId: editingProduct.id }
            : {}),
          name: product.name.trim(),
          description: product.description.trim(),
          category_id: product.category_id,
          price: product.price,
          mrp: product.mrp,
          image_url: product.image_url.trim(),
          is_vegetarian: product.is_vegetarian,
          is_available: product.is_available,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setError(
        result.error || "Failed to save product."
      );
      return;
    }

    setShowProductModal(false);
    setEditingProduct(null);
    setError("");

    await loadMenu(restaurantId);
  } catch (error) {
    console.error("Save product error:", error);
    setError("Something went wrong while saving the product.");
  }
}


  
async function toggleAvailability(product: Product) {
  if (!restaurantId || !canManageMenu) {
    return;
  }

  const nextAvailability = !product.is_available;

  try {
    const response = await fetch(
      `/api/restaurant/menu/products/${product.id}/availability`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_available: nextAvailability,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setError(
        result.error || "Failed to update availability."
      );
      return;
    }

    setProducts((current) =>
      current.map((item) =>
        item.id === product.id
          ? { ...item, is_available: nextAvailability }
          : item
      )
    );

    setError("");
  } catch (error) {
    console.error("Toggle availability error:", error);
    setError("Something went wrong updating availability.");
  }
}


  async function loadVariants(productId: number) {
    const supabase = createClient();

    const { data, error: variantError } =
      await supabase
        .from("product_variants")
        .select(
          "id, product_id, name, description, price, mrp, image_url, discount_percent, sort_order, is_available, is_active"
        )
        .eq("product_id", productId)
        .order("sort_order", {
          ascending: true,
        });

    if (variantError) {
      setError(variantError.message);
      return;
    }

    setVariants(data || []);
  }

 
async function deleteVariant(variantId: number) {
  try {
    const response = await fetch(
      `/api/restaurant/menu/variants/${variantId}`,
      { method: "DELETE" }
    );

    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Failed to delete variant.");
      return;
    }

    setVariants((current) =>
      current.filter((variant) => variant.id !== variantId)
    );

    setError("");
  } catch (error) {
    console.error("Delete variant error:", error);
    setError("Something went wrong deleting the variant.");
  }
}


  const categoryMap = useMemo(() => {
    return new Map(
      categories.map((category) => [
        category.id,
        category.name,
      ])
    );
  }, [categories]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: 700,
              color: "#202228",
              letterSpacing: "-0.4px",
            }}
          >
            Menu
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: "13px",
              color: "#858a94",
            }}
          >
            Manage categories, products and availability
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
          }}
        >
          {permissionLoaded && canManageMenu && (
          <button
            onClick={() => {
              setEditingCategory(null);
              setShowCategoryModal(true);
            }}
            style={{
              border: "1px solid #dfe2e7",
              background: "#ffffff",
              color: "#33363c",
              borderRadius: "8px",
              padding: "9px 13px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Category
          </button>
          )}

          {permissionLoaded && canManageMenu && (
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowProductModal(true);
            }}
            style={{
              border: "none",
              background: "#111111",
              color: "#ffffff",
              borderRadius: "8px",
              padding: "9px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Product
          </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fff5f5",
            border: "1px solid #ffdede",
            color: "#b42318",
            borderRadius: "10px",
            padding: "12px 14px",
            fontSize: "12px",
            marginBottom: "18px",
          }}
        >
          {error}
        </div>
      )}

      {/* CATEGORY BAR */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e7e9ed",
          borderRadius: "12px",
          padding: "12px",
          marginBottom: "18px",
          display: "flex",
          alignItems: "center",
          gap: "7px",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setCategoryFilter("ALL")}
          style={{
            border: "none",
            background:
              categoryFilter === "ALL"
                ? "#111111"
                : "#f3f4f6",
            color:
              categoryFilter === "ALL"
                ? "#ffffff"
                : "#555a63",
            borderRadius: "7px",
            padding: "8px 12px",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          All
        </button>

        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() =>
              setCategoryFilter(
                category.id.toString()
              )
            }
            style={{
              border: "none",
              background:
                categoryFilter ===
                category.id.toString()
                  ? "#111111"
                  : "#f3f4f6",
              color:
                categoryFilter ===
                category.id.toString()
                  ? "#ffffff"
                  : "#555a63",
              borderRadius: "7px",
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {category.name}
          </button>
        ))}

        {permissionLoaded && canManageMenu && (
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={() => setShowImportModal(true)}
            style={{
              border: "1px solid #dfe2e7",
              background: "#ffffff",
              color: "#555a63",
              borderRadius: "7px",
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Bulk Import
          </button>
        </div>
        )}
      </div>

      {/* FILTERS */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "18px",
        }}
      >
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search products..."
          style={{
            flex: 1,
            border: "1px solid #dfe2e7",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "12px",
            outline: "none",
            background: "#ffffff",
          }}
        />

        <select
          value={availabilityFilter}
          onChange={(event) =>
            setAvailabilityFilter(
              event.target.value
            )
          }
          style={{
            border: "1px solid #dfe2e7",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "12px",
            background: "#ffffff",
            color: "#555a63",
          }}
        >
          <option value="ALL">All Products</option>
          <option value="AVAILABLE">
            Available
          </option>
          <option value="UNAVAILABLE">
            Unavailable
          </option>
        </select>
      </div>

      {/* PRODUCTS */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e7e9ed",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid #eef0f2",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 650,
              color: "#202228",
            }}
          >
            Products
          </div>

          <div
            style={{
              fontSize: "11px",
              color: "#858a94",
            }}
          >
            {filteredProducts.length} products
          </div>
        </div>

        {loading ? (
          <div
            style={{
              padding: "50px",
              textAlign: "center",
              fontSize: "12px",
              color: "#858a94",
            }}
          >
            Loading menu...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#30333a",
              }}
            >
              No products found
            </div>

            <div
              style={{
                marginTop: "5px",
                fontSize: "12px",
                color: "#858a94",
              }}
            >
              Add a product or change your filters.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: "800px",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Product",
                    "Category",
                    "Price",
                    "Type",
                    "Availability",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "11px 18px",
                        textAlign: "left",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#9a9da4",
                        textTransform:
                          "uppercase",
                        letterSpacing:
                          "0.06em",
                        background: "#fafafa",
                        borderBottom:
                          "1px solid #eef0f2",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map(
                  (product) => (
                    <tr key={product.id}>
                      <td
                        style={{
                          padding:
                            "14px 18px",
                          borderBottom:
                            "1px solid #f0f1f3",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems:
                              "center",
                            gap: "11px",
                          }}
                        >
                          <div
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius:
                                "8px",
                              background:
                                "#f1f2f4",
                              overflow:
                                "hidden",
                              flexShrink: 0,
                            }}
                          >
                            {product.image_url ? (
                              <img
                                src={
                                  product.image_url
                                }
                                alt={
                                  product.name
                                }
                                style={{
                                  width:
                                    "100%",
                                  height:
                                    "100%",
                                  objectFit:
                                    "cover",
                                }}
                              />
                            ) : null}
                          </div>

                          <div>
                            <div
                              style={{
                                fontSize:
                                  "12px",
                                fontWeight:
                                  600,
                                color:
                                  "#30333a",
                              }}
                            >
                              {
                                product.name
                              }
                            </div>

                            {product.description && (
                              <div
                                style={{
                                  marginTop:
                                    "3px",
                                  maxWidth:
                                    "280px",
                                  overflow:
                                    "hidden",
                                  textOverflow:
                                    "ellipsis",
                                  whiteSpace:
                                    "nowrap",
                                  fontSize:
                                    "10px",
                                  color:
                                    "#858a94",
                                }}
                              >
                                {
                                  product.description
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td
                        style={{
                          padding:
                            "14px 18px",
                          fontSize: "11px",
                          color: "#555a63",
                          borderBottom:
                            "1px solid #f0f1f3",
                        }}
                      >
                        {categoryMap.get(
                          product.category_id
                        ) || "Unknown"}
                      </td>

                      <td
                        style={{
                          padding:
                            "14px 18px",
                          fontSize: "12px",
                          fontWeight: 650,
                          color: "#202228",
                          borderBottom:
                            "1px solid #f0f1f3",
                        }}
                      >
                        {formatCurrency(
                          Number(
                            product.price
                          )
                        )}
                      </td>

                      <td
                        style={{
                          padding:
                            "14px 18px",
                          borderBottom:
                            "1px solid #f0f1f3",
                        }}
                      >
                        <span
                          style={{
                            display:
                              "inline-flex",
                            padding:
                              "4px 8px",
                            borderRadius:
                              "999px",
                            background:
                              product.is_vegetarian
                                ? "#ecfdf3"
                                : "#f3f4f6",
                            color:
                              product.is_vegetarian
                                ? "#15803d"
                                : "#666b74",
                            fontSize:
                              "10px",
                            fontWeight:
                              600,
                          }}
                        >
                          {product.is_vegetarian
                            ? "Vegetarian"
                            : "Non-veg"}
                        </span>
                      </td>

                      <td
                        style={{
                          padding:
                            "14px 18px",
                          borderBottom:
                            "1px solid #f0f1f3",
                        }}
                      >
                        {canManageMenu ? (
                        <button
                          onClick={() =>
                            toggleAvailability(product)
                          }
                          style={{
                            border: "none",
                            background:
                              product.is_available
                                ? "#ecfdf3"
                                : "#f3f4f6",
                            color:
                              product.is_available
                                ? "#15803d"
                                : "#6b7280",
                            borderRadius:
                              "999px",
                            padding:
                              "5px 9px",
                            fontSize:
                              "10px",
                            fontWeight:
                              650,
                            cursor:
                              "pointer",
                          }}
                        >
                          {product.is_available
                            ? "Available"
                            : "Unavailable"}
                        </button>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              borderRadius: "999px",
                              padding: "5px 9px",
                              fontSize: "10px",
                              fontWeight: 650,
                              background: product.is_available ? "#ecfdf3" : "#f3f4f6",
                              color: product.is_available ? "#15803d" : "#6b7280",
                            }}
                          >
                            {product.is_available ? "Available" : "Unavailable"}
                          </span>
                        )}
                      </td>

                      <td
                        style={{
                          padding:
                            "14px 18px",
                          borderBottom:
                            "1px solid #f0f1f3",
                        }}
                      >
                        {canManageMenu ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "7px",
                          }}
                        >
                          <button
                            onClick={() => {
                              setEditingProduct(
                                product
                              );
                              setShowProductModal(
                                true
                              );
                            }}
                            style={{
                              border:
                                "1px solid #dfe2e7",
                              background:
                                "#ffffff",
                              color:
                                "#44474e",
                              borderRadius:
                                "7px",
                              padding:
                                "7px 10px",
                              fontSize:
                                "10px",
                              fontWeight:
                                600,
                              cursor:
                                "pointer",
                            }}
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => {
                              setSelectedProduct(
                                product
                              );
                              loadVariants(
                                product.id
                              );
                            }}
                            style={{
                              border:
                                "1px solid #dfe2e7",
                              background:
                                "#ffffff",
                              color:
                                "#44474e",
                              borderRadius:
                                "7px",
                              padding:
                                "7px 10px",
                              fontSize:
                                "10px",
                              fontWeight:
                                600,
                              cursor:
                                "pointer",
                            }}
                          >
                            Variants
                          </button>
                        </div>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#9a9da4" }}>View only</span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CATEGORY MODAL */}
      {canManageMenu && showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
          }}
          onSave={saveCategory}
        />
      )}

      {/* PRODUCT MODAL */}
      {canManageMenu && showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
          onSave={saveProduct}
        />
      )}

      {/* VARIANTS MODAL */}
      {canManageMenu && selectedProduct && (
        <VariantsModal
          product={selectedProduct}
          variants={variants}
          restaurantId={restaurantId}
          onClose={() => {
            setSelectedProduct(null);
            setVariants([]);
          }}
          onDelete={deleteVariant}
          onReload={() =>
            loadVariants(selectedProduct.id)
          }
        />
      )}

      {/* BULK IMPORT */}
      {canManageMenu && showImportModal && (
        <BulkImportModal
          categories={categories}
          restaurantId={restaurantId}
          existingProducts={products}
          onClose={() =>
            setShowImportModal(false)
          }
          onComplete={async () => {
            setShowImportModal(false);
            await loadMenu(restaurantId || undefined);
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   CATEGORY MODAL
============================================================ */

function CategoryModal({
  category,
  onClose,
  onSave,
}: {
  category: Category | null;
  onClose: () => void;
  onSave: (
    name: string,
    description: string
  ) => Promise<void>;
}) {
  const [name, setName] = useState(
    category?.name || ""
  );

  const [description, setDescription] =
    useState(category?.description || "");

  return (
    <Modal onClose={onClose}>
      <ModalHeader
        title={
          category
            ? "Edit Category"
            : "Add Category"
        }
        onClose={onClose}
      />

      <div style={{ padding: "22px" }}>
        <Field label="Category name">
          <input
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="e.g. Main Course"
            style={inputStyle}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Optional description"
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical",
            }}
          />
        </Field>

        <ModalActions
          onClose={onClose}
          onSave={() =>
            onSave(name, description)
          }
          saveText={
            category
              ? "Save Changes"
              : "Add Category"
          }
        />
      </div>
    </Modal>
  );
}

/* ============================================================
   PRODUCT MODAL
============================================================ */

function ProductModal({
  product,
  categories,
  onClose,
  onSave,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: (product: {
    name: string;
    description: string;
    category_id: number;
    price: number;
    mrp: number | null;
    image_url: string;
    is_vegetarian: boolean;
    is_available: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(
    product?.name || ""
  );

  const [description, setDescription] =
    useState(product?.description || "");

  const [categoryId, setCategoryId] =
    useState(
      product?.category_id?.toString() ||
        categories[0]?.id?.toString() ||
        ""
    );

  const [price, setPrice] = useState(
    product?.price?.toString() || ""
  );

  const [mrp, setMrp] = useState(
    product?.mrp?.toString() || ""
  );

  const [imageUrl, setImageUrl] =
    useState(product?.image_url || "");

  const [foodType, setFoodType] = useState<
    "VEG" | "NON_VEG"
  >(
    product?.is_vegetarian
      ? "VEG"
      : "NON_VEG"
  );

  const [available, setAvailable] =
    useState(product?.is_available ?? true);

  const [uploading, setUploading] =
    useState(false);

  const [uploadError, setUploadError] =
    useState("");

  
async function handleImageUpload(file: File) {
  setUploading(true);
  setUploadError("");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      "/api/restaurant/menu/products/image/upload",
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Image upload failed."
      );
    }

    setImageUrl(result.image_url);
  } catch (error) {
    console.error("Product image upload failed:", error);

    setUploadError(
      error instanceof Error
        ? error.message
        : "Image upload failed."
    );
  } finally {
    setUploading(false);
  }
}


  async function handleSave() {
    if (
      !name.trim() ||
      !categoryId ||
      !price
    ) {
      return;
    }

    await onSave({
      name,
      description,
      category_id: Number(categoryId),
      price: Number(price),
      mrp: mrp ? Number(mrp) : null,
      image_url: imageUrl,
      is_vegetarian:
        foodType === "VEG",
      is_available: available,
    });
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader
        title={
          product
            ? "Edit Product"
            : "Add Product"
        }
        onClose={onClose}
      />

      <div
        style={{
          padding: "22px",
          display: "grid",
          gap: "15px",
        }}
      >
        {/* PRODUCT NAME */}
        <Field label="Product name">
          <input
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="Chicken Biryani"
            style={inputStyle}
          />
        </Field>

        {/* CATEGORY */}
        <Field label="Category">
          <select
            value={categoryId}
            onChange={(event) =>
              setCategoryId(
                event.target.value
              )
            }
            style={inputStyle}
          >
            <option value="">
              Select category
            </option>

            {categories.map((category) => (
              <option
                key={category.id}
                value={category.id}
              >
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        {/* DESCRIPTION */}
        <Field label="Description">
          <textarea
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value
              )
            }
            rows={3}
            placeholder="Product description"
            style={{
              ...inputStyle,
              resize: "vertical",
            }}
          />
        </Field>

        {/* PRICE */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "12px",
          }}
        >
          <Field label="Price">
            <input
              type="number"
              value={price}
              onChange={(event) =>
                setPrice(event.target.value)
              }
              placeholder="280"
              style={inputStyle}
            />
          </Field>

          <Field label="MRP">
            <input
              type="number"
              value={mrp}
              onChange={(event) =>
                setMrp(event.target.value)
              }
              placeholder="320"
              style={inputStyle}
            />
          </Field>
        </div>

        {/* IMAGE UPLOAD */}
        <Field label="Product image">
          <div
            style={{
              border: "1px solid #dfe2e7",
              borderRadius: "10px",
              padding: "12px",
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
                  width: "70px",
                  height: "70px",
                  borderRadius: "9px",
                  background: "#f3f4f6",
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name || "Product"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#9a9da4",
                    }}
                  >
                    No image
                  </span>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border:
                      "1px solid #dfe2e7",
                    background: "#ffffff",
                    color: "#44474e",
                    borderRadius: "7px",
                    padding: "8px 12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: uploading
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {uploading
                    ? "Uploading..."
                    : imageUrl
                    ? "Change Image"
                    : "Upload Image"}

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(event) => {
                      const selectedFile =
                        event.target.files?.[0];

                      if (selectedFile) {
                        handleImageUpload(
                          selectedFile
                        );
                      }

                      event.target.value = "";
                    }}
                    style={{
                      display: "none",
                    }}
                  />
                </label>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "10px",
                    color: "#858a94",
                  }}
                >
                  JPG, PNG or WEBP
                </div>
              </div>
            </div>

            {uploadError && (
              <div
                style={{
                  marginTop: "9px",
                  fontSize: "10px",
                  color: "#b42318",
                }}
              >
                {uploadError}
              </div>
            )}
          </div>
        </Field>

        {/* FOOD TYPE */}
        <Field label="Food type">
          <div
            style={{
              display: "flex",
              gap: "10px",
            }}
          >
            {/* VEG */}
            <button
              type="button"
              onClick={() =>
                setFoodType("VEG")
              }
              style={{
                flex: 1,
                border:
                  foodType === "VEG"
                    ? "1px solid #16a34a"
                    : "1px solid #dfe2e7",
                background:
                  foodType === "VEG"
                    ? "#f0fdf4"
                    : "#ffffff",
                color:
                  foodType === "VEG"
                    ? "#15803d"
                    : "#555a63",
                borderRadius: "8px",
                padding: "10px",
                fontSize: "11px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  display:
                    "inline-block",
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: "#16a34a",
                  marginRight: "7px",
                }}
              />

              Vegetarian
            </button>

            {/* NON VEG */}
            <button
              type="button"
              onClick={() =>
                setFoodType("NON_VEG")
              }
              style={{
                flex: 1,
                border:
                  foodType === "NON_VEG"
                    ? "1px solid #dc2626"
                    : "1px solid #dfe2e7",
                background:
                  foodType === "NON_VEG"
                    ? "#fef2f2"
                    : "#ffffff",
                color:
                  foodType === "NON_VEG"
                    ? "#b91c1c"
                    : "#555a63",
                borderRadius: "8px",
                padding: "10px",
                fontSize: "11px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  display:
                    "inline-block",
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: "#dc2626",
                  marginRight: "7px",
                }}
              />

              Non-Vegetarian
            </button>
          </div>
        </Field>

        {/* AVAILABILITY */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "#555a63",
          }}
        >
          <input
            type="checkbox"
            checked={available}
            onChange={(event) =>
              setAvailable(
                event.target.checked
              )
            }
          />

          Available for ordering
        </label>

        {/* ACTIONS */}
        <ModalActions
          onClose={onClose}
          onSave={handleSave}
          saveText={
            product
              ? "Save Changes"
              : "Add Product"
          }
        />
      </div>
    </Modal>
  );
}
/* ============================================================
   VARIANTS MODAL
============================================================ */

function VariantsModal({
  product,
  variants,
  restaurantId,
  onClose,
  onDelete,
  onReload,
}: {
  product: Product;
  variants: Variant[];
  restaurantId: number | null;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [showAdd, setShowAdd] =
    useState(false);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");

  
async function addVariant() {
  if (!restaurantId || !name.trim() || !price) {
    return;
  }

  const parsedPrice = Number(price);
  const parsedMrp = mrp.trim() ? Number(mrp) : null;

  if (
    !Number.isFinite(parsedPrice) ||
    parsedPrice < 0 ||
    (parsedMrp !== null &&
      (!Number.isFinite(parsedMrp) || parsedMrp < 0))
  ) {
    return;
  }

  try {
    const response = await fetch(
      "/api/restaurant/menu/variants",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: product.id,
          name: name.trim(),
          price: parsedPrice,
          mrp: parsedMrp,
        }),
      }
    );

    const result = await response.json();

   if (!response.ok) {
  console.error("Add variant failed:", {
    status: response.status,
    error: result.error,
    details: result,
  });

  alert(result.error || "Failed to add variant.");
  return;
}

    setName("");
    setPrice("");
    setMrp("");
    setShowAdd(false);

    await onReload();
  } catch (error) {
    console.error("Add variant error:", error);
  }
}


  return (
    <Modal onClose={onClose}>
      <ModalHeader
        title={`${product.name} — Variants`}
        onClose={onClose}
      />

      <div style={{ padding: "22px" }}>
        <button
          onClick={() =>
            setShowAdd(!showAdd)
          }
          style={{
            border: "none",
            background: "#111111",
            color: "#ffffff",
            borderRadius: "8px",
            padding: "9px 13px",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "15px",
          }}
        >
          + Add Variant
        </button>

        {showAdd && (
          <div
            style={{
              border: "1px solid #e7e9ed",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 120px 120px",
                gap: "8px",
              }}
            >
              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Variant name"
                style={inputStyle}
              />

              <input
                type="number"
                value={price}
                onChange={(event) =>
                  setPrice(event.target.value)
                }
                placeholder="Price"
                style={inputStyle}
              />

              <input
                type="number"
                value={mrp}
                onChange={(event) =>
                  setMrp(event.target.value)
                }
                placeholder="MRP"
                style={inputStyle}
              />
            </div>

            <button
              onClick={addVariant}
              style={{
                marginTop: "10px",
                border: "none",
                background: "#111111",
                color: "#ffffff",
                borderRadius: "7px",
                padding: "8px 12px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add Variant
            </button>
          </div>
        )}

        {variants.length === 0 ? (
          <div
            style={{
              padding: "30px",
              textAlign: "center",
              color: "#858a94",
              fontSize: "12px",
            }}
          >
            No variants added.
          </div>
        ) : (
          <div>
            {variants.map((variant) => (
              <div
                key={variant.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  padding: "13px 0",
                  borderBottom:
                    "1px solid #eef0f2",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#30333a",
                    }}
                  >
                    {variant.name}
                  </div>

                  <div
                    style={{
                      marginTop: "3px",
                      fontSize: "11px",
                      color: "#858a94",
                    }}
                  >
                    {formatCurrency(
                      Number(variant.price)
                    )}
                  </div>
                </div>

                <button
                  onClick={() =>
                    onDelete(variant.id)
                  }
                  style={{
                    border:
                      "1px solid #ffdede",
                    background: "#fff5f5",
                    color: "#b42318",
                    borderRadius: "7px",
                    padding: "6px 9px",
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ============================================================
   BULK IMPORT
============================================================ */

function BulkImportModal({
  categories,
  restaurantId,
  existingProducts,
  onClose,
  onComplete,
}: {
  categories: Category[];
  restaurantId: number | null;
  existingProducts: Product[];
  onClose: () => void;
  onComplete: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [imageZip, setImageZip] = useState<File | null>(null);

  const [rows, setRows] = useState<ImportRow[]>([]);

  const [mode, setMode] = useState<
    "PRODUCTS" | "IMAGES"
  >("PRODUCTS");

  const [imageRows, setImageRows] = useState<
    {
      fileName: string;
      matchedProduct: Product | null;
    }[]
  >([]);

  const [step, setStep] = useState<
    | "UPLOAD"
    | "REVIEW"
    | "IMAGE_REVIEW"
    | "ADDING"
    | "DONE"
  >("UPLOAD");

  const [duplicateAction, setDuplicateAction] =
    useState<"SKIP" | "CREATE">("SKIP");

  const [message, setMessage] = useState("");

  /* ============================================================
     IMAGE ONLY — REVIEW ZIP
  ============================================================ */

  async function reviewImagesOnly(selectedFile: File) {
    setImageZip(selectedFile);
    setMessage("");

    try {
      const zip = await JSZip.loadAsync(
        await selectedFile.arrayBuffer()
      );

      const imageFiles = Object.values(zip.files).filter(
        (zipFile) =>
          !zipFile.dir &&
          /\.(jpg|jpeg|png|webp)$/i.test(
            zipFile.name
          )
      );

      if (imageFiles.length === 0) {
        setMessage(
          "No JPG, JPEG, PNG or WEBP images were found in the ZIP."
        );
        return;
      }

      const review = imageFiles.map((zipFile) => {
        const fileName =
          zipFile.name
            .split("/")
            .pop()
            ?.trim() || "";

        const withoutExtension = fileName.replace(
          /\.[^/.]+$/,
          ""
        );

        const normalizedFile = slugify(
          withoutExtension
        );

        const matchedProduct =
          existingProducts.find(
            (product) =>
              product.is_active &&
              slugify(product.name) ===
                normalizedFile
          ) || null;

        return {
          fileName,
          matchedProduct,
        };
      });

      setImageRows(review);
      setStep("IMAGE_REVIEW");
    } catch (error) {
      console.error(
        "Image ZIP review failed:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not read the image ZIP."
      );
    }
  }

  /* ============================================================
     IMAGE ONLY — UPLOAD
  ============================================================ */

 
async function uploadImagesOnly() {
  if (!restaurantId || !imageZip) {
    setMessage("Restaurant or image ZIP is missing.");
    return;
  }

  const matchedRows = imageRows.filter(
    (row) => row.matchedProduct !== null
  );

  if (matchedRows.length === 0) {
    setMessage("No images could be matched to existing products.");
    return;
  }

  setStep("ADDING");
  setMessage("");

  try {
    const zip = await JSZip.loadAsync(
      await imageZip.arrayBuffer()
    );

    let uploaded = 0;
    let failed = 0;

    for (const row of matchedRows) {
      const product = row.matchedProduct;

      if (!product) continue;

      const zipFile = Object.values(zip.files).find((item) => {
        const name = item.name.split("/").pop()?.trim() || "";
        return !item.dir && name === row.fileName;
      });

      if (!zipFile) {
        failed++;
        continue;
      }

      const imageBlob = await zipFile.async("blob");
      const extension =
        row.fileName.split(".").pop()?.toLowerCase() || "";

      const mimeType =
        extension === "jpg" || extension === "jpeg"
          ? "image/jpeg"
          : extension === "png"
            ? "image/png"
            : extension === "webp"
              ? "image/webp"
              : "";

      if (!mimeType) {
        failed++;
        continue;
      }

      const formData = new FormData();

      formData.append(
        "file",
        new File([imageBlob], row.fileName, {
          type: mimeType,
        })
      );

      // Upload through the authenticated server endpoint.
      const uploadResponse = await fetch(
        `/api/restaurant/menu/products/${product.id}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        console.error(
          `Upload failed for ${product.name}:`,
          uploadResult.error
        );
        failed++;
        continue;
      }

      // Save the URL through the existing protected update endpoint.
      const updateResponse = await fetch(
        `/api/restaurant/menu/products/${product.id}/image`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: uploadResult.image_url,
          }),
        }
      );

      const updateResult = await updateResponse.json();

      if (!updateResponse.ok) {
        console.error(
          `Image URL update failed for ${product.name}:`,
          updateResult.error
        );
        failed++;
        continue;
      }

      uploaded++;
    }

    if (uploaded === 0) {
      setMessage(
        failed > 0
          ? `No images uploaded successfully. ${failed} failed.`
          : "No images were uploaded."
      );
      setStep("IMAGE_REVIEW");
      return;
    }

    setMessage(
      `${uploaded} image${uploaded === 1 ? "" : "s"} uploaded successfully.` +
        (failed > 0 ? ` ${failed} failed.` : "")
    );

    setStep("DONE");
    await onComplete();
  } catch (error) {
    console.error("Image upload failed:", error);

    setMessage(
      error instanceof Error
        ? error.message
        : "Image upload failed."
    );

    setStep("IMAGE_REVIEW");
  }
}


  /* ============================================================
     TEMPLATE
  ============================================================ */

  function downloadTemplate() {
    const templateData = [
      {
        name: "Chicken Biryani",
        description:
          "Chicken biryani with basmati rice",
        category: "Main Course",
        price: 280,
        mrp: 320,
        vegetarian: false,
        available: true,
        image: "chicken-biryani.jpg",
      },
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(
        templateData
      );

    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 42 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 28 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Products"
    );

    XLSX.writeFile(
      workbook,
      "menu-import-template.xlsx"
    );
  }

  /* ============================================================
     PARSE CSV / XLSX
  ============================================================ */

  async function parseImportFile(
    selectedFile: File
  ) {
    const buffer =
      await selectedFile.arrayBuffer();

    const workbook = XLSX.read(
      buffer,
      {
        type: "array",
      }
    );

    const sheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];

    const data =
      XLSX.utils.sheet_to_json<
        Record<string, unknown>
      >(sheet, {
        defval: "",
      });

    const existingNames =
      new Set(
        existingProducts.map(
          (product) =>
            product.name
              .trim()
              .toLowerCase()
        )
      );

    const parsed: ImportRow[] =
      data.map((row) => {
        const name = String(
          row.name ||
            row.Name ||
            row.product ||
            row.Product ||
            ""
        ).trim();

        const description =
          String(
            row.description ||
              row.Description ||
              ""
          ).trim();

        const rawCategory =
          row.category ||
          row.Category ||
          row["Category Name"] ||
          row["category name"] ||
          "";

        const category =
          String(rawCategory)
            .normalize("NFKC")
            .replace(
              /\u00A0/g,
              " "
            )
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        const price = Number(
          row.price ||
            row.Price ||
            0
        );

        const rawMrp =
          row.mrp ||
          row.MRP ||
          "";

        const mrp = rawMrp
          ? Number(rawMrp)
          : null;

        const rawVegetarian =
          String(
            row.vegetarian ||
              row.Vegetarian ||
              row.is_vegetarian ||
              ""
          ).toLowerCase();

        const vegetarian =
          rawVegetarian === "true" ||
          rawVegetarian === "yes" ||
          rawVegetarian === "1";

        const rawAvailable =
          String(
            row.available ||
              row.Available ||
              row.is_available ||
              "true"
          ).toLowerCase();

        const available =
          !(
            rawAvailable ===
              "false" ||
            rawAvailable ===
              "no" ||
            rawAvailable === "0"
          );

        const image = String(
          row.image ||
            row.image_url ||
            row.Image ||
            ""
        ).trim();

        let error = "";

        if (!name) {
          error =
            "Product name is required.";
        } else if (!category) {
          error =
            "Category is required.";
        } else if (
          !price ||
          price <= 0
        ) {
          error =
            "Valid price is required.";
        } else if (
          duplicateAction ===
            "SKIP" &&
          existingNames.has(
            name.toLowerCase()
          )
        ) {
          error =
            "Product already exists.";
        }

        return {
          name,
          description,
          category,
          price,
          mrp,
          vegetarian,
          available,
          image,
          valid: !error,
          error,
        };
      });

    setRows(parsed);
    setStep("REVIEW");
  }

  async function handleReview() {
    if (!file) {
      setMessage(
        "Select a CSV or XLSX file first."
      );
      return;
    }

    setMessage("");

    await parseImportFile(file);
  }

  /* ============================================================
     ADD PRODUCTS TO MENU
  ============================================================ */

  
async function addToMenu() {
  if (!restaurantId) {
    setMessage("Restaurant could not be found.");
    return;
  }

  

  const validRows = rows.filter((row) => row.valid);

  if (validRows.length === 0) {
    setMessage("There are no valid products to add.");
    return;
  }

  setStep("ADDING");
  setMessage("");

  try {
    const imageMap = new Map<string, string>();

    // Preserve the existing optional ZIP image-upload workflow.
    if (imageZip) {
      const zip = await JSZip.loadAsync(
        await imageZip.arrayBuffer()
      );

      const imageFiles = Object.values(zip.files).filter(
        (zipFile) =>
          !zipFile.dir &&
          /\.(jpg|jpeg|png|webp)$/i.test(zipFile.name)
      );


      for (const imageFile of imageFiles) {
        const originalName =
          imageFile.name.split("/").pop()?.trim() || "";

        const extension =
          originalName.split(".").pop()?.toLowerCase() || "jpg";

        const storagePath =
  `restaurants/${restaurantId}/products/${crypto.randomUUID()}.${extension}`;

        const imageBlob = await imageFile.async("blob");

        const contentType =
          extension === "jpg" || extension === "jpeg"
            ? "image/jpeg"
            : extension === "png"
              ? "image/png"
              : "image/webp";

        
const formData = new FormData();

formData.append(
  "file",
  new File([imageBlob], originalName, {
    type: contentType,
  })
);

const response = await fetch(
  "/api/restaurant/menu/bulk-import/images",
  {
    method: "POST",
    body: formData,
  }
);

const result = await response.json();

if (!response.ok) {
  throw new Error(
    result.error || `Failed to upload ${originalName}`
  );
}

imageMap.set(
  originalName.toLowerCase(),
  result.image_url
);
      }
    }

    const products = validRows.map((row) => {
      const imageFileName = row.image
        .split("/")
        .pop()
        ?.trim()
        .toLowerCase() || "";

      return {
        name: row.name,
        description: row.description,
        category: row.category,
        price: row.price,
        mrp: row.mrp,
        vegetarian: row.vegetarian,
        available: row.available,
        imageUrl: imageZip
          ? imageMap.get(imageFileName) ?? null
          : null,
      };
    });

    const response = await fetch(
      "/api/restaurant/menu/bulk-import",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ products }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Bulk import failed.");
    }

    setMessage(
      `${result.count} product${result.count === 1 ? "" : "s"} imported successfully.`
    );

    setStep("DONE");
    await onComplete();
  } catch (error) {
    console.error("Bulk import failed:", error);

    setMessage(
      error instanceof Error
        ? error.message
        : "Bulk import failed."
    );

    setStep("REVIEW");
  }
}


  const validCount =
    rows.filter(
      (row) => row.valid
    ).length;

  const invalidCount =
    rows.length -
    validCount;

  const matchedImageCount =
    imageRows.filter(
      (row) =>
        row.matchedProduct !== null
    ).length;

  const unmatchedImageCount =
    imageRows.length -
    matchedImageCount;

  return (
    <Modal
      onClose={onClose}
      wide
    >
      <ModalHeader
        title="Bulk Import"
        onClose={onClose}
      />

      {/* ========================================================
          MODE SWITCH
      ======================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: "10px",
          padding:
            "18px 22px 0",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setMode("PRODUCTS");
            setStep("UPLOAD");
            setMessage("");
          }}
          style={{
            border:
              mode === "PRODUCTS"
                ? "1px solid #111111"
                : "1px solid #e7e9ed",
            background:
              mode === "PRODUCTS"
                ? "#111111"
                : "#ffffff",
            color:
              mode === "PRODUCTS"
                ? "#ffffff"
                : "#555a63",
            borderRadius: "9px",
            padding: "12px",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            Import Products
          </div>

          <div
            style={{
              marginTop: "4px",
              fontSize: "10px",
              opacity: 0.75,
            }}
          >
            CSV / XLSX
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("IMAGES");
            setStep("UPLOAD");
            setMessage("");
          }}
          style={{
            border:
              mode === "IMAGES"
                ? "1px solid #111111"
                : "1px solid #e7e9ed",
            background:
              mode === "IMAGES"
                ? "#111111"
                : "#ffffff",
            color:
              mode === "IMAGES"
                ? "#ffffff"
                : "#555a63",
            borderRadius: "9px",
            padding: "12px",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            Bulk Upload Images
          </div>

          <div
            style={{
              marginTop: "4px",
              fontSize: "10px",
              opacity: 0.75,
            }}
          >
            ZIP existing product images
          </div>
        </button>
      </div>

      <div
        style={{
          padding: "22px",
        }}
      >
        {/* ======================================================
            IMAGE MODE — UPLOAD
        ====================================================== */}

        {mode === "IMAGES" &&
          step === "UPLOAD" && (
            <div>
              <div
                style={{
                  background:
                    "#fafafa",
                  border:
                    "1px solid #e7e9ed",
                  borderRadius: "10px",
                  padding: "18px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 650,
                    color:
                      "#30333a",
                  }}
                >
                  Bulk Upload Images
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    color:
                      "#858a94",
                    lineHeight: 1.5,
                  }}
                >
                  Upload a ZIP containing
                  images for products
                  that already exist
                  in your menu.
                </div>

                <label
                  style={{
                    display:
                      "inline-flex",
                    marginTop:
                      "15px",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    border:
                      "1px solid #dfe2e7",
                    background:
                      "#ffffff",
                    color:
                      "#44474e",
                    borderRadius:
                      "7px",
                    padding:
                      "9px 13px",
                    fontSize:
                      "11px",
                    fontWeight:
                      600,
                    cursor:
                      "pointer",
                  }}
                >
                  Choose ZIP

                  <input
                    type="file"
                    accept=".zip"
                    onChange={(
                      event
                    ) => {
                      const selectedFile =
                        event
                          .target
                          .files?.[0];

                      if (
                        selectedFile
                      ) {
                        reviewImagesOnly(
                          selectedFile
                        );
                      }

                      event.target.value =
                        "";
                    }}
                    style={{
                      display:
                        "none",
                    }}
                  />
                </label>

                <div
                  style={{
                    marginTop:
                      "12px",
                    fontSize:
                      "10px",
                    color:
                      "#858a94",
                    lineHeight: 1.5,
                  }}
                >
                  Image filenames must
                  match product names.
                  <br />
                  Example:
                  <strong>
                    {" "}
                    chicken-biryani.jpg
                  </strong>
                  {" → "}
                  <strong>
                    Chicken Biryani
                  </strong>
                </div>
              </div>
            </div>
          )}

        {/* ======================================================
            IMAGE MODE — REVIEW
        ====================================================== */}

        {mode === "IMAGES" &&
          step ===
            "IMAGE_REVIEW" && (
            <div>
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  marginBottom:
                    "15px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize:
                        "14px",
                      fontWeight:
                        700,
                      color:
                        "#202228",
                    }}
                  >
                    Review Images
                  </div>

                  <div
                    style={{
                      marginTop:
                        "4px",
                      fontSize:
                        "11px",
                      color:
                        "#858a94",
                    }}
                  >
                    Check the image
                    matches before
                    uploading.
                  </div>
                </div>

                <div
                  style={{
                    fontSize:
                      "11px",
                    color:
                      "#555a63",
                  }}
                >
                  {
                    imageRows.length
                  }{" "}
                  images
                </div>
              </div>

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "10px",
                  marginBottom:
                    "15px",
                }}
              >
                <div
                  style={{
                    background:
                      "#ecfdf3",
                    border:
                      "1px solid #d1fae5",
                    borderRadius:
                      "9px",
                    padding:
                      "13px",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "10px",
                      color:
                        "#15803d",
                    }}
                  >
                    Matched
                  </div>

                  <div
                    style={{
                      marginTop:
                        "3px",
                      fontSize:
                        "20px",
                      fontWeight:
                        700,
                      color:
                        "#15803d",
                    }}
                  >
                    {
                      matchedImageCount
                    }
                  </div>
                </div>

                <div
                  style={{
                    background:
                      "#fff5f5",
                    border:
                      "1px solid #ffdede",
                    borderRadius:
                      "9px",
                    padding:
                      "13px",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "10px",
                      color:
                        "#b42318",
                    }}
                  >
                    Unmatched
                  </div>

                  <div
                    style={{
                      marginTop:
                        "3px",
                      fontSize:
                        "20px",
                      fontWeight:
                        700,
                      color:
                        "#b42318",
                    }}
                  >
                    {
                      unmatchedImageCount
                    }
                  </div>
                </div>
              </div>

              <div
                style={{
                  border:
                    "1px solid #e7e9ed",
                  borderRadius:
                    "10px",
                  overflow:
                    "hidden",
                  maxHeight:
                    "350px",
                  overflowY:
                    "auto",
                }}
              >
                {imageRows.map(
                  (
                    row,
                    index
                  ) => (
                    <div
                      key={`${row.fileName}-${index}`}
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "space-between",
                        gap:
                          "15px",
                        padding:
                          "12px 14px",
                        borderBottom:
                          index ===
                          imageRows.length -
                            1
                            ? "none"
                            : "1px solid #f0f1f3",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize:
                              "11px",
                            fontWeight:
                              600,
                            color:
                              "#30333a",
                          }}
                        >
                          {
                            row.fileName
                          }
                        </div>

                        <div
                          style={{
                            marginTop:
                              "3px",
                            fontSize:
                              "10px",
                            color:
                              "#858a94",
                          }}
                        >
                          {row.matchedProduct
                            ? `→ ${row.matchedProduct.name}`
                            : "No matching product"}
                        </div>
                      </div>

                      <span
                        style={{
                          padding:
                            "4px 8px",
                          borderRadius:
                            "999px",
                          background:
                            row.matchedProduct
                              ? "#ecfdf3"
                              : "#fff5f5",
                          color:
                            row.matchedProduct
                              ? "#15803d"
                              : "#b42318",
                          fontSize:
                            "9px",
                          fontWeight:
                            650,
                        }}
                      >
                        {row.matchedProduct
                          ? "Matched"
                          : "Unmatched"}
                      </span>
                    </div>
                  )
                )}
              </div>

              {message && (
                <div
                  style={{
                    marginTop:
                      "12px",
                    fontSize:
                      "11px",
                    color:
                      "#b42318",
                  }}
                >
                  {message}
                </div>
              )}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  marginTop:
                    "18px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep(
                      "UPLOAD"
                    );
                    setImageRows(
                      []
                    );
                    setImageZip(
                      null
                    );
                  }}
                  style={{
                    border:
                      "1px solid #dfe2e7",
                    background:
                      "#ffffff",
                    color:
                      "#555a63",
                    borderRadius:
                      "8px",
                    padding:
                      "9px 13px",
                    fontSize:
                      "11px",
                    fontWeight:
                      600,
                    cursor:
                      "pointer",
                  }}
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={
                    uploadImagesOnly
                  }
                  disabled={
                    matchedImageCount ===
                    0
                  }
                  style={{
                    border:
                      "none",
                    background:
                      matchedImageCount >
                      0
                        ? "#111111"
                        : "#9ca3af",
                    color:
                      "#ffffff",
                    borderRadius:
                      "8px",
                    padding:
                      "9px 15px",
                    fontSize:
                      "11px",
                    fontWeight:
                      600,
                    cursor:
                      matchedImageCount >
                      0
                        ? "pointer"
                        : "not-allowed",
                  }}
                >
                  Upload Images
                </button>
              </div>
            </div>
          )}

        {/* ======================================================
            PRODUCT MODE — UPLOAD
        ====================================================== */}

        {mode ===
          "PRODUCTS" &&
          step === "UPLOAD" && (
            <>
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: "15px",
                  padding:
                    "14px 16px",
                  background:
                    "#f8f9fa",
                  border:
                    "1px solid #e7e9ed",
                  borderRadius:
                    "10px",
                  marginBottom:
                    "18px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize:
                        "12px",
                      fontWeight:
                        650,
                      color:
                        "#30333a",
                    }}
                  >
                    New to bulk
                    import?
                  </div>

                  <div
                    style={{
                      marginTop:
                        "4px",
                      fontSize:
                        "10px",
                      color:
                        "#858a94",
                    }}
                  >
                    Download the
                    required Excel
                    template.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    downloadTemplate
                  }
                  style={{
                    flexShrink:
                      0,
                    border:
                      "1px solid #dfe2e7",
                    background:
                      "#ffffff",
                    color:
                      "#44474e",
                    borderRadius:
                      "7px",
                    padding:
                      "8px 12px",
                    fontSize:
                      "10px",
                    fontWeight:
                      650,
                    cursor:
                      "pointer",
                  }}
                >
                  ↓ Download Template
                </button>
              </div>

              {/* MENU FILE */}

              <div
                style={{
                  background:
                    "#fafafa",
                  border:
                    "1px solid #e7e9ed",
                  borderRadius:
                    "10px",
                  padding:
                    "18px",
                  marginBottom:
                    "18px",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "13px",
                    fontWeight:
                      650,
                    color:
                      "#30333a",
                    marginBottom:
                      "6px",
                  }}
                >
                  Upload menu file
                </div>

                <div
                  style={{
                    fontSize:
                      "11px",
                    color:
                      "#858a94",
                    marginBottom:
                      "12px",
                  }}
                >
                  CSV, XLSX or XLS
                </div>

                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(
                    event
                  ) =>
                    setFile(
                      event.target
                        .files?.[0] ||
                        null
                    )
                  }
                />

                {file && (
                  <div
                    style={{
                      marginTop:
                        "8px",
                      fontSize:
                        "11px",
                      color:
                        "#555a63",
                    }}
                  >
                    Selected:{" "}
                    {file.name}
                  </div>
                )}
              </div>

              {/* OPTIONAL ZIP */}

              <div
                style={{
                  background:
                    "#fafafa",
                  border:
                    "1px solid #e7e9ed",
                  borderRadius:
                    "10px",
                  padding:
                    "18px",
                  marginBottom:
                    "18px",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "13px",
                    fontWeight:
                      650,
                    color:
                      "#30333a",
                    marginBottom:
                      "6px",
                  }}
                >
                  Product images
                </div>

                <div
                  style={{
                    fontSize:
                      "11px",
                    color:
                      "#858a94",
                    marginBottom:
                      "12px",
                  }}
                >
                  Optional — upload a
                  ZIP of product
                  images. You can also
                  add images later.
                </div>

                <input
                  type="file"
                  accept=".zip"
                  onChange={(
                    event
                  ) =>
                    setImageZip(
                      event.target
                        .files?.[0] ||
                        null
                    )
                  }
                />

                {imageZip && (
                  <div
                    style={{
                      marginTop:
                        "8px",
                      fontSize:
                        "11px",
                      color:
                        "#555a63",
                    }}
                  >
                    Selected:{" "}
                    {
                      imageZip.name
                    }
                  </div>
                )}
              </div>

              {/* DUPLICATES */}

              <div
                style={{
                  marginBottom:
                    "18px",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      600,
                    color:
                      "#555a63",
                    marginBottom:
                      "9px",
                  }}
                >
                  Duplicate products
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    gap: "18px",
                  }}
                >
                  <label
                    style={{
                      display:
                        "flex",
                      gap: "7px",
                      alignItems:
                        "center",
                      fontSize:
                        "12px",
                      color:
                        "#555a63",
                    }}
                  >
                    <input
                      type="radio"
                      checked={
                        duplicateAction ===
                        "SKIP"
                      }
                      onChange={() =>
                        setDuplicateAction(
                          "SKIP"
                        )
                      }
                    />
                    Skip existing
                  </label>

                  <label
                    style={{
                      display:
                        "flex",
                      gap: "7px",
                      alignItems:
                        "center",
                      fontSize:
                        "12px",
                      color:
                        "#555a63",
                    }}
                  >
                    <input
                      type="radio"
                      checked={
                        duplicateAction ===
                        "CREATE"
                      }
                      onChange={() =>
                        setDuplicateAction(
                          "CREATE"
                        )
                      }
                    />
                    Create as new
                  </label>
                </div>
              </div>

              {message && (
                <div
                  style={{
                    color:
                      "#b42318",
                    fontSize:
                      "12px",
                    marginBottom:
                      "12px",
                  }}
                >
                  {message}
                </div>
              )}

              <ModalActions
                onClose={
                  onClose
                }
                onSave={
                  handleReview
                }
                saveText="Review"
              />
            </>
          )}

        {/* ======================================================
            PRODUCT MODE — REVIEW
        ====================================================== */}

        {mode ===
          "PRODUCTS" &&
          step === "REVIEW" && (
            <>
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "10px",
                  marginBottom:
                    "16px",
                }}
              >
                <div
                  style={{
                    background:
                      "#ecfdf3",
                    border:
                      "1px solid #d1fae5",
                    borderRadius:
                      "9px",
                    padding:
                      "13px",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "11px",
                      color:
                        "#15803d",
                    }}
                  >
                    Ready to add
                  </div>

                  <div
                    style={{
                      marginTop:
                        "3px",
                      fontSize:
                        "20px",
                      fontWeight:
                        700,
                      color:
                        "#15803d",
                    }}
                  >
                    {
                      validCount
                    }
                  </div>
                </div>

                <div
                  style={{
                    background:
                      invalidCount >
                      0
                        ? "#fff5f5"
                        : "#fafafa",
                    border:
                      invalidCount >
                      0
                        ? "1px solid #ffdede"
                        : "1px solid #e7e9ed",
                    borderRadius:
                      "9px",
                    padding:
                      "13px",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "11px",
                      color:
                        invalidCount >
                        0
                          ? "#b42318"
                          : "#858a94",
                    }}
                  >
                    Needs attention
                  </div>

                  <div
                    style={{
                      marginTop:
                        "3px",
                      fontSize:
                        "20px",
                      fontWeight:
                        700,
                      color:
                        invalidCount >
                        0
                          ? "#b42318"
                          : "#555a63",
                    }}
                  >
                    {
                      invalidCount
                    }
                  </div>
                </div>
              </div>

              {imageZip && (
                <div
                  style={{
                    padding:
                      "10px 12px",
                    background:
                      "#f5f6f8",
                    borderRadius:
                      "8px",
                    fontSize:
                      "11px",
                    color:
                      "#555a63",
                    marginBottom:
                      "14px",
                  }}
                >
                  Image ZIP selected:{" "}
                  <strong>
                    {
                      imageZip.name
                    }
                  </strong>
                </div>
              )}

              <div
                style={{
                  border:
                    "1px solid #e7e9ed",
                  borderRadius:
                    "10px",
                  overflow:
                    "hidden",
                  maxHeight:
                    "340px",
                  overflowY:
                    "auto",
                }}
              >
                {rows.map(
                  (
                    row,
                    index
                  ) => (
                    <div
                      key={`${row.name}-${index}`}
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "1.5fr 1fr 100px 100px",
                        gap: "10px",
                        alignItems:
                          "center",
                        padding:
                          "11px 13px",
                        borderBottom:
                          index ===
                          rows.length -
                            1
                            ? "none"
                            : "1px solid #f0f1f3",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize:
                              "11px",
                            fontWeight:
                              600,
                            color:
                              "#30333a",
                          }}
                        >
                          {row.name ||
                            "Unnamed product"}
                        </div>

                        {row.error && (
                          <div
                            style={{
                              marginTop:
                                "3px",
                              fontSize:
                                "10px",
                              color:
                                "#b42318",
                            }}
                          >
                            {
                              row.error
                            }
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize:
                            "11px",
                          color:
                            "#666b74",
                        }}
                      >
                        {row.category ||
                          "—"}
                      </div>

                      <div
                        style={{
                          fontSize:
                            "11px",
                          fontWeight:
                            600,
                        }}
                      >
                        {formatCurrency(
                          row.price
                        )}
                      </div>

                      <div
                        style={{
                          fontSize:
                            "10px",
                          fontWeight:
                            650,
                          color:
                            row.valid
                              ? "#15803d"
                              : "#b42318",
                        }}
                      >
                        {row.valid
                          ? "Ready"
                          : "Invalid"}
                      </div>
                    </div>
                  )
                )}
              </div>

              {message && (
                <div
                  style={{
                    color:
                      "#b42318",
                    fontSize:
                      "12px",
                    marginTop:
                      "12px",
                  }}
                >
                  {message}
                </div>
              )}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap: "10px",
                  marginTop:
                    "18px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setStep(
                      "UPLOAD"
                    )
                  }
                  style={{
                    border:
                      "1px solid #dfe2e7",
                    background:
                      "#ffffff",
                    color:
                      "#555a63",
                    borderRadius:
                      "8px",
                    padding:
                      "10px 14px",
                    fontSize:
                      "12px",
                    fontWeight:
                      600,
                    cursor:
                      "pointer",
                  }}
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={
                    addToMenu
                  }
                  disabled={
                    validCount ===
                    0
                  }
                  style={{
                    border:
                      "none",
                    background:
                      validCount >
                      0
                        ? "#111111"
                        : "#9ca3af",
                    color:
                      "#ffffff",
                    borderRadius:
                      "8px",
                    padding:
                      "10px 16px",
                    fontSize:
                      "12px",
                    fontWeight:
                      600,
                    cursor:
                      validCount >
                      0
                        ? "pointer"
                        : "not-allowed",
                  }}
                >
                  Add to Menu
                </button>
              </div>
            </>
          )}

        {/* ======================================================
            ADDING
        ====================================================== */}

        {step ===
          "ADDING" && (
          <div
            style={{
              padding:
                "50px 20px",
              textAlign:
                "center",
            }}
          >
            <div
              style={{
                fontSize:
                  "15px",
                fontWeight:
                  650,
                color:
                  "#30333a",
              }}
            >
              {mode ===
              "IMAGES"
                ? "Uploading images..."
                : "Adding products..."}
            </div>

            <div
              style={{
                marginTop:
                  "7px",
                fontSize:
                  "12px",
                color:
                  "#858a94",
              }}
            >
              Please don't close
              this window.
            </div>
          </div>
        )}

        {/* ======================================================
            DONE
        ====================================================== */}

        {step ===
          "DONE" && (
          <div
            style={{
              padding:
                "45px 20px",
              textAlign:
                "center",
            }}
          >
            <div
              style={{
                width: "46px",
                height: "46px",
                margin:
                  "0 auto 15px",
                borderRadius:
                  "50%",
                background:
                  "#ecfdf3",
                color:
                  "#15803d",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                fontSize:
                  "20px",
                fontWeight:
                  700,
              }}
            >
              ✓
            </div>

            <div
              style={{
                fontSize:
                  "16px",
                fontWeight:
                  700,
                color:
                  "#202228",
              }}
            >
              {mode ===
              "IMAGES"
                ? "Images uploaded"
                : "Menu updated"}
            </div>

            <div
              style={{
                marginTop:
                  "6px",
                fontSize:
                  "12px",
                color:
                  "#858a94",
              }}
            >
              {mode ===
              "IMAGES"
                ? message ||
                  "Product images were uploaded successfully."
                : `${validCount} products were added successfully.`}
            </div>

            <button
              type="button"
              onClick={
                onComplete
              }
              style={{
                marginTop:
                  "20px",
                border:
                  "none",
                background:
                  "#111111",
                color:
                  "#ffffff",
                borderRadius:
                  "8px",
                padding:
                  "10px 18px",
                fontSize:
                  "12px",
                fontWeight:
                  600,
                cursor:
                  "pointer",
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ============================================================
   SHARED UI
============================================================ */

function Modal({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          width: "100%",
          maxWidth: wide ? "900px" : "520px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "14px",
          border: "1px solid #e7e9ed",
          boxShadow:
            "0 20px 50px rgba(0,0,0,0.15)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        padding: "18px 22px",
        borderBottom: "1px solid #eef0f2",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: "15px",
          fontWeight: 700,
          color: "#202228",
        }}
      >
        {title}
      </div>

      <button
        onClick={onClose}
        style={{
          width: "30px",
          height: "30px",
          border: "none",
          background: "#f3f4f6",
          borderRadius: "7px",
          color: "#555a63",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}

function ModalActions({
  onClose,
  onSave,
  saveText,
}: {
  onClose: () => void;
  onSave: () => void;
  saveText: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "8px",
        marginTop: "20px",
      }}
    >
      <button
        onClick={onClose}
        style={{
          border: "1px solid #dfe2e7",
          background: "#ffffff",
          color: "#555a63",
          borderRadius: "8px",
          padding: "9px 13px",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Cancel
      </button>

      <button
        onClick={onSave}
        style={{
          border: "none",
          background: "#111111",
          color: "#ffffff",
          borderRadius: "8px",
          padding: "9px 14px",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {saveText}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: 600,
          color: "#555a63",
          marginBottom: "7px",
        }}
      >
        {label}
      </label>

      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #dfe2e7",
  borderRadius: "8px",
  padding: "10px 11px",
  fontSize: "12px",
  color: "#30333a",
  background: "#ffffff",
  outline: "none",
};