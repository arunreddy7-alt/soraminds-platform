"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getCartCount,
  addToCart,
  getCart,
  getCartTotal,
  updateCartItem,
  removeCartItem,
  CartItem,
} from "@/lib/cart";
import {
  parseProductMetadata,
  OptionChoice,
  OptionGroup,
} from "@/lib/productMetadata";

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
  features: {
    vip_lounge: boolean;
    bar: boolean;
    live_entertainment: boolean;
    currency?: string;
  } | null;
};

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

type Combo = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  combo_price: number;
  original_price: number;
  is_active: boolean;
};

type Banner = {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

type TableSession = {
  id: number;
  restaurant_id: number;
  table_id: number;
  status: string;
  started_at: string;
  ended_at: string | null;
  group_code: string;
};

type TableInfo = {
  id: number;
  tableNumber: string;
  seats: number;
};

type DietaryType = "veg" | "non-veg" | "egg";

function getDietaryType(product: Product, categories: Category[]): DietaryType {
  const name = product.name.toLowerCase();
  const desc = (product.description || "").toLowerCase();
  const cat = categories.find((c) => c.id === product.category_id);
  const catName = (cat?.name || "").toLowerCase();

  // Check for Egg
  if (
    desc.includes("[egg]") ||
    catName.includes("egg") ||
    name.includes("egg") ||
    name.includes("anda") ||
    name.includes("omelette") ||
    name.includes("omlet") ||
    desc.includes("contains egg")
  ) {
    return "egg";
  }

  // Check for Veg
  if (
    product.is_vegetarian ||
    catName.includes("veg") ||
    name.startsWith("veg ") ||
    name.includes("paneer") ||
    name.includes("soya") ||
    name.includes("mushroom") ||
    name.includes("aloo") ||
    name.includes("gobi")
  ) {
    return "veg";
  }

  // Default to Non-Veg
  return "non-veg";
}

function DietaryBadge({ type }: { type: DietaryType }) {
  if (type === "veg") {
    return (
      <span
        title="Vegetarian"
        className="inline-flex items-center justify-center w-4 h-4 rounded border-[1.5px] border-emerald-600 bg-white p-0.5 shrink-0"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-600" />
      </span>
    );
  }
  if (type === "egg") {
    return (
      <span
        title="Contains Egg"
        className="inline-flex items-center justify-center w-4 h-4 rounded border-[1.5px] border-amber-500 bg-white p-0.5 shrink-0"
      >
        <span className="w-2 h-2 rounded-full bg-amber-500" />
      </span>
    );
  }
  return (
    <span
      title="Non-Vegetarian"
      className="inline-flex items-center justify-center w-4 h-4 rounded border-[1.5px] border-red-600 bg-white p-0.5 shrink-0"
    >
      <span className="w-2 h-2 rounded-full bg-red-600" />
    </span>
  );
}

// AddonItem type and DEFAULT_ADDONS removed — modal now uses real menu products

export default function StorefrontClient({
  restaurantSlug,
}: {
  restaurantSlug: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /*
   * ORDER MODE
   * Takeaway QR: ?orderType=TAKEAWAY
   * Table QR: ?orderType=DINE_IN&tableId=2
   */
  const orderType =
    searchParams.get("orderType") === "DINE_IN"
      ? "DINE_IN"
      : "TAKEAWAY";

  const tableIdParam = searchParams.get("tableId");
  const tableId = tableIdParam ? Number(tableIdParam) : null;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"available" | "all">("available");
  const [dietaryFilter, setDietaryFilter] = useState<"ALL" | "veg" | "non-veg" | "egg">("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * TABLE SESSION
   */
  const [tableSession, setTableSession] = useState<TableSession | null>(null);
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");

  /*
   * JOIN TABLE MODAL
   */
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState("");

  /*
   * CATEGORY BAR SCROLL & MENU
   */
  const categoryTrackRef = useRef<HTMLDivElement>(null);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  /*
   * CART COUNT, ITEMS & DRAWER
   */
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /*
   * CUSTOMIZE ORDER POPUP MODAL STATE
   */
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalCustomizations, setModalCustomizations] = useState<Record<string, OptionChoice[]>>({});
  // modalMealTab holds a category ID from the real menu categories
  const [modalMealTab, setModalMealTab] = useState<number | null>(null);
  const [modalSelectedAddons, setModalSelectedAddons] = useState<Product[]>([]);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  /*
   * PROMOTIONS BANNER STATE
   */
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerCarouselRef = useRef<HTMLDivElement>(null);
  const [isBannerHovered, setIsBannerHovered] = useState(false);

  useEffect(() => {
    if (banners.length <= 1 || isBannerHovered) return;
    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => {
        const next = (prev + 1) % banners.length;
        if (bannerCarouselRef.current) {
          const container = bannerCarouselRef.current;
          const card = container.children[next] as HTMLElement | undefined;
          if (card && typeof card.offsetLeft === "number") {
            container.scrollTo({
              left: card.offsetLeft,
              behavior: "smooth",
            });
          }
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length, isBannerHovered]);

  const scrollToBanner = (index: number) => {
    setActiveBannerIndex(index);
    if (bannerCarouselRef.current) {
      const container = bannerCarouselRef.current;
      const card = container.children[index] as HTMLElement | undefined;
      if (card && typeof card.offsetLeft === "number") {
        container.scrollTo({
          left: card.offsetLeft,
          behavior: "smooth",
        });
      } else {
        container.scrollTo({
          left: index * (container.clientWidth || container.offsetWidth),
          behavior: "smooth",
        });
      }
    }
  };

  const handleBannerScroll = () => {
    if (!bannerCarouselRef.current) return;
    const container = bannerCarouselRef.current;
    const cardWidth = container.clientWidth || container.offsetWidth;
    if (cardWidth > 0) {
      const newIndex = Math.round(container.scrollLeft / cardWidth);
      if (
        newIndex >= 0 &&
        newIndex < banners.length &&
        newIndex !== activeBannerIndex
      ) {
        setActiveBannerIndex(newIndex);
      }
    }
  };

  useEffect(() => {
    if (restaurantSlug) {
      loadStorefront();
    }
  }, [restaurantSlug]);

  // Load cached table session from localStorage if present
  useEffect(() => {
    if (!restaurantSlug) return;
    try {
      const cached = localStorage.getItem(`soraminds-table-session-${restaurantSlug}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.tableNumber && !tableInfo) {
          setTableInfo({
            id: Number(parsed.tableId) || 0,
            tableNumber: String(parsed.tableNumber),
            seats: 0,
          });
        }
      }
    } catch { }
  }, [restaurantSlug, tableInfo]);

  const loadStorefront = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/customer/storefront/${restaurantSlug}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load restaurant.");
      }

      setRestaurant(data.restaurant);
      const fetchedCategories: Category[] = data.categories || [];
      const fetchedProducts: Product[] = data.products || [];
      setCategories(fetchedCategories);
      setProducts(fetchedProducts);
      setCombos(data.combos || []);
      setBanners(data.banners || []);
      const firstCatWithItems = fetchedCategories.find((cat) =>
        fetchedProducts.some((p) => p.category_id === cat.id)
      );
      if (firstCatWithItems && selectedCategory === null) {
        setSelectedCategory(firstCatWithItems.id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load restaurant."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * INITIALIZE TABLE SESSION IF DINE_IN
   */
  useEffect(() => {
    if (
      orderType !== "DINE_IN" ||
      !restaurantSlug ||
      !tableId ||
      !Number.isInteger(tableId)
    ) {
      if (orderType !== "DINE_IN") {
        setTableSession(null);
        setTableInfo(null);
        setSessionError("");
      }
      return;
    }

    initializeTableSession();
  }, [orderType, restaurantSlug, tableId]);

  const initializeTableSession = async () => {
    try {
      setSessionLoading(true);
      setSessionError("");

      const response = await fetch("/api/customer/table-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          tableId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to start table session.");
      }

      setTableSession(data.session);
      setTableInfo(data.table);

      localStorage.setItem(
        `soraminds-table-session-${restaurantSlug}`,
        JSON.stringify({
          sessionId: data.session.id,
          tableId: data.table.id,
          tableNumber: data.table.tableNumber,
          groupCode: data.session.group_code,
        })
      );
    } catch (err) {
      setSessionError(
        err instanceof Error ? err.message : "Unable to start table session."
      );
    } finally {
      setSessionLoading(false);
    }
  };

  /*
   * JOIN TABLE BY CODE
   */
  const joinTableByCode = async () => {
    const code = joinCode.trim().toUpperCase();

    if (!code) {
      setJoinError("Please enter the table code.");
      return;
    }

    try {
      setJoinLoading(true);
      setJoinError("");

      const response = await fetch("/api/customer/table-session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          groupCode: code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to join table.");
      }

      const session = data.session;
      const table = data.table;

      setTableSession(session);
      setTableInfo(table);
      setShowJoinModal(false);
      setJoinCode("");

      localStorage.setItem(
        `soraminds-table-session-${restaurantSlug}`,
        JSON.stringify({
          sessionId: session.id,
          tableId: table.id,
          tableNumber: table.tableNumber,
          groupCode: session.group_code,
        })
      );

      const params = new URLSearchParams();
      params.set("orderType", "DINE_IN");
      params.set("tableId", String(table.id));
      params.set("sessionId", String(session.id));

      router.push(`/restaurant/${restaurantSlug}?${params.toString()}`);
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Unable to join table."
      );
    } finally {
      setJoinLoading(false);
    }
  };

  const getCustomerContextQuery = () => {
    if (orderType === "DINE_IN" && tableId) {
      const sessionId = tableSession?.id ?? null;
      const params = new URLSearchParams();
      params.set("orderType", "DINE_IN");
      params.set("tableId", String(tableId));
      if (sessionId) {
        params.set("sessionId", String(sessionId));
      }
      return `?${params.toString()}`;
    }
    return "?orderType=TAKEAWAY";
  };

  /*
   * CART LISTENER & SYNC
   */
  const refreshCartState = () => {
    const currentCart = getCart(restaurantSlug);
    setCartItems(currentCart);
    setCartCount(getCartCount(currentCart));
  };

  useEffect(() => {
    refreshCartState();
    window.addEventListener("soraminds-cart-updated", refreshCartState);

    // Also listen for localStorage changes (e.g. clearCart called from checkout)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `soraminds_cart_${restaurantSlug}` || e.key === `soraminds-cart-${restaurantSlug}`) {
        refreshCartState();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("soraminds-cart-updated", refreshCartState);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [restaurantSlug]);

  const copyShareCode = () => {
    const code = tableSession?.group_code;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const scrollCategories = (direction: "left" | "right") => {
    if (categoryTrackRef.current) {
      const offset = direction === "left" ? -240 : 240;
      categoryTrackRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  /*
   * OPEN CUSTOMIZE MODAL
   */
  const openCustomizeModal = (product: Product) => {
    setSelectedProductForModal(product);
    setModalQuantity(1);

    const meta = parseProductMetadata(product.description, product.is_vegetarian);
    const initialSelections: Record<string, OptionChoice[]> = {};

    if (meta.optionGroups) {
      for (const group of meta.optionGroups) {
        if (group.required && group.choices.length > 0) {
          const baseChoice =
            group.choices.find((c) => c.isBase) || group.choices[0];
          initialSelections[group.name] = [baseChoice];
        } else {
          initialSelections[group.name] = [];
        }
      }
    }

    setModalCustomizations(initialSelections);

    // Default to first available beverage or dessert category
    const bevOrDessertCat = categories.find((c) =>
      /beverage|drink|dessert|sweet/i.test(c.name)
    );
    setModalMealTab(bevOrDessertCat ? bevOrDessertCat.id : null);
    setModalSelectedAddons([]);
  };

  const toggleAddon = (product: Product) => {
    setModalSelectedAddons((prev) => {
      const exists = prev.some((a) => a.id === product.id);
      if (exists) {
        return prev.filter((a) => a.id !== product.id);
      }
      return [...prev, product];
    });
  };

  const modalAddonsTotal = modalSelectedAddons.reduce(
    (sum, a) => sum + a.price,
    0
  );

  const modalCustomizationsTotal = Object.values(modalCustomizations)
    .flat()
    .reduce((sum, c) => sum + (Number(c.price) || 0), 0);

  const modalProductBasePrice = selectedProductForModal?.price || 0;
  const modalUnitTotal = modalProductBasePrice + modalCustomizationsTotal;
  const modalFinalPrice =
    (modalUnitTotal + modalAddonsTotal) * modalQuantity;

  const handleModalAddToCart = async () => {
    if (!selectedProductForModal || !restaurant) return;

    try {
      setIsAddingToCart(true);

      const meta = parseProductMetadata(
        selectedProductForModal.description,
        selectedProductForModal.is_vegetarian
      );

      // Validate required option groups
      for (const group of meta.optionGroups || []) {
        const selected = modalCustomizations[group.name] || [];
        if (group.required && selected.length === 0) {
          alert(`Please select an option for "${group.name}".`);
          setIsAddingToCart(false);
          return;
        }
      }

      // Format chosen options for display and order item
      const customParts = Object.entries(modalCustomizations)
        .flatMap(([groupName, choices]) =>
          choices.map((c) =>
            Number(c.price) > 0
              ? `${groupName}: ${c.name} (+${getCurrencySymbol()}${Number(c.price).toFixed(2)})`
              : `${groupName}: ${c.name}`
          )
        );

      const variantName = customParts.length > 0 ? customParts.join(" • ") : null;
      const unitPrice = modalUnitTotal;
      const itemKey = `${selectedProductForModal.id}-${variantName || "standard"}-${Date.now()}`;

      // 1. Add main dish to cart with chosen customization
      const cartItem: CartItem = {
        key: itemKey,
        productId: selectedProductForModal.id,
        productSlug: selectedProductForModal.slug,
        name: selectedProductForModal.name,
        imageUrl: selectedProductForModal.image_url,
        price: unitPrice,
        quantity: modalQuantity,
        variantId: null,
        variantName,
      };

      addToCart(restaurantSlug, cartItem);

      if (orderType === "DINE_IN" && tableSession) {
        try {
          await fetch("/api/customer/table-session/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurantSlug,
              tableSessionId: tableSession.id,
              productId: selectedProductForModal.id,
              variantId: null,
              variantName,
              quantity: modalQuantity,
            }),
          });
        } catch (syncErr) {
          console.error("Shared cart item sync:", syncErr);
        }
      }

      // 2. Add each selected add-on product (e.g. Beverages & Desserts) as individual cart items
      for (const addon of modalSelectedAddons) {
        const addonKey = `${addon.id}-addon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const addonCartItem: CartItem = {
          key: addonKey,
          productId: addon.id,
          productSlug: addon.slug,
          name: addon.name,
          imageUrl: addon.image_url,
          price: Number(addon.price),
          quantity: modalQuantity,
          variantId: null,
          variantName: `Add-on with ${selectedProductForModal.name}`,
        };

        addToCart(restaurantSlug, addonCartItem);

        if (orderType === "DINE_IN" && tableSession) {
          try {
            await fetch("/api/customer/table-session/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                restaurantSlug,
                tableSessionId: tableSession.id,
                productId: addon.id,
                variantId: null,
                quantity: modalQuantity,
              }),
            });
          } catch (syncErr) {
            console.error("Shared cart addon sync:", syncErr);
          }
        }
      }

      refreshCartState();
      const addedText = modalSelectedAddons.length > 0
        ? `Added ${selectedProductForModal.name} + ${modalSelectedAddons.length} add-on${modalSelectedAddons.length > 1 ? "s" : ""} to cart!`
        : `Added ${selectedProductForModal.name} to cart!`;
      setToastMessage(addedText);
      setTimeout(() => setToastMessage(null), 2500);
      setSelectedProductForModal(null);
    } catch (err) {
      console.error("Error adding to cart:", err);
    } finally {
      setIsAddingToCart(false);
    }
  };

  /*
   * FILTERED PRODUCTS
   */
  const filteredProducts = products.filter((product) => {
    if (availabilityFilter === "available" && !product.is_available) {
      return false;
    }

    const searchValue = search.trim().toLowerCase();

    if (searchValue) {
      const matchesSearch =
        product.name.toLowerCase().includes(searchValue) ||
        product.description?.toLowerCase().includes(searchValue);
      return matchesSearch;
    }

    if (selectedCategory !== null && product.category_id !== selectedCategory) {
      return false;
    }

    if (dietaryFilter !== "ALL") {
      const type = getDietaryType(product, categories);
      if (type !== dietaryFilter) {
        return false;
      }
    }

    return true;
  });

  // Only show categories that have at least one product
  const categoriesWithProducts = categories.filter(
    (cat) => products.some((p) => p.category_id === cat.id)
  );

  const activeCategoryObject = categories.find(
    (c) => c.id === selectedCategory
  );

  const getProductCalories = (product: Product): number | null => {
    return parseProductMetadata(product.description, product.is_vegetarian).calories;
  };

  const getCleanDescription = (description: string | null): string => {
    return parseProductMetadata(description, false).cleanDescription;
  };

  const getCurrencySymbol = (): string => {
    const code = restaurant?.features?.currency || "INR";
    const map: Record<string, string> = {
      INR: "₹",
      USD: "$",
      EUR: "€",
      GBP: "£",
      AED: "د.إ",
      SGD: "S$",
      AUD: "A$",
      CAD: "C$",
    };
    return map[code] ?? "₹";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex flex-col items-center justify-center p-6 text-gray-500">
        <div className="w-10 h-10 border-3 border-[#12b76a] border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-medium">Loading menu...</span>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white border border-gray-200 rounded-2xl p-8 shadow-xs">
          <div className="text-4xl mb-3">🍽️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Restaurant Not Available
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            {error || "Unable to load restaurant details."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-[#155e38] hover:bg-[#0e4326] text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const cartTotalAmount = getCartTotal(cartItems);

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#111827] flex flex-col w-full selection:bg-emerald-100 selection:text-emerald-900">
      {/* TOAST CONFIRMATION */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <span className="text-emerald-400">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER BAR */}
      <header className="w-full bg-white border-b border-gray-200/90 sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="w-full px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between gap-3 sm:gap-6 flex-wrap md:flex-nowrap">
          {/* LEFT: Restaurant Brand & Location */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-lg border border-gray-200/90 bg-white p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
              <div className="w-full h-full rounded bg-emerald-50 flex flex-col items-center justify-center text-center p-0.5 border border-emerald-100">
                <span className="text-[9px] font-black uppercase text-[#155e38] leading-tight">
                  {restaurant.name.slice(0, 3)}
                </span>
                <span className="text-[7px] font-bold text-gray-600 leading-tight">
                  HOUSE
                </span>
              </div>
            </div>

            <div>
              <div className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight tracking-tight">
                {restaurant.name}
              </div>
              <div className="text-xs text-gray-500 font-medium leading-tight mt-0.5">
                {restaurant.address || restaurant.cuisine || "Dine-In & Takeaway"}
              </div>
            </div>

            <div className="hidden sm:block h-8 w-[1px] bg-gray-200 ml-2" />
          </div>

          {/* MIDDLE: Order Mode Capsule */}
          <div className="order-3 md:order-2 w-full md:w-auto flex items-center justify-center sm:justify-start">
            <div className="bg-[#edf2ee] p-1 rounded-full flex items-center gap-1 border border-emerald-900/10 shadow-2xs max-w-full overflow-x-auto">
              {orderType === "TAKEAWAY" ? (
                <>
                  <div className="bg-[#155e38] text-white px-5 py-1.5 rounded-full font-bold text-xs tracking-wide flex items-center gap-1.5 shadow-xs whitespace-nowrap">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                    Takeaway
                  </div>

                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="text-gray-600 hover:text-emerald-900 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-white/70 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="Switch to Table Dine-In"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 10h18M3 14h18m-9-4v8m-7 0h14"
                      />
                    </svg>
                    Dine In?
                  </button>
                </>
              ) : (
                <>
                  <div className="bg-[#155e38] text-white px-4 py-1.5 rounded-full font-bold text-xs tracking-wide flex items-center gap-1.5 shadow-xs whitespace-nowrap">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 10h18M3 14h18m-9-4v8m-7 0h14"
                      />
                    </svg>
                    Dine In
                  </div>

                  <div className="bg-white text-gray-800 font-bold px-3 py-1.5 rounded-full text-xs border border-gray-200/80 shadow-2xs flex items-center gap-1 whitespace-nowrap">
                    <span className="text-gray-400 font-normal">Table</span>
                    <span className="font-extrabold text-gray-900">
                      {tableInfo?.tableNumber || tableId || "—"}
                    </span>
                  </div>

                  <button
                    onClick={copyShareCode}
                    title="Click to copy table share code"
                    className="bg-white hover:bg-emerald-50 active:scale-95 text-[#155e38] font-bold px-3 py-1.5 rounded-full text-xs border border-emerald-300 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap group"
                  >
                    <span className="text-gray-400 font-medium text-[11px]">
                      Share Code:
                    </span>
                    <span className="font-mono tracking-wider font-black text-gray-900 group-hover:text-[#155e38]">
                      {tableSession?.group_code || (sessionLoading ? "..." : "—")}
                    </span>

                    {copiedCode ? (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                        <svg
                          className="w-3.5 h-3.5 text-emerald-600"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Copied!
                      </span>
                    ) : (
                      <svg
                        className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-700 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: Cart Button */}
          <div className="order-2 md:order-3 ml-auto sm:ml-0 flex items-center gap-2">
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="bg-[#155e38] hover:bg-[#0e4326] active:bg-[#0a3020] text-white px-4 sm:px-5 py-2 rounded-full font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="bg-white text-[#155e38] text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-5 flex-1 flex flex-col">
        {(!restaurant.is_open || !restaurant.accept_orders) && (
          <div className="w-full mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                Restaurant is currently not accepting new orders. You can still
                browse the menu.
              </span>
            </div>
          </div>
        )}

        {/* SEARCH & FILTER ROW */}
        <div className="w-full flex items-center justify-between gap-3 mb-4 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[240px]">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Menu"
              className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-9 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-[#155e38] transition-all shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="bg-[#edf2ee] p-1 rounded-full flex items-center border border-gray-200/70 shadow-2xs shrink-0">
            <button
              onClick={() => {
                setAvailabilityFilter("available");
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${availabilityFilter === "available"
                  ? "bg-[#155e38] text-white shadow-xs"
                  : "text-gray-700 hover:text-gray-900"
                }`}
            >
              Available Now
            </button>
            <button
              onClick={() => {
                setSelectedCategory(null);
                setAvailabilityFilter("all");
                setDietaryFilter("ALL");
                setSearch("");
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${selectedCategory === null && availabilityFilter === "all" && dietaryFilter === "ALL"
                  ? "bg-[#155e38] text-white shadow-xs"
                  : "text-gray-700 hover:text-gray-900"
                }`}
            >
              All Items
            </button>
          </div>

          {/* DIETARY CATEGORY PILLS (Veg, Non-Veg, Egg) */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto [scrollbar-width:none]">
            {/* VEG */}
            <button
              onClick={() =>
                setDietaryFilter((prev) => (prev === "veg" ? "ALL" : "veg"))
              }
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border ${dietaryFilter === "veg"
                  ? "bg-[#16a34a] text-white border-[#16a34a] shadow-xs"
                  : "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50/50 shadow-2xs"
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${dietaryFilter === "veg" ? "bg-white" : "bg-[#16a34a]"}`} />
              Veg
            </button>

            {/* NON-VEG */}
            <button
              onClick={() =>
                setDietaryFilter((prev) => (prev === "non-veg" ? "ALL" : "non-veg"))
              }
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border ${dietaryFilter === "non-veg"
                  ? "bg-[#ef4444] text-white border-[#ef4444] shadow-xs"
                  : "bg-white text-red-800 border-red-300 hover:bg-red-50/50 shadow-2xs"
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${dietaryFilter === "non-veg" ? "bg-white" : "bg-[#ef4444]"}`} />
              Non-Veg
            </button>

            {/* EGG (YELLOW) */}
            <button
              onClick={() =>
                setDietaryFilter((prev) => (prev === "egg" ? "ALL" : "egg"))
              }
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border ${dietaryFilter === "egg"
                  ? "bg-[#eab308] text-gray-950 border-[#ca8a04] shadow-xs font-black"
                  : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/60 shadow-2xs"
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${dietaryFilter === "egg" ? "bg-gray-900" : "bg-[#eab308]"}`} />
              Egg
            </button>
          </div>
        </div>

        {/* PROMOTIONS / SPECIAL OFFERS BANNER */}
        {banners.length > 0 && (
          <div
            className="w-full mb-6 relative group"
            onMouseEnter={() => setIsBannerHovered(true)}
            onMouseLeave={() => setIsBannerHovered(false)}
          >
            {/* Scrollable Carousel Track */}
            <div
              ref={bannerCarouselRef}
              onScroll={handleBannerScroll}
              className="w-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-2xl shadow-sm border border-emerald-950/10"
            >
              {banners.map((banner) => (
                <div
                  key={banner.id}
                  className="w-full shrink-0 snap-center relative min-h-[140px] sm:min-h-[165px] md:min-h-[180px] rounded-2xl overflow-hidden flex items-center select-none"
                  style={{
                    backgroundColor: "#0d3f25",
                  }}
                >
                  {/* Background Image with Overlay */}
                  {banner.image_url ? (
                    <>
                      <img
                        src={banner.image_url}
                        alt={banner.title}
                        className="absolute inset-0 w-full h-full object-cover object-center scale-105 group-hover:scale-100 transition-transform duration-700 ease-out"
                      />
                      {/* Rich Dark Gradient Overlay for optimal legibility */}
                      <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:hidden" />
                    </>
                  ) : (
                    /* Elegant Gradient & Decorative Pattern when no image */
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-[#072d1a] via-[#0f4d2f] to-[#1a6b42]" />
                      <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
                      <div className="absolute -left-8 -top-8 w-36 h-36 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
                      {/* Decorative SVG badge pattern in background */}
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none hidden sm:block">
                        <svg
                          className="w-32 h-32 text-white"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </div>
                    </>
                  )}

                  {/* Banner Content */}
                  <div className="relative z-10 p-5 sm:p-7 md:p-8 max-w-xl flex flex-col justify-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/30 backdrop-blur-md text-emerald-200 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-2 sm:mb-2.5 w-fit shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Special Promotion
                    </div>

                    {/* Title */}
                    <h3 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight leading-snug drop-shadow-sm line-clamp-1 sm:line-clamp-2">
                      {banner.title}
                    </h3>

                    {/* Description */}
                    {banner.description && (
                      <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-gray-200/90 font-medium leading-relaxed line-clamp-2 max-w-lg">
                        {banner.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Carousel Navigation Arrows (Visible when > 1 banner) */}
            {banners.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    scrollToBanner(
                      (activeBannerIndex - 1 + banners.length) % banners.length
                    )
                  }
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/75 active:scale-95 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all opacity-0 group-hover:opacity-100 sm:opacity-70 cursor-pointer shadow-md z-20"
                  aria-label="Previous promotion"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    scrollToBanner((activeBannerIndex + 1) % banners.length)
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/75 active:scale-95 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all opacity-0 group-hover:opacity-100 sm:opacity-70 cursor-pointer shadow-md z-20"
                  aria-label="Next promotion"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                {/* Dot Indicators */}
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/30 backdrop-blur-xs border border-white/10">
                  {banners.map((_, dotIdx) => (
                    <button
                      key={dotIdx}
                      type="button"
                      onClick={() => scrollToBanner(dotIdx)}
                      className={`transition-all duration-300 rounded-full cursor-pointer ${dotIdx === activeBannerIndex
                          ? "w-5 h-1.5 bg-white shadow-xs"
                          : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"
                        }`}
                      aria-label={`Go to slide ${dotIdx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* CATEGORIES BAR */}
        <div className="w-full flex items-center gap-2 mb-6 relative">
          <button
            onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
            className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-emerald-900 shadow-2xs shrink-0 cursor-pointer transition-colors"
            title="Browse all categories"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {isCategoryMenuOpen && (
            <div className="absolute top-10 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[220px] max-h-[300px] overflow-y-auto">
              <div className="text-[11px] font-bold text-gray-400 px-3 py-1.5 uppercase tracking-wider">
                Categories
              </div>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setIsCategoryMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${selectedCategory === null
                    ? "bg-emerald-50 text-[#155e38]"
                    : "text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <span>All Categories</span>
                <span className="text-[11px] text-gray-400">
                  {products.length}
                </span>
              </button>
              {categoriesWithProducts.map((cat) => {
                const count = products.filter(
                  (p) => p.category_id === cat.id
                ).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setIsCategoryMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${selectedCategory === cat.id
                        ? "bg-emerald-50 text-[#155e38]"
                        : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    <span>{cat.name}</span>
                    <span className="text-[11px] text-gray-400">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => scrollCategories("left")}
            className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow-2xs shrink-0 cursor-pointer transition-colors"
            title="Scroll categories left"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div
            ref={categoryTrackRef}
            className="flex items-center gap-2 overflow-x-auto scroll-smooth flex-1 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {categoriesWithProducts.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const count = products.filter(
                (p) => p.category_id === cat.id
              ).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer whitespace-nowrap ${isSelected
                      ? "bg-[#155e38] text-white font-bold shadow-xs"
                      : "bg-white text-gray-700 hover:text-gray-900 border border-gray-200/90 font-medium shadow-2xs hover:border-gray-300"
                    }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          <button
            onClick={() => scrollCategories("right")}
            className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow-2xs shrink-0 cursor-pointer transition-colors"
            title="Scroll categories right"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* SECTION TITLE */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            {search.trim()
              ? `Search Results for "${search}" (${filteredProducts.length})`
              : activeCategoryObject
                ? `${activeCategoryObject.name} (${filteredProducts.length})`
                : `All Menu Items (${filteredProducts.length})`}
          </h1>
        </div>

        {/* 
          MINIMAL PRODUCT CARDS GRID
          With Dietary Color Coding:
          - Veg: Green top bar (#16a34a)
          - Non-Veg: Red top bar (#ef4444)
          - Egg: Yellow top bar (#eab308)
          - Clean plate photo
          - Title with FSSAI badge
          - Cal: 395
          - Bold Price ($12.00) + Circular Red Plus Button (+)
        */}
        {filteredProducts.length === 0 ? (
          <div className="w-full bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 my-6 shadow-2xs">
            <div className="text-3xl mb-2">🔍</div>
            <div className="font-bold text-gray-800 text-sm mb-1">
              No dishes found
            </div>
            <p className="text-xs text-gray-500">
              Try adjusting your search or filtering by a different category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {filteredProducts.map((product) => {
              const meta = parseProductMetadata(product.description, product.is_vegetarian);
              const dietaryType = getDietaryType(product, categories);

              const topBorderColor =
                dietaryType === "veg"
                  ? "border-t-[#16a34a]"
                  : dietaryType === "egg"
                    ? "border-t-[#eab308]"
                    : "border-t-[#ef4444]";

              return (
                <div
                  key={product.id}
                  onClick={() => openCustomizeModal(product)}
                  className={`bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer group border-t-4 ${topBorderColor}`}
                >
                  {/* Full-width product image */}
                  <div className="relative w-full aspect-[4/3] bg-[#f9fafb] overflow-hidden">
                    {product.image_url ? (
                     <img
  src={product.image_url}
  alt={product.name}
  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[240px] sm:w-[200px] sm:h-[200px] md:w-[250px] md:h-[250px] lg:w-[380px] lg:h-[380px] object-contain object-center group-hover:scale-105 transition-transform duration-300"
/>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-amber-50/80 border border-amber-100 flex items-center justify-center text-3xl sm:text-4xl shadow-inner">
                          {dietaryType === "veg" ? "🥗" : dietaryType === "egg" ? "🍳" : "🍗"}
                        </div>
                      </div>
                    )}
                    {/* Course badge (top-right) */}
                    {meta.course && (
                      <span className="absolute top-2 right-2 bg-slate-700/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                        {meta.course}
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-2.5 sm:p-4 pt-2 sm:pt-3 flex-1 flex flex-col justify-between bg-white">
                    <div>
                      {/* Dietary Badge & Dish Title */}
                      <div className="flex items-start gap-1">
                        <span className="mt-0.5 shrink-0">
                          <DietaryBadge type={dietaryType} />
                        </span>
                        <h3 className="font-extrabold text-[13px] sm:text-[16px] text-gray-900 leading-snug line-clamp-2 min-h-[34px] sm:min-h-[42px] group-hover:text-emerald-700 transition-colors">
                          {product.name}
                        </h3>
                      </div>

                      {/* Meta row: Calories + Spice */}
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {meta.calories !== null && (
                          <span className="text-[9px] sm:text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
                            🔥 {meta.calories} kcal
                          </span>
                        )}
                        {meta.spiceLevel && (
                          <span className="text-[9px] sm:text-[10px] font-semibold text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">
                            🌶 {meta.spiceLevel}
                          </span>
                        )}
                        {meta.allergens && (
                          <span className="text-[9px] sm:text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
                            ⚠️ {meta.allergens}
                          </span>
                        )}
                      </div>

                      {/* Nutrition tags */}
                      {meta.nutritionTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {meta.nutritionTags.slice(0, 2).map((tag, i) => (
                            <span key={i} className="text-[8px] sm:text-[9px] font-medium text-green-700 bg-green-50 border border-green-100 px-1 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Price & Red Plus Button */}
                    <div className="flex items-center justify-between mt-2 sm:mt-3 pt-1">
                      <div className="text-[15px] sm:text-[19px] font-black text-gray-900 tracking-tight">
                        {getCurrencySymbol()}{Number(product.price || 0).toFixed(0)}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openCustomizeModal(product);
                        }}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#ef4444] hover:bg-[#dc2626] active:scale-90 text-white flex items-center justify-center font-black text-base sm:text-lg shadow-sm transition-all cursor-pointer"
                        title="Customize & Add to order"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* COMBOS SECTION (if available) */}
        {combos.length > 0 && selectedCategory === null && !search.trim() && (
          <section className="mt-12">
            <h2 className="text-xl font-extrabold text-gray-900 mb-4 tracking-tight">
              Value Combos
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {combos.map((combo) => (
                <div
                  key={combo.id}
                  className="bg-white rounded-2xl border border-gray-100 border-t-4 border-t-[#12b76a] overflow-hidden shadow-xs flex flex-col justify-between"
                >
                  <div className="relative w-full aspect-[4/3] bg-[#f9fafb] overflow-hidden">
                    {combo.image_url ? (
                      <img
                        src={combo.image_url}
                        alt={combo.name}
                        className="absolute inset-0 w-full h-full object-cover object-center"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-28 h-28 rounded-full bg-amber-50 flex items-center justify-center text-3xl">
                          🍱
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-[15px] text-gray-900">
                      {combo.name}
                    </h3>
                    {combo.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                        {combo.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-extrabold text-base text-gray-900">
                        {getCurrencySymbol()}{Number(combo.combo_price).toFixed(0)}
                      </span>
                      {combo.original_price > combo.combo_price && (
                        <span className="text-xs text-gray-400 line-through">
                          {getCurrencySymbol()}{Number(combo.original_price).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 
        ========================================================================
        CUSTOMIZE YOUR ORDER POPUP MODAL
        ========================================================================
      */}
      {selectedProductForModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-[460px] bg-white rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] border border-gray-100 animate-in zoom-in-95">
            {/* Modal Top Bar */}
            <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
                Customize Your Order
              </h2>
              <button
                onClick={() => setSelectedProductForModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-center flex-1">
              {/* Dish Image */}
              <div className="flex justify-center">
  <div className="w-36 h-36 rounded-full bg-amber-50/50 border border-gray-200/60 shadow-xs flex items-center justify-center overflow-hidden">
    {selectedProductForModal.image_url ? (
      <img
        src={selectedProductForModal.image_url}
        alt={selectedProductForModal.name}
        className="w-full h-full object-cover rounded-full"
      />
                  ) : (
                    <span className="text-5xl">🥪</span>
                  )}
                </div>
              </div>

              {/* Dish Details */}
              <div>
                <div className="flex items-center justify-center gap-1.5">
                  <DietaryBadge
                    type={getDietaryType(selectedProductForModal, categories)}
                  />
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">
                    {selectedProductForModal.name}
                  </h3>
                </div>
                <div className="text-xl font-extrabold text-[#ef4444] mt-1">
                  {getCurrencySymbol()}{Number(selectedProductForModal.price || 0).toFixed(0)}
                </div>
                {/* Metadata badges in modal */}
                {(() => {
                  const meta = parseProductMetadata(selectedProductForModal.description, selectedProductForModal.is_vegetarian);
                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                        {meta.course && (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            {meta.course}
                          </span>
                        )}
                        {meta.calories !== null && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            🔥 {meta.calories} kcal
                          </span>
                        )}
                        {meta.spiceLevel && (
                          <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            🌶 {meta.spiceLevel}
                          </span>
                        )}
                        {meta.allergens && (
                          <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                            ⚠️ Contains: {meta.allergens}
                          </span>
                        )}
                      </div>
                      {meta.nutritionTags.length > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5">
                          {meta.nutritionTags.map((tag, i) => (
                            <span key={i} className="text-[9px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {meta.cleanDescription && (
                        <p className="text-xs sm:text-sm text-gray-700 font-medium leading-relaxed mt-2 max-w-sm mx-auto">
                          {meta.cleanDescription}
                        </p>
                      )}
                      {meta.customization && meta.customization !== "No options: order as listed" && (
                        <p className="text-[10px] text-gray-500 italic mt-1 max-w-sm mx-auto">
                          {meta.customization}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Quantity Stepper (- 1 +) */}
              <div className="flex items-center justify-center gap-3 py-1">
                <button
                  onClick={() => setModalQuantity((q) => Math.max(1, q - 1))}
                  disabled={modalQuantity <= 1}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="w-8 text-center text-lg font-black text-gray-900">
                  {modalQuantity}
                </span>
                <button
                  onClick={() => setModalQuantity((q) => q + 1)}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-lg flex items-center justify-center transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* PRODUCT CUSTOMIZATIONS / OPTION GROUPS */}
              {(() => {
                const meta = parseProductMetadata(
                  selectedProductForModal.description,
                  selectedProductForModal.is_vegetarian
                );

                if (!meta.optionGroups || meta.optionGroups.length === 0) {
                  return null;
                }

                return (
                  <div className="pt-2 space-y-4">
                    {meta.optionGroups.map((group, gIdx) => {
                      const selectedInGroup =
                        modalCustomizations[group.name] || [];
                      const isSingle = (group.maxPick || 1) === 1;

                      return (
                        <div
                          key={gIdx}
                          className="bg-gray-50/80 border border-gray-200 rounded-2xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-extrabold text-gray-900">
                                {group.name}
                              </h4>
                              <p className="text-[11px] font-medium text-gray-500 mt-0.5">
                                {group.required ? (
                                  <span className="text-red-600 font-bold">
                                    Required • Select {group.maxPick || 1}
                                  </span>
                                ) : (
                                  <span>
                                    Optional • Select up to{" "}
                                    {group.maxPick || group.choices.length}
                                  </span>
                                )}
                              </p>
                            </div>
                            {group.required &&
                              selectedInGroup.length === 0 && (
                                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                                  Required
                                </span>
                              )}
                          </div>

                          <div className="space-y-2">
                            {group.choices.map((choice, cIdx) => {
                              const isSelected = selectedInGroup.some(
                                (c) => c.name === choice.name
                              );

                              return (
                                <button
                                  key={cIdx}
                                  type="button"
                                  onClick={() => {
                                    setModalCustomizations((prev) => {
                                      const current =
                                        prev[group.name] || [];
                                      if (isSingle) {
                                        return {
                                          ...prev,
                                          [group.name]: [choice],
                                        };
                                      } else {
                                        const exists = current.some(
                                          (c) => c.name === choice.name
                                        );
                                        if (exists) {
                                          return {
                                            ...prev,
                                            [group.name]: current.filter(
                                              (c) => c.name !== choice.name
                                            ),
                                          };
                                        } else {
                                          if (
                                            group.maxPick &&
                                            current.length >= group.maxPick
                                          ) {
                                            return prev;
                                          }
                                          return {
                                            ...prev,
                                            [group.name]: [
                                              ...current,
                                              choice,
                                            ],
                                          };
                                        }
                                      }
                                    });
                                  }}
                                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                                      ? "border-red-500 bg-white shadow-xs ring-1 ring-red-500/30"
                                      : "border-gray-200 bg-white hover:border-gray-300"
                                    }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${isSelected
                                          ? "border-red-600 bg-red-600"
                                          : "border-gray-300 bg-white"
                                        }`}
                                    >
                                      {isSelected && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                      )}
                                    </div>
                                    <span
                                      className={`text-xs font-semibold ${isSelected
                                          ? "text-gray-900"
                                          : "text-gray-700"
                                        }`}
                                    >
                                      {choice.name}
                                    </span>
                                  </div>

                                  <span className="text-xs font-bold text-gray-800">
                                    {Number(choice.price) > 0
                                      ? `+${getCurrencySymbol()}${Number(
                                        choice.price
                                      ).toFixed(2)}`
                                      : "Free"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* COMPLETE YOUR MEAL — only Beverages & Desserts from menu */}
              {categories.some(
                (cat) =>
                  /beverage|drink|dessert|sweet/i.test(cat.name) &&
                  products.some(
                    (p) =>
                      p.category_id === cat.id &&
                      p.is_active &&
                      p.id !== selectedProductForModal?.id
                  )
              ) && (
                  <div className="pt-2">
                    <h4 className="text-base font-bold text-[#b91c1c] mb-3">
                      Complete Your Meal
                    </h4>

                    {/* Category Tabs: only Beverages & Desserts */}
                    <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-hide">
                      {categories
                        .filter(
                          (cat) =>
                            /beverage|drink|dessert|sweet/i.test(cat.name) &&
                            products.some(
                              (p) =>
                                p.category_id === cat.id &&
                                p.is_active &&
                                p.id !== selectedProductForModal?.id
                            )
                        )
                        .map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setModalMealTab(cat.id)}
                            className={`py-1.5 px-3 rounded-xl border text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors cursor-pointer ${modalMealTab === cat.id
                                ? "border-red-500 bg-red-50/40 text-red-700 shadow-2xs"
                                : "border-red-200 text-red-600 bg-white hover:bg-red-50/20"
                              }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                    </div>

                    {/* Products from selected category */}
                    <div className="grid grid-cols-2 gap-3 text-left">
                      {products
                        .filter(
                          (p) =>
                            p.category_id === modalMealTab &&
                            p.is_active &&
                            p.id !== selectedProductForModal?.id
                        )
                        .slice(0, 6)
                        .map((p) => {
                          const isSelected = modalSelectedAddons.some(
                            (a) => a.id === p.id
                          );
                          return (
                            <div
                              key={p.id}
                              onClick={() => toggleAddon(p)}
                              className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center relative ${isSelected
                                  ? "border-2 border-red-500 bg-red-50/30 shadow-xs"
                                  : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                            >
                              {isSelected && (
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                                  ✓
                                </div>
                              )}
                              {p.image_url ? (
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="w-16 h-16 object-cover rounded-xl mb-2"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-amber-50 flex items-center justify-center text-2xl mb-2">
                                  {getDietaryType(p, categories) === "veg" ? "🥗" : getDietaryType(p, categories) === "egg" ? "🍳" : "🍗"}
                                </div>
                              )}
                              <div className="text-xs font-bold text-gray-900 leading-tight line-clamp-2">
                                {p.name}
                              </div>
                              <div className="text-sm font-extrabold text-[#ef4444] mt-1">
                                {getCurrencySymbol()}{Number(p.price).toFixed(0)}
                              </div>
                            </div>
                          );
                        })}
                      {products.filter(
                        (p) =>
                          p.category_id === modalMealTab &&
                          p.is_active &&
                          p.id !== selectedProductForModal?.id
                      ).length === 0 && (
                          <p className="col-span-2 text-xs text-gray-400 text-center py-3">
                            No items in this category
                          </p>
                        )}
                    </div>
                  </div>
                )}
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={handleModalAddToCart}
                disabled={isAddingToCart}
                className="w-full py-3.5 px-6 rounded-full bg-[#ef4444] hover:bg-[#dc2626] active:bg-[#b91c1c] text-white font-extrabold text-sm sm:text-base tracking-wide shadow-md transition-all cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAddingToCart ? (
                  <span>Adding to Cart...</span>
                ) : (
                  <span>ADD TO CART • {getCurrencySymbol()}{modalFinalPrice.toFixed(0)}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        SLIDE-IN CART DRAWER (Opens when user clicks on Cart)
        ========================================================================
      */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in">
          {/* Backdrop */}
          <div
            onClick={() => setIsCartDrawerOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              {/* Drawer Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm">
                    🛒
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 leading-tight">
                      Your Cart
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      {orderType === "DINE_IN"
                        ? `Dine In • Table ${tableInfo?.tableNumber || tableId || "—"}`
                        : "Takeaway Order"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cartItems.length === 0 ? (
                  <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center">
                    <span className="text-5xl mb-3">🛍️</span>
                    <h3 className="font-bold text-gray-800 text-base mb-1">
                      Your cart is empty
                    </h3>
                    <p className="text-xs text-gray-500 max-w-xs mb-6">
                      Looks like you haven&apos;t added any items to your order yet.
                    </p>
                    <button
                      onClick={() => setIsCartDrawerOpen(false)}
                      className="px-5 py-2.5 rounded-full bg-[#155e38] hover:bg-[#0e4326] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      Browse Menu
                    </button>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={item.key}
                      className="p-3.5 rounded-2xl border border-gray-100 bg-[#f9fafb] flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-gray-900 truncate">
                          {item.name}
                        </h4>
                        {item.variantName && (
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">
                            {item.variantName}
                          </p>
                        )}
                        <div className="font-extrabold text-sm text-[#ef4444] mt-1">
                          {getCurrencySymbol()}{(item.price * item.quantity).toFixed(0)}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2 py-1 shadow-2xs shrink-0">
                        <button
                          onClick={() => {
                            if (item.quantity > 1) {
                              updateCartItem(
                                restaurantSlug,
                                item.key,
                                item.quantity - 1
                              );
                            } else {
                              removeCartItem(restaurantSlug, item.key);
                            }
                            refreshCartState();
                          }}
                          className="w-6 h-6 rounded-full hover:bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-xs font-black text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => {
                            updateCartItem(
                              restaurantSlug,
                              item.key,
                              item.quantity + 1
                            );
                            refreshCartState();
                          }}
                          className="w-6 h-6 rounded-full hover:bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => {
                          removeCartItem(restaurantSlug, item.key);
                          refreshCartState();
                        }}
                        className="text-gray-400 hover:text-red-500 p-1 text-xs cursor-pointer transition-colors"
                        title="Remove item"
                      >
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Drawer Footer */}
              {cartItems.length > 0 && (
                <div className="p-5 border-t border-gray-100 bg-white shrink-0 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 font-medium">Subtotal</span>
                    <span className="font-black text-base text-gray-900">
                      {getCurrencySymbol()}{cartTotalAmount.toFixed(0)}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setIsCartDrawerOpen(false);
                      router.push(
                        `/restaurant/${restaurantSlug}/checkout${getCustomerContextQuery()}`
                      );
                    }}
                    className="w-full py-3.5 rounded-full bg-[#ef4444] hover:bg-[#dc2626] active:bg-[#b91c1c] text-white font-black text-sm tracking-wide shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>PROCEED TO CHECKOUT • {getCurrencySymbol()}{cartTotalAmount.toFixed(0)}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsCartDrawerOpen(false);
                      router.push(
                        `/restaurant/${restaurantSlug}/cart${getCustomerContextQuery()}`
                      );
                    }}
                    className="w-full py-2 text-center text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                  >
                    View Full Cart Page →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JOIN TABLE MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍽️</span>
                <h3 className="font-extrabold text-base text-gray-900">
                  Join Table
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinError("");
                }}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Enter the 6-character group code shared by your table mates to
              join their order session:
            </p>

            <input
              type="text"
              value={joinCode}
              onChange={(e) =>
                setJoinCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6)
                )
              }
              placeholder="e.g. AB12CD"
              className="w-full uppercase text-center font-mono tracking-widest text-lg font-black border border-gray-300 rounded-xl py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-[#155e38] mb-3"
            />

            {joinError && (
              <div className="text-xs text-red-600 font-semibold mb-3">
                {joinError}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinError("");
                }}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={joinTableByCode}
                disabled={joinLoading || !joinCode.trim()}
                className="flex-1 py-2 rounded-xl bg-[#155e38] hover:bg-[#0e4326] text-white text-xs font-bold transition-colors cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {joinLoading ? "Joining..." : "Join Table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}