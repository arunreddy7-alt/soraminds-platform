export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  SGD: "S$",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  SAR: "﷼",
};

export const CURRENCY_OPTIONS = [
  { code: "INR", symbol: "₹", label: "₹ INR — Indian Rupee" },
  { code: "USD", symbol: "$", label: "$ USD — US Dollar" },
  { code: "EUR", symbol: "€", label: "€ EUR — Euro" },
  { code: "GBP", symbol: "£", label: "£ GBP — British Pound" },
  { code: "AED", symbol: "د.إ", label: "د.إ AED — UAE Dirham" },
  { code: "CAD", symbol: "C$", label: "C$ CAD — Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "A$ AUD — Australian Dollar" },
  { code: "SGD", symbol: "S$", label: "S$ SGD — Singapore Dollar" },
];

export function getCurrencySymbol(code?: string | null): string {
  if (!code) return "₹";
  const upper = code.trim().toUpperCase();
  return CURRENCY_SYMBOLS[upper] ?? `${upper} `;
}

export function formatCurrency(value: number, currencyCode?: string | null): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${Number(value || 0).toFixed(2)}`;
}

export function formatPrice(value: number, currencyCode?: string | null): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${Number(value || 0).toFixed(0)}`;
}
