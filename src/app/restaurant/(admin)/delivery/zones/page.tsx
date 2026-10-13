"use client";

import { useCallback, useEffect, useState } from "react";

type DeliveryZone = {
  id: number;
  restaurant_id: number;
  name: string;
  pincodes: string[];
  delivery_fee: number;
  estimated_delivery_minutes: number;
  is_active: boolean;
  created_at?: string;
};

const emptyForm = {
  name: "",
  pincodes: "",
  delivery_fee: "0",
  estimated_delivery_minutes: "45",
  is_active: true,
};

export default function DeliveryZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [success, setSuccess] = useState("");

  const loadZones = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const response = await fetch("/api/restaurant/delivery/zones", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load delivery zones");
      }

      setZones(result.zones ?? []);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadZones();
  }, [loadZones]);

  function updateField(
    field: keyof typeof emptyForm,
    value: string | boolean
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEditing(zone: DeliveryZone) {
    setEditingId(zone.id);
    setForm({
      name: zone.name,
      pincodes: zone.pincodes.join(", "),
      delivery_fee: String(zone.delivery_fee),
      estimated_delivery_minutes: String(
        zone.estimated_delivery_minutes
      ),
      is_active: zone.is_active,
    });

    setPageError("");
    setSuccess("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setPageError("");
    setSuccess("");

    const pincodes = [
      ...new Set(
        form.pincodes
          .split(/[\s,;]+/)
          .map((pincode) => pincode.trim())
          .filter(Boolean)
      ),
    ];

    if (!form.name.trim()) {
      setPageError("Enter a delivery zone name.");
      setSaving(false);
      return;
    }

    if (
      pincodes.length === 0 ||
      pincodes.some((pincode) => !/^[0-9]{6}$/.test(pincode))
    ) {
      setPageError("Enter valid six-digit Indian pincodes.");
      setSaving(false);
      return;
    }

    const deliveryFee = Number(form.delivery_fee);
    const estimatedMinutes = Number(form.estimated_delivery_minutes);

    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      setPageError("Delivery fee cannot be negative.");
      setSaving(false);
      return;
    }

    if (
      !Number.isInteger(estimatedMinutes) ||
      estimatedMinutes < 1 ||
      estimatedMinutes > 1440
    ) {
      setPageError("Delivery time must be between 1 and 1440 minutes.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        pincodes,
        delivery_fee: deliveryFee,
        estimated_delivery_minutes: estimatedMinutes,
        is_active: form.is_active,
      };

      const response = await fetch("/api/restaurant/delivery/zones", {
        method: editingId === null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId === null ? payload : { id: editingId, ...payload }
        ),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save delivery zone");
      }

      setSuccess(
        editingId === null
          ? "Delivery zone created successfully."
          : "Delivery zone updated successfully."
      );

      resetForm();
      await loadZones();
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleZone(zone: DeliveryZone) {
    setPageError("");
    setSuccess("");

    try {
      const response = await fetch("/api/restaurant/delivery/zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: zone.id,
          is_active: !zone.is_active,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update zone");
      }

      setSuccess(
        `${zone.name} ${zone.is_active ? "deactivated" : "activated"}.`
      );

      await loadZones();
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    }
  }

  async function deleteZone(zone: DeliveryZone) {
    const confirmed = window.confirm(
      `Delete "${zone.name}"? This may be blocked if existing delivery records reference this zone.`
    );

    if (!confirmed) return;

    setPageError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/restaurant/delivery/zones?id=${zone.id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete zone");
      }

      setSuccess(`${zone.name} deleted successfully.`);

      if (editingId === zone.id) resetForm();

      await loadZones();
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    }
  }

  const activeCount = zones.filter((zone) => zone.is_active).length;
  const totalPincodes = new Set(
    zones.flatMap((zone) => zone.pincodes ?? [])
  ).size;

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-orange-600">
              DELIVERY MANAGEMENT
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Delivery Zones
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage serviceable pincodes, delivery charges, and estimated
              delivery times.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setPageError("");
              setSuccess("");
            }}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-100"
          >
            + New Zone
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Zones" value={zones.length} />
          <StatCard label="Active Zones" value={activeCount} />
          <StatCard label="Unique Pincodes" value={totalPincodes} />
        </div>

        {pageError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {pageError}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
          >
            {success}
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold">
              {editingId === null ? "Create Delivery Zone" : "Edit Delivery Zone"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Add one or more pincodes separated by commas, spaces, or new
              lines.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="zone-name"
                  className="mb-2 block text-sm font-medium"
                >
                  Zone Name
                </label>
                <input
                  id="zone-name"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="e.g. Gachibowli Zone"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label
                  htmlFor="zone-pincodes"
                  className="mb-2 block text-sm font-medium"
                >
                  Serviceable Pincodes
                </label>
                <textarea
                  id="zone-pincodes"
                  required
                  rows={3}
                  value={form.pincodes}
                  onChange={(event) =>
                    updateField("pincodes", event.target.value)
                  }
                  placeholder="500032, 500033, 500034"
                  className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Each pincode must contain exactly six digits.
                </p>
              </div>

              <div>
                <label
                  htmlFor="delivery-fee"
                  className="mb-2 block text-sm font-medium"
                >
                  Delivery Fee (₹)
                </label>
                <input
                  id="delivery-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.delivery_fee}
                  onChange={(event) =>
                    updateField("delivery_fee", event.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label
                  htmlFor="delivery-time"
                  className="mb-2 block text-sm font-medium"
                >
                  Estimated Delivery Time (minutes)
                </label>
                <input
                  id="delivery-time"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  required
                  value={form.estimated_delivery_minutes}
                  onChange={(event) =>
                    updateField(
                      "estimated_delivery_minutes",
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) =>
                  updateField("is_active", event.target.checked)
                }
                className="h-4 w-4 accent-orange-600"
              />
              <span>
                <span className="block text-sm font-semibold">
                  Zone is active
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  Active zones can be considered for delivery checkout.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId === null
                    ? "Create Zone"
                    : "Save Changes"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold hover:bg-gray-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 p-5">
            <div>
              <h2 className="text-lg font-bold">Configured Zones</h2>
              <p className="mt-1 text-sm text-gray-500">
                Review and manage your delivery coverage.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadZones()}
              disabled={loading}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Loading delivery zones...
            </div>
          ) : zones.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-3xl">📍</div>
              <h3 className="mt-3 font-semibold">No delivery zones yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create your first zone to configure your delivery coverage.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {zones.map((zone) => (
                <article
                  key={zone.id}
                  className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{zone.name}</h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          zone.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {zone.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <p className="mt-2 break-words text-sm text-gray-600">
                      {zone.pincodes?.join(", ") || "No pincodes"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500">
                      <span>
                        Fee:{" "}
                        <strong className="text-gray-900">
                          ₹{Number(zone.delivery_fee).toFixed(2)}
                        </strong>
                      </span>
                      <span>
                        ETA:{" "}
                        <strong className="text-gray-900">
                          {zone.estimated_delivery_minutes} min
                        </strong>
                      </span>
                      <span>
                        {zone.pincodes?.length ?? 0} pincodes
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(zone)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleZone(zone)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      {zone.is_active ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteZone(zone)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
