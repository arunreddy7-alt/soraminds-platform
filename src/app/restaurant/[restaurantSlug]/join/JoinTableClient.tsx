"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function JoinTableClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const restaurantSlug =
    typeof params.restaurantSlug === "string"
      ? params.restaurantSlug
      : "";

  const tableIdParam = searchParams.get("tableId");

  const tableId = tableIdParam
    ? Number(tableIdParam)
    : null;

  const [mode, setMode] = useState<
    "SELECT" | "EXISTING"
  >("SELECT");

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const joinNewTable = async () => {
    if (!restaurantSlug || !tableId) {
      setError("Invalid table information.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/customer/table-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            restaurantSlug,
            tableId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to join table."
        );
      }

      const session = data.session;
      const table = data.table;

      localStorage.setItem(
        `soraminds-table-session-${restaurantSlug}`,
        JSON.stringify({
          sessionId: session.id,
          tableId: table.id,
          tableNumber: table.tableNumber,
          groupCode: session.group_code,
        })
      );

      const query = new URLSearchParams();

      query.set("orderType", "DINE_IN");
      query.set("tableId", String(table.id));
      query.set("sessionId", String(session.id));

      router.push(
        `/restaurant/${restaurantSlug}?${query.toString()}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to join table."
      );
    } finally {
      setLoading(false);
    }
  };

  const joinExistingTable = async () => {
    const trimmedCode = code.trim().toUpperCase();

    if (!restaurantSlug) {
      setError("Invalid restaurant.");
      return;
    }

    if (!trimmedCode) {
      setError("Please enter the table code.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/customer/table-session/join",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            restaurantSlug,
            groupCode: trimmedCode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to join table."
        );
      }

      const session = data.session;
      const table = data.table;

      localStorage.setItem(
        `soraminds-table-session-${restaurantSlug}`,
        JSON.stringify({
          sessionId: session.id,
          tableId: table.id,
          tableNumber: table.tableNumber,
          groupCode: session.group_code,
        })
      );

      const query = new URLSearchParams();

      query.set("orderType", "DINE_IN");
      query.set("tableId", String(table.id));
      query.set("sessionId", String(session.id));

      router.push(
        `/restaurant/${restaurantSlug}?${query.toString()}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to join table."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (
    value: string
  ) => {
    setCode(
      value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6)
    );
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f9fb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#fff",
          border: "1px solid #eaecf0",
          borderRadius: "16px",
          padding: "28px",
          boxSizing: "border-box",
          boxShadow:
            "0 8px 30px rgba(16, 24, 40, 0.06)",
        }}
      >
        {/* Header */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontSize: "34px",
              marginBottom: "10px",
            }}
          >
            🍽️
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: "700",
              color: "#202228",
            }}
          >
            Join Table
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: "13px",
              color: "#667085",
              lineHeight: 1.5,
            }}
          >
            Join the table to start ordering
            together.
          </p>
        </div>

        {/* SELECT MODE */}

        {mode === "SELECT" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <button
              onClick={joinNewTable}
              disabled={loading}
              style={{
                width: "100%",
                border: "none",
                background: "#202228",
                color: "#fff",
                padding: "14px",
                borderRadius: "10px",
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
                fontSize: "13px",
                fontWeight: "600",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading
                ? "Joining..."
                : "Join New Table"}
            </button>

            <button
              onClick={() => {
                setMode("EXISTING");
                setError("");
              }}
              disabled={loading}
              style={{
                width: "100%",
                border: "1px solid #d0d5dd",
                background: "#fff",
                color: "#344054",
                padding: "14px",
                borderRadius: "10px",
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              Join Existing Table
            </button>
          </div>
        )}

        {/* EXISTING TABLE */}

        {mode === "EXISTING" && (
          <div>
            <div
              style={{
                marginBottom: "10px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#202228",
              }}
            >
              Enter Table Code
            </div>

            <p
              style={{
                margin: "0 0 14px",
                fontSize: "11px",
                color: "#667085",
                lineHeight: 1.5,
              }}
            >
              Enter the code shared by someone
              already sitting at the table.
            </p>

            <input
              value={code}
              onChange={(event) =>
                handleCodeChange(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  joinExistingTable();
                }
              }}
              placeholder="ENTER CODE"
              maxLength={6}
              autoFocus
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px",
                border: "1px solid #d0d5dd",
                borderRadius: "10px",
                outline: "none",
                fontSize: "18px",
                fontWeight: "700",
                letterSpacing: "4px",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            />

            <button
              onClick={joinExistingTable}
              disabled={
                loading || code.length === 0
              }
              style={{
                width: "100%",
                marginTop: "12px",
                border: "none",
                background:
                  loading || code.length === 0
                    ? "#d0d5dd"
                    : "#202228",
                color: "#fff",
                padding: "14px",
                borderRadius: "10px",
                cursor:
                  loading || code.length === 0
                    ? "not-allowed"
                    : "pointer",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              {loading
                ? "Joining..."
                : "Join Table"}
            </button>

            <button
              onClick={() => {
                setMode("SELECT");
                setCode("");
                setError("");
              }}
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "10px",
                border: "none",
                background: "transparent",
                color: "#667085",
                padding: "10px",
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
                fontSize: "12px",
              }}
            >
              ← Back
            </button>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div
            style={{
              marginTop: "16px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "#fef3f2",
              border: "1px solid #fecdca",
              color: "#b42318",
              fontSize: "11px",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </main>
  );
}