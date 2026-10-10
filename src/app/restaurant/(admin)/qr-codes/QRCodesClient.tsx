"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Table = {
  id: number;
  table_number: string;
  seats: number;
  status: string;
};

type QRCodeRecord = {
  id: number;
  restaurant_id: number;
  table_id: number | null;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  table?: Table | null;
};

type QRItem = QRCodeRecord & {
  table_number?: string;
  seats?: number;
  table_status?: string;
  qr_type: "DINE_IN" | "TAKEAWAY";
};

export default function QRCodesClient() {

  const [canManageQR, setCanManageQR] = useState(false);
  const [permissionLoaded, setPermissionLoaded] = useState(false);

  const [tables, setTables] = useState<Table[]>([]);
  const [qrCodes, setQrCodes] = useState<QRItem[]>([]);
  const [takeawayQR, setTakeawayQR] =
    useState<QRItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState<number | null>(null);
  const [takeawayLoading, setTakeawayLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [qrImages, setQrImages] = useState<
    Record<number, string>
  >({});

const loadQRCodes = async () => {
  try {
    setLoading(true);
    setError("");

    const response = await fetch("/api/restaurant/qr-codes", {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to load QR codes.");
    }

    const tableData: Table[] = result.tables || [];
    const qrData: QRCodeRecord[] = result.qrCodes || [];

    setTables(tableData);

    const tableMap = new Map(
      tableData.map((table) => [table.id, table])
    );

    const dineIn: QRItem[] = [];
    let takeaway: QRItem | null = null;

    qrData.forEach((qr) => {
      if (qr.table_id === null) {
        takeaway = {
          ...qr,
          qr_type: "TAKEAWAY",
        };
        return;
      }

      const table = tableMap.get(qr.table_id);
      if (!table) return;

      dineIn.push({
        ...qr,
        table_number: table.table_number,
        seats: table.seats,
        table_status: table.status,
        qr_type: "DINE_IN",
      });
    });

    setQrCodes(dineIn);
    setTakeawayQR(takeaway);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Unable to load QR codes."
    );
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  const initialize = async () => {
    try {
      const response = await fetch("/api/restaurant/me", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to verify permissions.");
      }

      const isOwner = result.role?.name === "OWNER";
      const permissions = result.permissions || [];

      const qrPermission = permissions.find(
        (permission: { module: string; access: string }) =>
          permission.module === "qr_codes"
      );

      setCanManageQR(isOwner || qrPermission?.access === "FULL");
      setPermissionLoaded(true);

      await loadQRCodes();
    } catch (err) {
      setPermissionLoaded(true);
      setCanManageQR(false);
      setError(
        err instanceof Error ? err.message : "Unable to initialize QR codes."
      );
      setLoading(false);
    }
  };

  initialize();
}, []);

  const availableTables = useMemo(() => {
    const generatedTableIds = new Set(
      qrCodes
        .filter((qr) => qr.table_id !== null)
        .map((qr) => qr.table_id)
    );

    return tables.filter(
      (table) => !generatedTableIds.has(table.id)
    );
  }, [tables, qrCodes]);

  const createQRImage = async (qr: QRItem) => {
    try {
      const baseUrl =
        window.location.origin;

      const qrUrl = `${baseUrl}/qr/${encodeURIComponent(
        qr.code
      )}`;

      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 500,
        margin: 2,
        errorCorrectionLevel: "H",
      });

      setQrImages((current) => ({
        ...current,
        [qr.id]: dataUrl,
      }));

      return dataUrl;
    } catch {
      setError("Unable to generate QR image.");
      return null;
    }
  };

  useEffect(() => {
    const generateImages = async () => {
      const allQRs = [
        ...qrCodes,
        ...(takeawayQR ? [takeawayQR] : []),
      ];

      for (const qr of allQRs) {
        if (!qrImages[qr.id]) {
          await createQRImage(qr);
        }
      }
    };

    if (!loading) {
      generateImages();
    }
  }, [qrCodes, takeawayQR, loading]);

const generateTableQR = async (tableId: number) => {
  try {
    setActionLoading(tableId);
    setError("");

    const response = await fetch("/api/restaurant/qr-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "DINE_IN",
        table_id: tableId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to generate QR code.");
    }

    await loadQRCodes();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Unable to generate QR code."
    );
  } finally {
    setActionLoading(null);
  }
};

const regenerateTableQR = async (qr: QRItem) => {
  if (!qr.table_id) return;

  const confirmed = window.confirm(
    "Regenerate this QR code? The old QR code will stop working."
  );

  if (!confirmed) return;

  try {
    setActionLoading(qr.id);
    setError("");

    const response = await fetch(`/api/restaurant/qr-codes/${qr.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate" }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to regenerate QR code.");
    }

    setQrImages((current) => {
      const updated = { ...current };
      delete updated[qr.id];
      return updated;
    });

    await loadQRCodes();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Unable to regenerate QR code."
    );
  } finally {
    setActionLoading(null);
  }
};

const generateTakeawayQR = async () => {
  try {
    setTakeawayLoading(true);
    setError("");

    const response = await fetch("/api/restaurant/qr-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "TAKEAWAY" }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to generate takeaway QR.");
    }

    await loadQRCodes();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Unable to generate takeaway QR."
    );
  } finally {
    setTakeawayLoading(false);
  }
};


const regenerateTakeawayQR = async () => {
  if (!takeawayQR) return;

  const confirmed = window.confirm(
    "Regenerate the takeaway QR code? The old QR code will stop working."
  );

  if (!confirmed) return;

  try {
    setTakeawayLoading(true);
    setError("");

    const response = await fetch(
      `/api/restaurant/qr-codes/${takeawayQR.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to regenerate takeaway QR.");
    }

    setQrImages((current) => {
      const updated = { ...current };
      delete updated[takeawayQR.id];
      return updated;
    });

    await loadQRCodes();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to regenerate takeaway QR."
    );
  } finally {
    setTakeawayLoading(false);
  }
};


const toggleQR = async (qr: QRItem) => {
  try {
    setActionLoading(qr.id);
    setError("");

    const response = await fetch(`/api/restaurant/qr-codes/${qr.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle",
        is_active: !qr.is_active,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to update QR status.");
    }

    await loadQRCodes();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Unable to update QR status."
    );
  } finally {
    setActionLoading(null);
  }
};

  const downloadQR = async (
    qr: QRItem
  ) => {
    const image =
      qrImages[qr.id] ||
      (await createQRImage(qr));

    if (!image) return;

    const link =
      document.createElement("a");

    link.href = image;

    link.download =
      qr.qr_type === "TAKEAWAY"
        ? "takeaway-qr.png"
        : `table-${qr.table_number}-qr.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const printQR = async (
    qr: QRItem
  ) => {
    const image =
      qrImages[qr.id] ||
      (await createQRImage(qr));

    if (!image) return;

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=700,height=800"
      );

    if (!printWindow) {
      setError(
        "Please allow pop-ups to print the QR code."
      );

      return;
    }

    const heading =
      qr.qr_type === "TAKEAWAY"
        ? "TAKEAWAY"
        : `TABLE ${qr.table_number}`;

    const subtitle =
      qr.qr_type === "TAKEAWAY"
        ? "Scan to order takeaway"
        : "Scan the QR code to order";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${heading}</title>
          <style>
            body {
              margin: 0;
              padding: 40px;
              font-family: Arial, sans-serif;
              text-align: center;
            }

            .card {
              width: 420px;
              margin: 0 auto;
              padding: 30px;
              box-sizing: border-box;
              border: 1px solid #ddd;
              border-radius: 16px;
            }

            h1 {
              margin: 0;
              font-size: 28px;
            }

            .subtitle {
              margin-top: 8px;
              color: #777;
              font-size: 14px;
            }

            img {
              width: 280px;
              height: 280px;
              margin: 30px auto;
              display: block;
            }

            .label {
              font-size: 25px;
              font-weight: bold;
            }

            .scan {
              margin-top: 10px;
              color: #777;
              font-size: 13px;
            }
          </style>
        </head>

        <body>
          <div class="card">
            <h1>Soraminds Restaurant</h1>

            <div class="subtitle">
              Scan · Order · Enjoy
            </div>

            <img
              src="${image}"
              alt="${heading} QR Code"
              onload="window.print()"
            />

            <div class="label">
              ${heading}
            </div>

            <div class="scan">
              ${subtitle}
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const renderQRCard = (
    qr: QRItem,
    isTakeaway = false
  ) => {
    const image = qrImages[qr.id];

    const busy =
      actionLoading === qr.id;

    return (
      <div
        key={qr.id}
        style={{
          background: "#fff",
          border: "1px solid #eaecf0",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        {/* Card header */}
        <div
          style={{
            padding: "17px 18px",
            borderBottom:
              "1px solid #eaecf0",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: "700",
                color: "#202228",
              }}
            >
              {isTakeaway
                ? "Takeaway"
                : `Table ${qr.table_number}`}
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "11px",
                color: "#858a94",
              }}
            >
              {isTakeaway
                ? "Pickup ordering"
                : `${qr.seats} seats`}
            </div>
          </div>

          <div
            style={{
              padding: "5px 9px",
              borderRadius: "20px",
              background: qr.is_active
                ? "#ecfdf3"
                : "#f2f4f7",
              color: qr.is_active
                ? "#027a48"
                : "#667085",
              fontSize: "10px",
              fontWeight: "700",
            }}
          >
            {qr.is_active
              ? "ACTIVE"
              : "INACTIVE"}
          </div>
        </div>

        {/* QR image */}
        <div
          style={{
            padding: "22px",
            display: "flex",
            justifyContent: "center",
            background: "#fafafa",
          }}
        >
          {qr.is_active && image ? (
            <img
              src={image}
              alt={
                isTakeaway
                  ? "Takeaway QR"
                  : `Table ${qr.table_number} QR`
              }
              style={{
                width: "190px",
                height: "190px",
                display: "block",
                background: "#fff",
              }}
            />
          ) : (
            <div
              style={{
                width: "190px",
                height: "190px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f2f4f7",
                color: "#858a94",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              QR is inactive
            </div>
          )}
        </div>

        {/* Details */}
        <div
          style={{
            padding: "15px 18px 18px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              color: "#858a94",
              marginBottom: "5px",
            }}
          >
            QR CODE
          </div>

          <div
            style={{
              fontSize: "11px",
              color: "#555b66",
              wordBreak: "break-all",
              background: "#f8f9fa",
              padding: "8px",
              borderRadius: "7px",
            }}
          >
            {qr.code}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: "8px",
              marginTop: "14px",
            }}
          >
            {permissionLoaded && canManageQR && (
            <button
              onClick={() =>
                downloadQR(qr)
              }
              disabled={
                !qr.is_active || busy
              }
              style={{
                border:
                  "1px solid #d0d5dd",
                background: "#fff",
                color: "#344054",
                padding: "9px",
                borderRadius: "7px",
                cursor:
                  qr.is_active && !busy
                    ? "pointer"
                    : "not-allowed",
                fontSize: "11px",
                opacity:
                  qr.is_active && !busy
                    ? 1
                    : 0.5,
              }}
            >
              Download
            </button>)}

            <button
              onClick={() =>
                printQR(qr)
              }
              disabled={
                !qr.is_active || busy
              }
              style={{
                border:
                  "1px solid #d0d5dd",
                background: "#fff",
                color: "#344054",
                padding: "9px",
                borderRadius: "7px",
                cursor:
                  qr.is_active && !busy
                    ? "pointer"
                    : "not-allowed",
                fontSize: "11px",
                opacity:
                  qr.is_active && !busy
                    ? 1
                    : 0.5,
              }}
            >
              Print
            </button>

            <button
              onClick={() =>
                isTakeaway
                  ? regenerateTakeawayQR()
                  : regenerateTableQR(qr)
              }
              disabled={busy}
              style={{
                border:
                  "1px solid #d0d5dd",
                background: "#fff",
                color: "#344054",
                padding: "9px",
                borderRadius: "7px",
                cursor: busy
                  ? "not-allowed"
                  : "pointer",
                fontSize: "11px",
                opacity: busy
                  ? 0.6
                  : 1,
              }}
            >
              {busy
                ? "Working..."
                : "Regenerate"}
            </button>

            <button
              onClick={() =>
                toggleQR(qr)
              }
              disabled={busy}
              style={{
                border:
                  "1px solid #d0d5dd",
                background: "#fff",
                color: qr.is_active
                  ? "#d92d20"
                  : "#027a48",
                padding: "9px",
                borderRadius: "7px",
                cursor: busy
                  ? "not-allowed"
                  : "pointer",
                fontSize: "11px",
                opacity: busy
                  ? 0.6
                  : 1,
              }}
            >
              {qr.is_active
                ? "Disable"
                : "Enable"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
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
              color: "#202228",
            }}
          >
            QR Codes
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            Manage dine-in and takeaway QR codes.
          </p>
        </div>

        <button
          onClick={generateTakeawayQR}
          disabled={
            takeawayLoading ||
            !!takeawayQR
          }
          style={{
            border: "none",
            background:
              takeawayQR
                ? "#d0d5dd"
                : "#202228",
            color: "#fff",
            padding: "11px 18px",
            borderRadius: "9px",
            fontSize: "13px",
            fontWeight: "600",
            cursor:
              takeawayQR ||
              takeawayLoading
                ? "not-allowed"
                : "pointer",
          }}
        >
          {takeawayLoading
            ? "Generating..."
            : takeawayQR
            ? "Takeaway QR Generated"
            : "+ Generate Takeaway QR"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 14px",
            borderRadius: "9px",
            background: "#fff1f0",
            border:
              "1px solid #fecdca",
            color: "#b42318",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      {/* Takeaway */}
      {takeawayQR && (
        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              marginBottom: "12px",
              fontSize: "15px",
              fontWeight: "700",
              color: "#202228",
            }}
          >
            Takeaway QR
          </div>

          <div
            style={{
              width: "100%",
              maxWidth: "390px",
            }}
          >
            {renderQRCard(
              takeawayQR,
              true
            )}
          </div>
        </div>
      )}

      {/* Generate table QR */}
      <div
        style={{
          background: "#fff",
          border:
            "1px solid #eaecf0",
          borderRadius: "13px",
          marginBottom: "24px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom:
              "1px solid #eaecf0",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "#202228",
            }}
          >
            Table QR Codes
          </div>

          <div
            style={{
              marginTop: "5px",
              fontSize: "12px",
              color: "#858a94",
            }}
          >
            Generate a QR code for each restaurant table.
          </div>
        </div>

        {loading ? (
          <div
            style={{
              padding: "50px",
              textAlign: "center",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            Loading QR codes...
          </div>
        ) : availableTables.length === 0 ? (
          <div
            style={{
              padding: "35px 20px",
              textAlign: "center",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            All tables already have QR codes.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              padding: "18px 20px",
            }}
          >
            {availableTables.map(
              (table) => (
                <button
                  key={table.id}
                  onClick={() =>
                    generateTableQR(
                      table.id
                    )
                  }
                  disabled={
                    actionLoading ===
                    table.id
                  }
                  style={{
                    border:
                      "1px solid #d0d5dd",
                    background: "#fff",
                    color: "#344054",
                    padding:
                      "9px 13px",
                    borderRadius: "8px",
                    cursor:
                      actionLoading ===
                      table.id
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "12px",
                    opacity:
                      actionLoading ===
                      table.id
                        ? 0.6
                        : 1,
                  }}
                >
                  {actionLoading ===
                  table.id
                    ? "Generating..."
                    : `Generate Table ${table.table_number}`}
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Existing QR cards */}
      {!loading &&
        qrCodes.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "18px",
            }}
          >
            {qrCodes.map((qr) =>
              renderQRCard(qr)
            )}
          </div>
        )}

      {!loading &&
        qrCodes.length === 0 &&
        tables.length > 0 && (
          <div
            style={{
              background: "#fff",
              border:
                "1px solid #eaecf0",
              borderRadius: "13px",
              padding: "55px 20px",
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
              ▦
            </div>

            <div
              style={{
                color: "#202228",
                fontWeight: "600",
                marginBottom: "5px",
              }}
            >
              No QR codes generated yet
            </div>

            <div>
              Generate a QR code for your tables above.
            </div>
          </div>
        )}

      {!loading &&
        tables.length === 0 && (
          <div
            style={{
              background: "#fff",
              border:
                "1px solid #eaecf0",
              borderRadius: "13px",
              padding: "55px 20px",
              textAlign: "center",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            Add tables first before generating table QR codes.
          </div>
        )}
    </div>
  );
}