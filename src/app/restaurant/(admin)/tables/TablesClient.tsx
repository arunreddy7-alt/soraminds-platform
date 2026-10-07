"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Table = {
  id: number;
  restaurant_id: number;
  table_number: string;
  seats: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type StatusFilter = "ALL" | "FREE" | "OCCUPIED" | "RESERVED";

export default function TablesClient() {
  const supabase = createClient();

  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [restaurantId, setRestaurantId] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  const [tableNumber, setTableNumber] = useState("");
  const [seats, setSeats] = useState("2");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  const getRestaurantId = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("You are not authenticated.");
    }

    const { data, error: userError } = await supabase
      .from("users")
      .select("restaurant_id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (userError) {
      throw new Error(userError.message);
    }

    if (!data || !data.restaurant_id || !data.is_active) {
      throw new Error("Restaurant user account is invalid.");
    }

    return data.restaurant_id;
  };

  const loadTables = async () => {
    try {
      setLoading(true);
      setError("");

      const currentRestaurantId = await getRestaurantId();

      setRestaurantId(currentRestaurantId);

      const { data, error: tablesError } = await supabase
        .from("tables")
        .select(
          "id, restaurant_id, table_number, seats, status, created_at, updated_at"
        )
        .eq("restaurant_id", currentRestaurantId)
        .order("table_number", { ascending: true });

      if (tablesError) {
        throw new Error(tablesError.message);
      }

      setTables(data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tables."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const stats = useMemo(() => {
    return {
      total: tables.length,
      free: tables.filter(
        (table) => table.status === "FREE"
      ).length,
      occupied: tables.filter(
        (table) => table.status === "OCCUPIED"
      ).length,
      reserved: tables.filter(
        (table) => table.status === "RESERVED"
      ).length,
    };
  }, [tables]);

  const filteredTables = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return tables.filter((table) => {
      const matchesSearch =
        !searchValue ||
        table.table_number
          .toLowerCase()
          .includes(searchValue) ||
        String(table.id).includes(searchValue);

      const matchesStatus =
        statusFilter === "ALL" ||
        table.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tables, search, statusFilter]);

  const openAddModal = () => {
    setEditingTable(null);
    setTableNumber("");
    setSeats("2");
    setError("");
    setShowModal(true);
  };

  const openEditModal = (table: Table) => {
    setEditingTable(table);
    setTableNumber(table.table_number);
    setSeats(String(table.seats));
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingTable(null);
    setTableNumber("");
    setSeats("2");
  };

  const saveTable = async () => {
    const trimmedNumber = tableNumber.trim();
    const seatCount = Number(seats);

    if (!trimmedNumber) {
      setError("Table number is required.");
      return;
    }

    if (!Number.isInteger(seatCount) || seatCount < 1) {
      setError("Seats must be at least 1.");
      return;
    }

    if (!restaurantId) {
      setError("Restaurant could not be identified.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingTable) {
        const { error: updateError } = await supabase
          .from("tables")
          .update({
            table_number: trimmedNumber,
            seats: seatCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTable.id)
          .eq("restaurant_id", restaurantId);

        if (updateError) {
          throw new Error(updateError.message);
        }
      } else {
        const { error: insertError } = await supabase
          .from("tables")
          .insert({
            restaurant_id: restaurantId,
            table_number: trimmedNumber,
            seats: seatCount,
            status: "FREE",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      closeModal();
      await loadTables();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save table."
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (
    table: Table,
    newStatus: string
  ) => {
    if (!restaurantId) return;

    try {
      setError("");

      const { error: updateError } = await supabase
        .from("tables")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", table.id)
        .eq("restaurant_id", restaurantId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setTables((current) =>
        current.map((item) =>
          item.id === table.id
            ? {
                ...item,
                status: newStatus,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update table status."
      );
    }
  };

  const deleteTable = async (table: Table) => {
    if (!restaurantId) return;

    const confirmed = window.confirm(
      `Delete Table ${table.table_number}?`
    );

    if (!confirmed) return;

    try {
      setError("");

      const { error: deleteError } = await supabase
        .from("tables")
        .delete()
        .eq("id", table.id)
        .eq("restaurant_id", restaurantId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setTables((current) =>
        current.filter((item) => item.id !== table.id)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete table."
      );
    }
  };

  const getStatusStyle = (status: string) => {
    if (status === "FREE") {
      return {
        background: "#ecfdf3",
        color: "#027a48",
      };
    }

    if (status === "OCCUPIED") {
      return {
        background: "#fff1f0",
        color: "#d92d20",
      };
    }

    return {
      background: "#fffaeb",
      color: "#b54708",
    };
  };

  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: "700",
              color: "#202228",
            }}
          >
            Tables
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            Manage restaurant tables and their availability.
          </p>
        </div>

        <button
          onClick={openAddModal}
          style={{
            border: "none",
            background: "#202228",
            color: "#fff",
            padding: "11px 18px",
            borderRadius: "9px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          + Add Table
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 14px",
            borderRadius: "9px",
            background: "#fff1f0",
            border: "1px solid #fecdca",
            color: "#b42318",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "14px",
          marginBottom: "22px",
        }}
      >
        {[
          ["Total Tables", stats.total, "#202228"],
          ["Free", stats.free, "#027a48"],
          ["Occupied", stats.occupied, "#d92d20"],
          ["Reserved", stats.reserved, "#b54708"],
        ].map(([label, value, color]) => (
          <div
            key={String(label)}
            style={{
              background: "#fff",
              border: "1px solid #eaecf0",
              borderRadius: "12px",
              padding: "18px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#858a94",
                marginBottom: "8px",
              }}
            >
              {label}
            </div>

            <div
              style={{
                fontSize: "25px",
                fontWeight: "700",
                color: String(color),
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "18px",
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search table number..."
          style={{
            flex: "1 1 240px",
            minWidth: "220px",
            boxSizing: "border-box",
            padding: "10px 12px",
            border: "1px solid #d0d5dd",
            borderRadius: "8px",
            outline: "none",
            fontSize: "12px",
            background: "#fff",
          }}
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value as StatusFilter
            )
          }
          style={{
            padding: "10px 12px",
            border: "1px solid #d0d5dd",
            borderRadius: "8px",
            background: "#fff",
            color: "#344054",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          <option value="ALL">All Status</option>
          <option value="FREE">Free</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="RESERVED">Reserved</option>
        </select>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #eaecf0",
          borderRadius: "13px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #eaecf0",
            fontSize: "15px",
            fontWeight: "600",
            color: "#202228",
          }}
        >
          Restaurant Tables
        </div>

        {loading ? (
          <div
            style={{
              padding: "55px 20px",
              textAlign: "center",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            Loading tables...
          </div>
        ) : filteredTables.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            <div
              style={{
                fontSize: "32px",
                marginBottom: "10px",
              }}
            >
              🪑
            </div>

            <div
              style={{
                color: "#202228",
                fontWeight: "600",
                marginBottom: "5px",
              }}
            >
              {tables.length === 0
                ? "No tables yet"
                : "No matching tables"}
            </div>

            <div>
              {tables.length === 0
                ? "Add your first restaurant table to get started."
                : "Try changing your search or status filter."}
            </div>
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#fafafa",
                    borderBottom: "1px solid #eaecf0",
                  }}
                >
                  {[
                    "Table",
                    "Seats",
                    "Status",
                    "Table ID",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
                        padding: "13px 20px",
                        fontSize: "11px",
                        color: "#858a94",
                        fontWeight: "600",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredTables.map((table) => (
                  <tr
                    key={table.id}
                    style={{
                      borderBottom: "1px solid #f0f1f3",
                    }}
                  >
                    <td
                      style={{
                        padding: "16px 20px",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#202228",
                      }}
                    >
                      Table {table.table_number}
                    </td>

                    <td
                      style={{
                        padding: "16px 20px",
                        fontSize: "13px",
                        color: "#555b66",
                      }}
                    >
                      {table.seats}
                    </td>

                    <td
                      style={{
                        padding: "16px 20px",
                      }}
                    >
                      <span
                        style={{
                          ...getStatusStyle(table.status),
                          display: "inline-block",
                          padding: "5px 9px",
                          borderRadius: "20px",
                          fontSize: "11px",
                          fontWeight: "600",
                        }}
                      >
                        {table.status}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "16px 20px",
                        fontSize: "12px",
                        color: "#858a94",
                      }}
                    >
                      #{table.id}
                    </td>

                    <td
                      style={{
                        padding: "16px 20px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => openEditModal(table)}
                          style={{
                            border: "1px solid #d0d5dd",
                            background: "#fff",
                            color: "#344054",
                            padding: "7px 10px",
                            borderRadius: "7px",
                            cursor: "pointer",
                            fontSize: "11px",
                          }}
                        >
                          Edit
                        </button>

                        <select
                          value={table.status}
                          onChange={(event) =>
                            changeStatus(
                              table,
                              event.target.value
                            )
                          }
                          style={{
                            border: "1px solid #d0d5dd",
                            background: "#fff",
                            color: "#344054",
                            padding: "7px 8px",
                            borderRadius: "7px",
                            cursor: "pointer",
                            fontSize: "11px",
                          }}
                        >
                          <option value="FREE">Free</option>
                          <option value="OCCUPIED">
                            Occupied
                          </option>
                          <option value="RESERVED">
                            Reserved
                          </option>
                        </select>

                        <button
                          onClick={() => deleteTable(table)}
                          style={{
                            border: "1px solid #fecdca",
                            background: "#fff",
                            color: "#d92d20",
                            padding: "7px 10px",
                            borderRadius: "7px",
                            cursor: "pointer",
                            fontSize: "11px",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16, 24, 40, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#fff",
              borderRadius: "14px",
              padding: "24px",
              boxSizing: "border-box",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "#202228",
                fontSize: "18px",
              }}
            >
              {editingTable ? "Edit Table" : "Add Table"}
            </h3>

            <p
              style={{
                margin: "7px 0 22px",
                color: "#858a94",
                fontSize: "12px",
              }}
            >
              {editingTable
                ? "Update the table details."
                : "Add a new table to your restaurant."}
            </p>

            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "600",
                color: "#344054",
                marginBottom: "7px",
              }}
            >
              Table Number
            </label>

            <input
              value={tableNumber}
              onChange={(event) =>
                setTableNumber(event.target.value)
              }
              placeholder="e.g. 1, 2, A1"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 12px",
                border: "1px solid #d0d5dd",
                borderRadius: "8px",
                outline: "none",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            />

            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "600",
                color: "#344054",
                marginBottom: "7px",
              }}
            >
              Number of Seats
            </label>

            <input
              type="number"
              min="1"
              max="100"
              value={seats}
              onChange={(event) =>
                setSeats(event.target.value)
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 12px",
                border: "1px solid #d0d5dd",
                borderRadius: "8px",
                outline: "none",
                fontSize: "13px",
                marginBottom: "24px",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "9px",
              }}
            >
              <button
                onClick={closeModal}
                disabled={saving}
                style={{
                  border: "1px solid #d0d5dd",
                  background: "#fff",
                  color: "#344054",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Cancel
              </button>

              <button
                onClick={saveTable}
                disabled={saving}
                style={{
                  border: "none",
                  background: "#202228",
                  color: "#fff",
                  padding: "10px 17px",
                  borderRadius: "8px",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editingTable
                  ? "Update Table"
                  : "Add Table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}