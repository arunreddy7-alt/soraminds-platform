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
    const stored = localStorage.getItem(
      getCartKey(restaurantSlug)
    );

    if (!stored) {
      return [];
    }

    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveCart(
  restaurantSlug: string,
  items: CartItem[]
) {
  localStorage.setItem(
    getCartKey(restaurantSlug),
    JSON.stringify(items)
  );
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
  localStorage.removeItem(
    getCartKey(restaurantSlug)
  );
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