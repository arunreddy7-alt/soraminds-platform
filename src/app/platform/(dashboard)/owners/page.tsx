"use client";

import { useEffect, useState } from "react";

type Owner = {
  id: number;
  restaurant_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  role_id: number;
  restaurant_name: string;
  restaurant_slug: string;
};

export default function PlatformOwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedOwner, setSelectedOwner] =
    useState<Owner | null>(null);

  const [showViewModal, setShowViewModal] =
    useState(false);

  const [resetOwner, setResetOwner] =
    useState<Owner | null>(null);

  const [showResetModal, setShowResetModal] =
    useState(false);

  const [newPassword, setNewPassword] =
    useState("");

  const [resetLoading, setResetLoading] =
    useState(false);

  const [resetMessage, setResetMessage] =
    useState("");

  const [changeOwner, setChangeOwner] =
    useState<Owner | null>(null);

  const [showChangeModal, setShowChangeModal] =
    useState(false);

  const [newOwnerName, setNewOwnerName] =
    useState("");

  const [newOwnerEmail, setNewOwnerEmail] =
    useState("");

  const [newOwnerPassword, setNewOwnerPassword] =
    useState("");

  const [changeLoading, setChangeLoading] =
    useState(false);

  const [changeMessage, setChangeMessage] =
    useState("");

  const [removeOwner, setRemoveOwner] =
    useState<Owner | null>(null);

  const [showRemoveModal, setShowRemoveModal] =
    useState(false);

  const [removeLoading, setRemoveLoading] =
    useState(false);

  const [removeMessage, setRemoveMessage] =
    useState("");

  async function fetchOwners() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/platform/owners",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load restaurant owners."
        );
      }

      setOwners(data.owners || []);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to load restaurant owners."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOwners();
  }, []);

  function handleView(owner: Owner) {
    setSelectedOwner(owner);
    setShowViewModal(true);
  }

  function handleResetPassword(owner: Owner) {
    setResetOwner(owner);
    setNewPassword("");
    setResetMessage("");
    setShowResetModal(true);
  }

  function handleChangeOwner(owner: Owner) {
    setChangeOwner(owner);
    setNewOwnerName("");
    setNewOwnerEmail("");
    setNewOwnerPassword("");
    setChangeMessage("");
    setShowChangeModal(true);
  }

  function handleRemoveOwner(owner: Owner) {
    setRemoveOwner(owner);
    setRemoveMessage("");
    setShowRemoveModal(true);
  }

  async function submitResetPassword() {
    if (!resetOwner) return;

    if (newPassword.length < 8) {
      setResetMessage(
        "Password must be at least 8 characters."
      );
      return;
    }

    try {
      setResetLoading(true);
      setResetMessage("");

      const response = await fetch(
        `/api/platform/owners/${resetOwner.id}/reset-password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            new_password: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to reset password."
        );
      }

      setResetMessage(
        "Password reset successfully."
      );
      setNewPassword("");
    } catch (error) {
      setResetMessage(
        error instanceof Error
          ? error.message
          : "Failed to reset password."
      );
    } finally {
      setResetLoading(false);
    }
  }

  async function submitChangeOwner() {
    if (!changeOwner) return;

    if (newOwnerName.trim().length < 2) {
      setChangeMessage(
        "Owner name must be at least 2 characters."
      );
      return;
    }

    if (!newOwnerEmail.trim()) {
      setChangeMessage(
        "Owner email is required."
      );
      return;
    }

    if (newOwnerPassword.length < 8) {
      setChangeMessage(
        "Password must be at least 8 characters."
      );
      return;
    }

    try {
      setChangeLoading(true);
      setChangeMessage("");

      const response = await fetch(
        `/api/platform/owners/${changeOwner.id}/change-owner`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            new_owner_full_name:
              newOwnerName.trim(),
            new_owner_email:
              newOwnerEmail.trim(),
            new_owner_password:
              newOwnerPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to change restaurant owner."
        );
      }

      setShowChangeModal(false);

      await fetchOwners();
    } catch (error) {
      setChangeMessage(
        error instanceof Error
          ? error.message
          : "Failed to change restaurant owner."
      );
    } finally {
      setChangeLoading(false);
    }
  }

  async function submitRemoveOwner() {
    if (!removeOwner) return;

    try {
      setRemoveLoading(true);
      setRemoveMessage("");

      const response = await fetch(
        `/api/platform/owners/${removeOwner.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to remove owner."
        );
      }

      setShowRemoveModal(false);
      await fetchOwners();
    } catch (error) {
      setRemoveMessage(
        error instanceof Error
          ? error.message
          : "Failed to remove owner."
      );
    } finally {
      setRemoveLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        paddingTop: "30px",
        paddingRight: "30px",
        paddingBottom: "50px",
        paddingLeft: "30px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          gap: "20px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 700,
              color: "#17191d",
            }}
          >
            Restaurant Owners
          </h1>

          <p
            style={{
              marginTop: "7px",
              marginBottom: 0,
              color: "#777d87",
              fontSize: "14px",
            }}
          >
            Manage restaurant owners and their access.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOwners}
          style={{
            border: "1px solid #dfe2e7",
            background: "#ffffff",
            borderRadius: "8px",
            paddingTop: "10px",
            paddingRight: "16px",
            paddingBottom: "10px",
            paddingLeft: "16px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "20px",
            paddingTop: "13px",
            paddingRight: "16px",
            paddingBottom: "13px",
            paddingLeft: "16px",
            background: "#fff1f1",
            border: "1px solid #f3caca",
            color: "#b42318",
            borderRadius: "8px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "12px",
            paddingTop: "50px",
            paddingRight: "30px",
            paddingBottom: "50px",
            paddingLeft: "30px",
            textAlign: "center",
            color: "#777d87",
          }}
        >
          Loading restaurant owners...
        </div>
      ) : owners.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "12px",
            paddingTop: "50px",
            paddingRight: "30px",
            paddingBottom: "50px",
            paddingLeft: "30px",
            textAlign: "center",
            color: "#777d87",
          }}
        >
          No restaurant owners found.
        </div>
      ) : (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e7e9ed",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1050px",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Owner",
                    "Email",
                    "Restaurant",
                    "Slug",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
                        paddingTop: "14px",
                        paddingRight: "16px",
                        paddingBottom: "14px",
                        paddingLeft: "16px",
                        fontSize: "12px",
                        color: "#777d87",
                        fontWeight: 700,
                        borderBottom:
                          "1px solid #e7e9ed",
                        background: "#fafbfc",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {owners.map((owner) => (
                  <tr key={owner.id}>
                    <td
                      style={{
                        paddingTop: "16px",
                        paddingRight: "16px",
                        paddingBottom: "16px",
                        paddingLeft: "16px",
                        borderBottom:
                          "1px solid #f0f1f3",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "11px",
                        }}
                      >
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            background: "#17191d",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "14px",
                          }}
                        >
                          {owner.full_name
                            ?.charAt(0)
                            ?.toUpperCase() || "O"}
                        </div>

                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#17191d",
                              fontSize: "14px",
                            }}
                          >
                            {owner.full_name}
                          </div>

                          {owner.phone && (
                            <div
                              style={{
                                marginTop: "3px",
                                fontSize: "12px",
                                color: "#8a9099",
                              }}
                            >
                              {owner.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td
                      style={{
                        paddingTop: "16px",
                        paddingRight: "16px",
                        paddingBottom: "16px",
                        paddingLeft: "16px",
                        borderBottom:
                          "1px solid #f0f1f3",
                        fontSize: "14px",
                      }}
                    >
                      {owner.email}
                    </td>

                    <td
                      style={{
                        paddingTop: "16px",
                        paddingRight: "16px",
                        paddingBottom: "16px",
                        paddingLeft: "16px",
                        borderBottom:
                          "1px solid #f0f1f3",
                        fontWeight: 600,
                        fontSize: "14px",
                      }}
                    >
                      {owner.restaurant_name}
                    </td>

                    <td
                      style={{
                        paddingTop: "16px",
                        paddingRight: "16px",
                        paddingBottom: "16px",
                        paddingLeft: "16px",
                        borderBottom:
                          "1px solid #f0f1f3",
                        color: "#777d87",
                        fontSize: "13px",
                      }}
                    >
                      {owner.restaurant_slug}
                    </td>

                    <td
                      style={{
                        paddingTop: "16px",
                        paddingRight: "16px",
                        paddingBottom: "16px",
                        paddingLeft: "16px",
                        borderBottom:
                          "1px solid #f0f1f3",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          paddingTop: "5px",
                          paddingRight: "9px",
                          paddingBottom: "5px",
                          paddingLeft: "9px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: owner.is_active
                            ? "#ecfdf3"
                            : "#fef3f2",
                          color: owner.is_active
                            ? "#027a48"
                            : "#b42318",
                        }}
                      >
                        {owner.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td
                      style={{
                        paddingTop: "16px",
                        paddingRight: "16px",
                        paddingBottom: "16px",
                        paddingLeft: "16px",
                        borderBottom:
                          "1px solid #f0f1f3",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "7px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleView(owner)
                          }
                          style={{
                            border:
                              "1px solid #dfe2e7",
                            background: "#ffffff",
                            borderRadius: "7px",
                            paddingTop: "7px",
                            paddingRight: "10px",
                            paddingBottom: "7px",
                            paddingLeft: "10px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          View
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleChangeOwner(owner)
                          }
                          style={{
                            border: "none",
                            background: "#17191d",
                            color: "#ffffff",
                            borderRadius: "7px",
                            paddingTop: "7px",
                            paddingRight: "10px",
                            paddingBottom: "7px",
                            paddingLeft: "10px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Change Owner
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleResetPassword(owner)
                          }
                          style={{
                            border:
                              "1px solid #dfe2e7",
                            background: "#ffffff",
                            borderRadius: "7px",
                            paddingTop: "7px",
                            paddingRight: "10px",
                            paddingBottom: "7px",
                            paddingLeft: "10px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Reset Password
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveOwner(owner)
                          }
                          style={{
                            border:
                              "1px solid #f3caca",
                            background: "#fff7f7",
                            color: "#b42318",
                            borderRadius: "7px",
                            paddingTop: "7px",
                            paddingRight: "10px",
                            paddingBottom: "7px",
                            paddingLeft: "10px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {showViewModal && selectedOwner && (
        <div
          onClick={() => setShowViewModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            paddingTop: "20px",
            paddingRight: "20px",
            paddingBottom: "20px",
            paddingLeft: "20px",
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "#ffffff",
              borderRadius: "14px",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                paddingTop: "22px",
                paddingRight: "24px",
                paddingBottom: "22px",
                paddingLeft: "24px",
                borderBottom:
                  "1px solid #e7e9ed",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "20px",
                  }}
                >
                  Owner Details
                </h2>

                <p
                  style={{
                    marginTop: "5px",
                    marginBottom: 0,
                    fontSize: "13px",
                    color: "#777d87",
                  }}
                >
                  Restaurant owner information
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowViewModal(false)
                }
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#777d87",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                paddingTop: "20px",
                paddingRight: "24px",
                paddingBottom: "20px",
                paddingLeft: "24px",
              }}
            >
              {[
                ["Full Name", selectedOwner.full_name],
                ["Email", selectedOwner.email],
                [
                  "Phone",
                  selectedOwner.phone ||
                    "Not provided",
                ],
                [
                  "Restaurant",
                  selectedOwner.restaurant_name,
                ],
                [
                  "Restaurant Slug",
                  selectedOwner.restaurant_slug,
                ],
                [
                  "Restaurant ID",
                  selectedOwner.restaurant_id,
                ],
                [
                  "Owner Status",
                  selectedOwner.is_active
                    ? "Active"
                    : "Inactive",
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    gap: "20px",
                    paddingTop: "12px",
                    paddingRight: 0,
                    paddingBottom: "12px",
                    paddingLeft: 0,
                    borderBottom:
                      "1px solid #f0f1f3",
                  }}
                >
                  <span
                    style={{
                      color: "#777d87",
                      fontSize: "13px",
                    }}
                  >
                    {label}
                  </span>

                  <strong
                    style={{
                      fontSize: "13px",
                      textAlign: "right",
                    }}
                  >
                    {value}
                  </strong>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                paddingTop: "16px",
                paddingRight: "24px",
                paddingBottom: "20px",
                paddingLeft: "24px",
                borderTop:
                  "1px solid #e7e9ed",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowViewModal(false)
                }
                style={{
                  border:
                    "1px solid #dfe2e7",
                  background: "#ffffff",
                  borderRadius: "8px",
                  paddingTop: "10px",
                  paddingRight: "16px",
                  paddingBottom: "10px",
                  paddingLeft: "16px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  handleResetPassword(
                    selectedOwner
                  );
                }}
                style={{
                  border: "none",
                  background: "#17191d",
                  color: "#ffffff",
                  borderRadius: "8px",
                  paddingTop: "10px",
                  paddingRight: "16px",
                  paddingBottom: "10px",
                  paddingLeft: "16px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && resetOwner && (
        <div
          onClick={() =>
            !resetLoading &&
            setShowResetModal(false)
          }
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            paddingTop: "20px",
            paddingRight: "20px",
            paddingBottom: "20px",
            paddingLeft: "20px",
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "480px",
              background: "#ffffff",
              borderRadius: "14px",
              paddingTop: "24px",
              paddingRight: "24px",
              paddingBottom: "24px",
              paddingLeft: "24px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
              }}
            >
              Reset Password
            </h2>

            <p
              style={{
                color: "#777d87",
                fontSize: "14px",
                marginTop: "7px",
              }}
            >
              Reset the password for{" "}
              <strong>
                {resetOwner.full_name}
              </strong>
              .
            </p>

            <input
              type="password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(
                  event.target.value
                )
              }
              placeholder="New password"
              minLength={8}
              disabled={resetLoading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border:
                  "1px solid #dfe2e7",
                borderRadius: "8px",
                paddingTop: "11px",
                paddingRight: "12px",
                paddingBottom: "11px",
                paddingLeft: "12px",
                marginTop: "14px",
                fontSize: "14px",
              }}
            />

            <p
              style={{
                marginTop: "7px",
                fontSize: "12px",
                color: "#8a9099",
              }}
            >
              Minimum 8 characters.
            </p>

            {resetMessage && (
              <div
                style={{
                  marginTop: "12px",
                  paddingTop: "10px",
                  paddingRight: "12px",
                  paddingBottom: "10px",
                  paddingLeft: "12px",
                  borderRadius: "7px",
                  background:
                    resetMessage.includes(
                      "successfully"
                    )
                      ? "#ecfdf3"
                      : "#fff1f1",
                  color:
                    resetMessage.includes(
                      "successfully"
                    )
                      ? "#027a48"
                      : "#b42318",
                  fontSize: "13px",
                }}
              >
                {resetMessage}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                disabled={resetLoading}
                onClick={() =>
                  setShowResetModal(false)
                }
                style={{
                  border:
                    "1px solid #dfe2e7",
                  background: "#ffffff",
                  borderRadius: "8px",
                  paddingTop: "10px",
                  paddingRight: "16px",
                  paddingBottom: "10px",
                  paddingLeft: "16px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={resetLoading}
                onClick={submitResetPassword}
                style={{
                  border: "none",
                  background: "#17191d",
                  color: "#ffffff",
                  borderRadius: "8px",
                  paddingTop: "10px",
                  paddingRight: "16px",
                  paddingBottom: "10px",
                  paddingLeft: "16px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {resetLoading
                  ? "Resetting..."
                  : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE OWNER MODAL */}
      {showChangeModal && changeOwner && (
        <div
          onClick={() =>
            !changeLoading &&
            setShowChangeModal(false)
          }
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            paddingTop: "20px",
            paddingRight: "20px",
            paddingBottom: "20px",
            paddingLeft: "20px",
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "#ffffff",
              borderRadius: "14px",
              paddingTop: "24px",
              paddingRight: "24px",
              paddingBottom: "24px",
              paddingLeft: "24px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
              }}
            >
              Change Owner
            </h2>

            <p
              style={{
                marginTop: "7px",
                color: "#777d87",
                fontSize: "14px",
              }}
            >
              Assign a new owner to{" "}
              <strong>
                {changeOwner.restaurant_name}
              </strong>
              .
            </p>

            <div
              style={{
                background: "#f7f8fa",
                borderRadius: "8px",
                paddingTop: "12px",
                paddingRight: "14px",
                paddingBottom: "12px",
                paddingLeft: "14px",
                marginTop: "16px",
                marginBottom: "18px",
                fontSize: "13px",
              }}
            >
              Current Owner:{" "}
              <strong>
                {changeOwner.full_name}
              </strong>
              <br />
              Current Email:{" "}
              <strong>
                {changeOwner.email}
              </strong>
            </div>

            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "7px",
              }}
            >
              New Owner Name
            </label>

            <input
              type="text"
              value={newOwnerName}
              onChange={(event) =>
                setNewOwnerName(
                  event.target.value
                )
              }
              placeholder="Enter owner name"
              disabled={changeLoading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border:
                  "1px solid #dfe2e7",
                borderRadius: "8px",
                paddingTop: "11px",
                paddingRight: "12px",
                paddingBottom: "11px",
                paddingLeft: "12px",
                marginBottom: "14px",
              }}
            />

            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "7px",
              }}
            >
              New Owner Email
            </label>

            <input
              type="email"
              value={newOwnerEmail}
              onChange={(event) =>
                setNewOwnerEmail(
                  event.target.value
                )
              }
              placeholder="owner@example.com"
              disabled={changeLoading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border:
                  "1px solid #dfe2e7",
                borderRadius: "8px",
                paddingTop: "11px",
                paddingRight: "12px",
                paddingBottom: "11px",
                paddingLeft: "12px",
                marginBottom: "14px",
              }}
            />

            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "7px",
              }}
            >
              New Owner Password
            </label>

            <input
              type="password"
              value={newOwnerPassword}
              onChange={(event) =>
                setNewOwnerPassword(
                  event.target.value
                )
              }
              placeholder="Minimum 8 characters"
              minLength={8}
              disabled={changeLoading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border:
                  "1px solid #dfe2e7",
                borderRadius: "8px",
                paddingTop: "11px",
                paddingRight: "12px",
                paddingBottom: "11px",
                paddingLeft: "12px",
              }}
            />

            {changeMessage && (
              <div
                style={{
                  marginTop: "12px",
                  paddingTop: "10px",
                  paddingRight: "12px",
                  paddingBottom: "10px",
                  paddingLeft: "12px",
                  background: "#fff1f1",
                  color: "#b42318",
                  borderRadius: "7px",
                  fontSize: "13px",
                }}
              >
                {changeMessage}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "22px",
              }}
            >
              <button
                type="button"
                disabled={changeLoading}
                onClick={() =>
                  setShowChangeModal(false)
                }
                style={{
                  border:
                    "1px solid #dfe2e7",
                  background: "#ffffff",
                  borderRadius: "8px",
                  paddingTop: "10px",
                  paddingRight: "16px",
                  paddingBottom: "10px",
                  paddingLeft: "16px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={changeLoading}
                onClick={submitChangeOwner}
                style={{
                  border: "none",
                  background: "#17191d",
                  color: "#ffffff",
                  borderRadius: "8px",
                  paddingTop: "10px",
                  paddingRight: "16px",
                  paddingBottom: "10px",
                  paddingLeft: "16px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {changeLoading
                  ? "Changing..."
                  : "Change Owner"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE OWNER MODAL */}
      {showRemoveModal && removeOwner && (
        <div
          onClick={() =>
            !removeLoading &&
            setShowRemoveModal(false)
          }
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            paddingTop: "20px",
            paddingRight: "20px",
            paddingBottom: "20px",
            paddingLeft: "20px",
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "480px",
              background: "#ffffff",
              borderRadius: "14px",
              paddingTop: "24px",
              paddingRight: "24px",
              paddingBottom: "24px",
              paddingLeft: "24px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
              }}
            >
              Remove Owner
            </h2>

            <div
              style={{
                marginTop: "16px",
                background: "#fff7f7",
                border:
                  "1px solid #f3caca",
                borderRadius: "9px",
                paddingTop: "14px",
                paddingRight: "14px",
                paddingBottom: "14px",
                paddingLeft: "14px",
                color: "#8f1d18",
                fontSize: "13px",
                lineHeight: 1.6,
              }}
            >
              <strong>
                Remove {removeOwner.full_name}?
              </strong>

              <p
                style={{
                  marginBottom: 0,
                }}
              >
                This will remove the owner's
                restaurant admin access.
                Restaurant data, orders, menu,
                analytics, and other restaurant
                information will not be deleted.
              </p>
            </div>

            {removeMessage && (
              <div
                style={{
                  marginTop: "12px",
                  color: "#b42318",
                  fontSize: "13px",
                }}
              >
                {removeMessage}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "22px",
              }}
            >
              <button
                type="button"
                disabled={removeLoading}
                onClick={() =>
                  setShowRemoveModal(false)
                }
                style={{
                  border:
                    "1px solid #dfe2e7",
                  background: "#ffffff",
                  borderRadius: "8px",
                  paddingTop: "10px",
                  paddingRight: "16px",
                  paddingBottom: "10px",
                  paddingLeft: "16px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={removeLoading}
                onClick={submitRemoveOwner}
                style={{
                  border: "none",
                  background: "#b42318",
                  color: "#ffffff",
                  borderRadius: "8px",
                  paddingTop: "10px",
                  paddingRight: "16px",
                  paddingBottom: "10px",
                  paddingLeft: "16px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {removeLoading
                  ? "Removing..."
                  : "Remove Owner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}