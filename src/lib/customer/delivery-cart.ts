import type { CartItem } from "@/lib/cart";

export type DeliveryCartItem = CartItem;

export function getDeliveryCartKey(
  restaurantSlug: string
) {
  return `soraminds_delivery_cart_${restaurantSlug}`;
}

export function getDeliveryCart(
  restaurantSlug: string
): DeliveryCartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(
      getDeliveryCartKey(restaurantSlug)
    );

    if (!stored) {
      return [];
    }

    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveDeliveryCart(
  restaurantSlug: string,
  items: DeliveryCartItem[]
) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    getDeliveryCartKey(restaurantSlug),
    JSON.stringify(items)
  );

  window.dispatchEvent(
    new Event("soraminds-delivery-cart-updated")
  );
}

export function addToDeliveryCart(
  restaurantSlug: string,
  item: DeliveryCartItem
) {
  const cart = getDeliveryCart(restaurantSlug);

  const existingIndex = cart.findIndex(
    (cartItem) => cartItem.key === item.key
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

  saveDeliveryCart(restaurantSlug, cart);

  return cart;
}

export function updateDeliveryCartItem(
  restaurantSlug: string,
  key: string,
  quantity: number
) {
  const cart = getDeliveryCart(restaurantSlug);

  const updated = cart
    .map((item) =>
      item.key === key
        ? { ...item, quantity }
        : item
    )
    .filter((item) => item.quantity > 0);

  saveDeliveryCart(restaurantSlug, updated);

  return updated;
}

export function removeDeliveryCartItem(
  restaurantSlug: string,
  key: string
) {
  const updated = getDeliveryCart(
    restaurantSlug
  ).filter((item) => item.key !== key);

  saveDeliveryCart(restaurantSlug, updated);

  return updated;
}

export function clearDeliveryCart(
  restaurantSlug: string
) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(
    getDeliveryCartKey(restaurantSlug)
  );

  window.dispatchEvent(
    new Event("soraminds-delivery-cart-updated")
  );
}

export function getDeliveryCartTotal(
  items: DeliveryCartItem[]
) {
  return items.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );
}

export function getDeliveryCartCount(
  restaurantSlug: string
) {
  return getDeliveryCart(
    restaurantSlug
  ).reduce(
    (total, item) => total + item.quantity,
    0
  );
}