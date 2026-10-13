
"use client";

import { useEffect, useState } from "react";
import type { DeliveryPricingTier } from "@/lib/delivery-pricing";

type DeliverySettings = {
  is_enabled: boolean;
  delivery_fee: number;
  free_delivery_minimum: number | null;
  minimum_order_amount: number;
  estimated_delivery_minutes: number;
  origin_latitude: number | null;
  origin_longitude: number | null;
  delivery_address: string;
  max_delivery_distance_km: number;
  pricing_tiers: DeliveryPricingTier[];
  fee_0_3_km: number;
  fee_3_5_km: number;
  fee_5_10_km: number;
};

const defaults: DeliverySettings = {
  is_enabled: false,
  delivery_fee: 0,
  free_delivery_minimum: null,
  minimum_order_amount: 0,
  estimated_delivery_minutes: 40,
  origin_latitude: null,
  origin_longitude: null,
  delivery_address: "",
  max_delivery_distance_km: 10,
  pricing_tiers: [
    { min_km: 0, max_km: 3, fee: 60 },
    { min_km: 3, max_km: 7, fee: 100 },
    { min_km: 7, max_km: null, fee: 150 },
  ],
  fee_0_3_km: 30,
  fee_3_5_km: 50,
  fee_5_10_km: 80,
};

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-black focus:ring-1 focus:ring-black";

const labelClass = "block text-sm font-medium text-gray-700";

export default function DeliverySettingsPage() {
  const [settings, setSettings] = useState<DeliverySettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);

        const response = await fetch(
          "/api/restaurant/delivery/settings",
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load delivery settings");
        }

        const saved = data.settings ?? data;

        setSettings({
          ...defaults,
          ...saved,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function updateSetting<K extends keyof DeliverySettings>(
    key: K,
    value: DeliverySettings[K]
  ) {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function updateNumber(
    key: keyof DeliverySettings,
    value: string
  ) {
    if (value.trim() === "") {
      if (
        key === "origin_latitude" ||
        key === "origin_longitude" ||
        key === "free_delivery_minimum"
      ) {
        setSettings((previous) => ({
          ...previous,
          [key]: null,
        }));
      }

      return;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) return;

    setSettings((previous) => ({
      ...previous,
      [key]: number,
    }));
  }

  function updateTier(
    index: number,
    key: keyof DeliveryPricingTier,
    value: string
  ) {
    setSettings((previous) => ({
      ...previous,
      pricing_tiers: previous.pricing_tiers.map((tier, tierIndex) =>
        tierIndex === index
          ? {
              ...tier,
              [key]:
                key === "max_km" && value.trim() === ""
                  ? null
                  : Number(value),
            }
          : tier
      ),
    }));
  }

  function addTier() {
    setSettings((previous) => {
      const last = previous.pricing_tiers[previous.pricing_tiers.length - 1];
      return {
        ...previous,
        pricing_tiers: [
          ...previous.pricing_tiers,
          {
            min_km: last?.max_km ?? previous.max_delivery_distance_km,
            max_km: null,
            fee: 0,
          },
        ],
      };
    });
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (
      settings.origin_latitude === null ||
      settings.origin_longitude === null
    ) {
      setError("Enter the restaurant's latitude and longitude first.");
      return;
    }

    if (
      settings.origin_latitude < -90 ||
      settings.origin_latitude > 90 ||
      settings.origin_longitude < -180 ||
      settings.origin_longitude > 180
    ) {
      setError("Enter valid restaurant coordinates.");
      return;
    }

    if (
      settings.fee_0_3_km < 0 ||
      settings.fee_3_5_km < 0 ||
      settings.fee_5_10_km < 0
    ) {
      setError("Delivery fees cannot be negative.");
      return;
    }

    if (
      settings.minimum_order_amount < 0 ||
      settings.estimated_delivery_minutes < 1
    ) {
      setError("Check the minimum order amount and estimated delivery time.");
      return;
    }

    if (
      settings.max_delivery_distance_km <= 0 ||
      settings.pricing_tiers.length === 0
    ) {
      setError(
        "Configure a valid maximum distance and at least one pricing tier."
      );
      return;
    }

    try {
      setSaving(true);

      
const payload = {
  is_enabled: settings.is_enabled,
  delivery_fee: settings.delivery_fee,
  free_delivery_minimum: settings.free_delivery_minimum,
  minimum_order_amount: settings.minimum_order_amount,
  estimated_delivery_minutes: settings.estimated_delivery_minutes,
  origin_latitude: settings.origin_latitude,
  origin_longitude: settings.origin_longitude,
  fee_0_3_km: settings.fee_0_3_km,
  fee_3_5_km: settings.fee_3_5_km,
  fee_5_10_km: settings.fee_5_10_km,
  delivery_address: settings.delivery_address,
  max_delivery_distance_km: settings.max_delivery_distance_km,
  pricing_tiers: settings.pricing_tiers,
};

const response = await fetch("/api/restaurant/delivery/settings", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});


      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save delivery settings");
      }

      const saved = data.settings ?? data;

      setSettings((previous) => ({
        ...previous,
        ...saved,
      }));

      setMessage("Delivery settings saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-sm text-gray-500">
          Loading delivery settings...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Delivery Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure your delivery service, restaurant location, and distance-based fees.
        </p>
      </div>

      {message && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={saveSettings} className="space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">
                Delivery availability
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Enable or disable delivery for your restaurant.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.is_enabled}
              onClick={() =>
                updateSetting("is_enabled", !settings.is_enabled)
              }
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                settings.is_enabled ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                  settings.is_enabled ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          <p className="mt-3 text-sm font-medium">
            {settings.is_enabled ? (
              <span className="text-green-700">Delivery enabled</span>
            ) : (
              <span className="text-gray-500">Delivery disabled</span>
            )}
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">
                Dynamic distance pricing
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Add contiguous tiers that cover the complete delivery radius.
              </p>
            </div>
            <button
              type="button"
              onClick={addTier}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
            >
              Add tier
            </button>
          </div>

          <div>
            <label htmlFor="maxDistance" className={labelClass}>
              Maximum delivery distance (km)
            </label>
            <input
              id="maxDistance"
              type="number"
              min="0.1"
              step="0.1"
              value={settings.max_delivery_distance_km}
              onChange={(event) =>
                updateNumber("max_delivery_distance_km", event.target.value)
              }
              className={inputClass}
            />
          </div>

          <div className="space-y-3">
            {settings.pricing_tiers.map((tier, index) => (
              <div
                key={`${index}-${tier.min_km}`}
                className="grid gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <label className="text-xs text-gray-500">
                  Minimum km
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={tier.min_km}
                    onChange={(event) =>
                      updateTier(index, "min_km", event.target.value)
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-xs text-gray-500">
                  Maximum km
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={tier.max_km ?? ""}
                    onChange={(event) =>
                      updateTier(index, "max_km", event.target.value)
                    }
                    placeholder="Final tier"
                    className={inputClass}
                  />
                </label>
                <label className="text-xs text-gray-500">
                  Fee (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tier.fee}
                    onChange={(event) =>
                      updateTier(index, "fee", event.target.value)
                    }
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  disabled={settings.pricing_tiers.length === 1}
                  onClick={() =>
                    setSettings((previous) => ({
                      ...previous,
                      pricing_tiers: previous.pricing_tiers.filter(
                        (_, tierIndex) => tierIndex !== index
                      ),
                    }))
                  }
                  className="self-end rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-semibold text-gray-900">
              Restaurant location
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Set the coordinates used to calculate the road distance to customers.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="deliveryAddress" className={labelClass}>
                Restaurant delivery address
              </label>
              <input
                id="deliveryAddress"
                type="text"
                value={settings.delivery_address}
                onChange={(event) =>
                  updateSetting("delivery_address", event.target.value)
                }
                placeholder="Address used as the delivery origin"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="latitude" className={labelClass}>
                Latitude
              </label>
              <input
                id="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                required
                value={settings.origin_latitude ?? ""}
                onChange={(e) =>
                  updateNumber("origin_latitude", e.target.value)
                }
                placeholder="e.g. 17.3850"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="longitude" className={labelClass}>
                Longitude
              </label>
              <input
                id="longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                required
                value={settings.origin_longitude ?? ""}
                onChange={(e) =>
                  updateNumber("origin_longitude", e.target.value)
                }
                placeholder="e.g. 78.4867"
                className={inputClass}
              />
            </div>
          </div>

          <a
            href="https://www.google.com/maps"
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm font-medium text-blue-600 underline"
          >
            Find restaurant coordinates on Google Maps
          </a>

          <p className="text-xs text-gray-500">
            On Google Maps, right-click the restaurant location to view its
            coordinates. Copy the first number into Latitude and the second
            into Longitude.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-semibold text-gray-900">
              Distance-based delivery fees
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Set the fees your restaurant wants to charge for each distance band.
              These values are saved in your database.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700">
                0–3 km
              </p>
              <label htmlFor="fee03" className="mt-3 block text-xs text-gray-500">
                Delivery fee (₹)
              </label>
              <input
                id="fee03"
                type="number"
                min="0"
                step="0.01"
                required
                value={settings.fee_0_3_km}
                onChange={(e) =>
                  updateNumber("fee_0_3_km", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700">
                Above 3 km–5 km
              </p>
              <label htmlFor="fee35" className="mt-3 block text-xs text-gray-500">
                Delivery fee (₹)
              </label>
              <input
                id="fee35"
                type="number"
                min="0"
                step="0.01"
                required
                value={settings.fee_3_5_km}
                onChange={(e) =>
                  updateNumber("fee_3_5_km", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700">
                Above 5 km–10 km
              </p>
              <label htmlFor="fee510" className="mt-3 block text-xs text-gray-500">
                Delivery fee (₹)
              </label>
              <input
                id="fee510"
                type="number"
                min="0"
                step="0.01"
                required
                value={settings.fee_5_10_km}
                onChange={(e) =>
                  updateNumber("fee_5_10_km", e.target.value)
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            Customers more than 10 km away will not be eligible for delivery.
            Distance must be calculated using road routes, not straight-line distance.
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900">
            Other delivery settings
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="minimumOrder" className={labelClass}>
                Minimum order amount (₹)
              </label>
              <input
                id="minimumOrder"
                type="number"
                min="0"
                step="0.01"
                required
                value={settings.minimum_order_amount}
                onChange={(e) =>
                  updateNumber("minimum_order_amount", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="eta" className={labelClass}>
                Estimated delivery time (minutes)
              </label>
              <input
                id="eta"
                type="number"
                min="1"
                step="1"
                required
                value={settings.estimated_delivery_minutes}
                onChange={(e) =>
                  updateNumber("estimated_delivery_minutes", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="legacyFee" className={labelClass}>
                Default delivery fee (₹)
              </label>
              <input
                id="legacyFee"
                type="number"
                min="0"
                step="0.01"
                required
                value={settings.delivery_fee}
                onChange={(e) =>
                  updateNumber("delivery_fee", e.target.value)
                }
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-500">
                Legacy setting; distance-based fees should be used for new
                delivery orders.
              </p>
            </div>

            <div>
              <label htmlFor="freeMinimum" className={labelClass}>
                Free delivery above (₹, optional)
              </label>
              <input
                id="freeMinimum"
                type="number"
                min="0"
                step="0.01"
                value={settings.free_delivery_minimum ?? ""}
                onChange={(e) =>
                  updateNumber("free_delivery_minimum", e.target.value)
                }
                placeholder="Leave empty to disable"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Changes apply after you save the settings.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save delivery settings"}
          </button>
        </div>
      </form>
    </main>
  );
}
