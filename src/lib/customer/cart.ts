export type CartItem = {
  cartItemId: string;

  restaurantId: number;
  restaurantSlug: string;

  productId: number;
  productName: string;
  productImage: string | null;

  variantId: number | null;
  variantName: string | null;

  price: number;

  quantity: number;

  isCombo: boolean;
  comboId: number | null;
};

export function getCartKey(
  restaurantSlug: string
) {
  return `soraminds-cart-${restaurantSlug}`;
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
  cart: CartItem[]
) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    getCartKey(restaurantSlug),
    JSON.stringify(cart)
  );

  window.dispatchEvent(
    new Event("soraminds-cart-updated")
  );
}

export function addToCart(
  restaurantSlug: string,
  item: CartItem
) {
  const cart = getCart(restaurantSlug);

  const existingIndex = cart.findIndex(
    (cartItem) =>
      cartItem.productId === item.productId &&
      cartItem.variantId === item.variantId &&
      cartItem.isCombo === item.isCombo &&
      cartItem.comboId === item.comboId
  );

  if (existingIndex >= 0) {
    cart[existingIndex] = {
      ...cart[existingIndex],
      quantity:
        cart[existingIndex].quantity +
        item.quantity,
    };
  } else {
    cart.push(item);
  }

  saveCart(restaurantSlug, cart);
}

export function updateCartQuantity(
  restaurantSlug: string,
  cartItemId: string,
  quantity: number
) {
  const cart = getCart(restaurantSlug);

  if (quantity <= 0) {
    const updated = cart.filter(
      (item) =>
        item.cartItemId !== cartItemId
    );

    saveCart(restaurantSlug, updated);

    return;
  }

  const updated = cart.map((item) =>
    item.cartItemId === cartItemId
      ? {
          ...item,
          quantity,
        }
      : item
  );

  saveCart(restaurantSlug, updated);
}

export function removeFromCart(
  restaurantSlug: string,
  cartItemId: string
) {
  const cart = getCart(restaurantSlug);

  saveCart(
    restaurantSlug,
    cart.filter(
      (item) =>
        item.cartItemId !== cartItemId
    )
  );
}

export function clearCart(
  restaurantSlug: string
) {
  saveCart(restaurantSlug, []);
}

export function getCartCount(
  restaurantSlug: string
) {
  return getCart(restaurantSlug).reduce(
    (total, item) =>
      total + item.quantity,
    0
  );
}

export function getCartTotal(
  restaurantSlug: string
) {
  return getCart(restaurantSlug).reduce(
    (total, item) =>
      total +
      item.price * item.quantity,
    0
  );
}