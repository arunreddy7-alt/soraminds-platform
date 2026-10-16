export type CartItem = {
  key: string;
  productId: number;
  productSlug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  quantity: number;
  variantId: number | null;
  variantName: string | null;
};

export function getCartKey(
  restaurantSlug: string
) {
  return `soraminds_cart_${restaurantSlug}`;
}

export function getCart(
  restaurantSlug: string
): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const underscoreStored = localStorage.getItem(
      getCartKey(restaurantSlug)
    );

    if (underscoreStored) {
      const parsed = JSON.parse(underscoreStored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Fallback to hyphenated key
    const hyphenStored = localStorage.getItem(
      `soraminds-cart-${restaurantSlug}`
    );
    if (hyphenStored) {
      const parsed = JSON.parse(hyphenStored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          key: item.key || item.cartItemId || `${item.productId}-${Date.now()}`,
          productId: item.productId,
          productSlug: item.productSlug || "",
          name: item.name || item.productName || "Dish",
          imageUrl: item.imageUrl || item.productImage || null,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
          variantId: item.variantId ?? null,
          variantName: item.variantName ?? null,
        }));
      }
    }

    return [];
  } catch {
    return [];
  }
}

export function saveCart(
  restaurantSlug: string,
  items: CartItem[]
) {
  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(items);
  localStorage.setItem(getCartKey(restaurantSlug), serialized);

  // Sync to hyphenated key with matching fields
  localStorage.setItem(
    `soraminds-cart-${restaurantSlug}`,
    JSON.stringify(
      items.map((item) => ({
        cartItemId: item.key,
        restaurantId: 0,
        restaurantSlug,
        productId: item.productId,
        productSlug: item.productSlug,
        productName: item.name,
        productImage: item.imageUrl,
        variantId: item.variantId,
        variantName: item.variantName,
        price: item.price,
        quantity: item.quantity,
        isCombo: false,
        comboId: null,
      }))
    )
  );

  window.dispatchEvent(new Event("soraminds-cart-updated"));
}

export function addToCart(
  restaurantSlug: string,
  item: CartItem
) {
  const cart = getCart(restaurantSlug);

  const existingIndex = cart.findIndex(
    (cartItem) => cartItem.key === item.key
  );

  if (existingIndex >= 0) {
    cart[existingIndex].quantity +=
      item.quantity;
  } else {
    cart.push(item);
  }

  saveCart(restaurantSlug, cart);

  return cart;
}

export function updateCartItem(
  restaurantSlug: string,
  key: string,
  quantity: number
) {
  const cart = getCart(restaurantSlug);

  const updated = cart
    .map((item) =>
      item.key === key
        ? {
            ...item,
            quantity,
          }
        : item
    )
    .filter((item) => item.quantity > 0);

  saveCart(
    restaurantSlug,
    updated
  );

  return updated;
}

export function removeCartItem(
  restaurantSlug: string,
  key: string
) {
  const cart = getCart(restaurantSlug);

  const updated = cart.filter(
    (item) => item.key !== key
  );

  saveCart(
    restaurantSlug,
    updated
  );

  return updated;
}

export function clearCart(
  restaurantSlug: string
) {
  localStorage.removeItem(getCartKey(restaurantSlug));
  // Also clear the hyphenated key that saveCart writes to
  localStorage.removeItem(`soraminds-cart-${restaurantSlug}`);
  // Notify any open storefront pages to refresh their cart state
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("soraminds-cart-updated"));
  }
}

export function getCartTotal(
  items: CartItem[]
) {
  return items.reduce(
    (total, item) =>
      total +
      item.price * item.quantity,
    0
  );
}

export function getCartCount(
  items: CartItem[]
) {
  return items.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );
}