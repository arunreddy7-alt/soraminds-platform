"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Role = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

type StaffMember = {
  id: number;
  restaurant_id: number;
  role_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  role_name: string;
};

type Permission = {
  module: string;
  access: "FULL" | "VIEW" | "NONE";
};

const MODULES = [
  "dashboard",
  "orders",
  "customers",
  "menu",
  "combos",
  "promotions",
  "coupons",
  "tables",
  "qr_codes",
  "reviews",
  "analytics",
  "reports",
  "staff",
  "settings",
];

const ACCESS_OPTIONS = [
  "FULL",
  "VIEW",
  "NONE",
] as const;

function formatRole(role: string) {
  return role
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatModule(module: string) {
  return module
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatAccess(access: string) {
  if (access === "FULL") return "Full access";
  if (access === "VIEW") return "View only";
  return "No access";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}

export default function StaffClient() {
  const supabase = createClient();

  const [activeTab, setActiveTab] =
    useState<"team" | "roles">("team");

  const [staff, setStaff] =
    useState<StaffMember[]>([]);

  const [roles, setRoles] =
    useState<Role[]>([]);

  const [roleModules, setRoleModules] = useState<
  Record<number, string[]>
>({});

  const [loadingStaff, setLoadingStaff] =
    useState(true);

  const [loadingRoles, setLoadingRoles] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showStaffModal, setShowStaffModal] =
    useState(false);

  const [showRoleModal, setShowRoleModal] =
    useState(false);

  const [
    showPermissionsModal,
    setShowPermissionsModal,
  ] = useState(false);

  const [editingStaff, setEditingStaff] =
    useState<StaffMember | null>(null);

  const [editingRole, setEditingRole] =
    useState<Role | null>(null);

  const [rolePermissions, setRolePermissions] =
    useState<Permission[]>([]);

  const [staffForm, setStaffForm] =
    useState({
      full_name: "",
      email: "",
      phone: "",
      password: "",
      role_id: "",
    });

  const [roleForm, setRoleForm] =
    useState({
      name: "",
      description: "",
    });

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error(
        "You are not authenticated."
      );
    }

    return user;
  };

  const loadStaff = async () => {
    try {
      setLoadingStaff(true);
      setError("");

      const response = await fetch(
        "/api/restaurant/staff",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load staff."
        );
      }

      setStaff(data.staff || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load staff."
      );
    } finally {
      setLoadingStaff(false);
    }
  };

  const loadRoles = async () => {
  try {
    setLoadingRoles(true);

    const response = await fetch(
      "/api/restaurant/staff/roles",
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to load roles."
      );
    }

    const loadedRoles: Role[] = data.roles || [];

    setRoles(loadedRoles);

    const moduleMap: Record<number, string[]> = {};

    await Promise.all(
      loadedRoles.map(async (role) => {
        try {
          const permissionResponse = await fetch(
            `/api/restaurant/staff/roles/${role.id}/permissions`,
            {
              cache: "no-store",
            }
          );

          const permissionData =
            await permissionResponse.json();

          if (!permissionResponse.ok) {
            return;
          }

          const permissions: Permission[] =
            permissionData.permissions || [];

          moduleMap[role.id] = permissions
            .filter(
              (permission) =>
                permission.access !== "NONE"
            )
            .map(
              (permission) => permission.module
            );
        } catch {
          moduleMap[role.id] = [];
        }
      })
    );

    setRoleModules(moduleMap);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to load roles."
    );
  } finally {
    setLoadingRoles(false);
  }
};

  useEffect(() => {
    loadStaff();
    loadRoles();
  }, []);

  const openAddStaff = () => {
    setEditingStaff(null);

    setStaffForm({
      full_name: "",
      email: "",
      phone: "",
      password: "",
      role_id: "",
    });

    setShowStaffModal(true);
  };

  const openEditStaff = (
    member: StaffMember
  ) => {
    setEditingStaff(member);

    setStaffForm({
      full_name: member.full_name || "",
      email: member.email || "",
      phone: member.phone || "",
      password: "",
      role_id: String(member.role_id),
    });

    setShowStaffModal(true);
  };

  const closeStaffModal = () => {
    if (saving) return;

    setShowStaffModal(false);
    setEditingStaff(null);
  };

  const saveStaff = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!staffForm.full_name.trim()) {
      alert("Please enter a name.");
      return;
    }

    if (!staffForm.email.trim()) {
      alert("Please enter an email.");
      return;
    }

    if (!staffForm.role_id) {
      alert("Please select a role.");
      return;
    }

    if (
      !editingStaff &&
      !staffForm.password.trim()
    ) {
      alert("Please enter a password.");
      return;
    }

    try {
      setSaving(true);

      const url = editingStaff
        ? `/api/restaurant/staff/${editingStaff.id}`
        : "/api/restaurant/staff";

      const response = await fetch(url, {
        method: editingStaff
          ? "PUT"
          : "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          full_name:
            staffForm.full_name.trim(),
          email:
            staffForm.email.trim(),
          phone:
            staffForm.phone.trim() ||
            null,
          password:
            staffForm.password.trim() ||
            undefined,
          role_id:
            Number(staffForm.role_id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save staff member."
        );
      }

      await loadStaff();

      closeStaffModal();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Unable to save staff member."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStaffStatus = async (
    member: StaffMember
  ) => {
    try {
      const response = await fetch(
        `/api/restaurant/staff/${member.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            is_active:
              !member.is_active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update status."
        );
      }

      await loadStaff();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Unable to update status."
      );
    }
  };

  const deleteStaff = async (
    member: StaffMember
  ) => {
    const confirmed =
      window.confirm(
        `Delete ${member.full_name}?`
      );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/restaurant/staff/${member.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to delete staff member."
        );
      }

      await loadStaff();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Unable to delete staff member."
      );
    }
  };

  const openAddRole = () => {
    setEditingRole(null);

    setRoleForm({
      name: "",
      description: "",
    });

    setShowRoleModal(true);
  };

  const closeRoleModal = () => {
    if (saving) return;

    setShowRoleModal(false);
    setEditingRole(null);
  };

  const saveRole = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!roleForm.name.trim()) {
      alert("Please enter a role name.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/restaurant/staff/roles",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name:
              roleForm.name.trim(),
            description:
              roleForm.description.trim() ||
              null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create role."
        );
      }

      await loadRoles();

      closeRoleModal();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Unable to create role."
      );
    } finally {
      setSaving(false);
    }
  };

  const openPermissions = async (
    role: Role
  ) => {
    try {
     const response = await fetch(
  `/api/restaurant/staff/roles/${role.id}/permissions`,
  {
    method: "GET",
    cache: "no-store",
  }
);

const responseText = await response.text();

let data: any;

try {
  data = JSON.parse(responseText);
} catch {
  console.error("Permissions API returned HTML:", responseText);
  throw new Error(
    `Permissions API returned a non-JSON response (HTTP ${response.status}). Check the Next.js terminal for the actual error.`
  );
}

if (!response.ok) {
  throw new Error(data.error || "Unable to load permissions.");
}

const existingPermissions = data.permissions ?? [];

const permissionMap = new Map(
  existingPermissions.map((permission: Permission) => [
    permission.module,
    permission.access,
  ])
);

      const completePermissions =
        MODULES.map((module) => ({
          module,
          access:
            (permissionMap.get(
              module
            ) as Permission["access"]) ||
            "NONE",
        }));

      setEditingRole(role);
      setRolePermissions(
        completePermissions
      );
      setShowPermissionsModal(true);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Unable to load permissions."
      );
    }
  };

  const closePermissionsModal =
    () => {
      if (saving) return;

      setShowPermissionsModal(
        false
      );
      setEditingRole(null);
      setRolePermissions([]);
    };

  const updatePermission = (
    module: string,
    access: Permission["access"]
  ) => {
    setRolePermissions(
      (previous) =>
        previous.map(
          (permission) =>
            permission.module ===
            module
              ? {
                  ...permission,
                  access,
                }
              : permission
        )
    );
  };

  const savePermissions = async () => {
    if (!editingRole) return;

    try {
      setSaving(true);

      const response = await fetch(
        `/api/restaurant/staff/roles/${editingRole.id}/permissions`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            permissions:
              rolePermissions,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update permissions."
        );
      }

      closePermissionsModal();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Unable to update permissions."
      );
    } finally {
      setSaving(false);
    }
  };

  const roleCount = useMemo(
    () => roles.length,
    [roles]
  );

  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "22px",
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
            Staff
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#858a94",
              fontSize: "13px",
            }}
          >
            Manage team members and
            restaurant access.
          </p>
        </div>

        {activeTab === "team" ? (
          <button
            onClick={openAddStaff}
            style={{
              border: "none",
              background: "#202228",
              color: "#fff",
              padding:
                "10px 15px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            + Add member
          </button>
        ) : (
          <button
            onClick={openAddRole}
            style={{
              border: "none",
              background: "#202228",
              color: "#fff",
              padding:
                "10px 15px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            + Add role
          </button>
        )}
      </div>

      {/* TABS */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          background: "#fff",
          border:
            "1px solid #eaecf0",
          borderRadius: "10px",
          padding: "5px",
          marginBottom: "18px",
        }}
      >
        {[
          ["team", "Team"],
          [
            "roles",
            "Access & roles",
          ],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() =>
              setActiveTab(
                key as
                  | "team"
                  | "roles"
              )
            }
            style={{
              border: "none",
              background:
                activeTab === key
                  ? "#202228"
                  : "transparent",
              color:
                activeTab === key
                  ? "#fff"
                  : "#667085",
              padding:
                "9px 16px",
              borderRadius: "7px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            background: "#fff5f5",
            border:
              "1px solid #fecdca",
            color: "#b42318",
            borderRadius: "8px",
            padding: "12px 14px",
            marginBottom: "15px",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      {/* TEAM */}
      {activeTab === "team" && (
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding:
                "18px 20px",
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
              Team members
            </div>

            <div
              style={{
                marginTop: "5px",
                color: "#858a94",
                fontSize: "12px",
              }}
            >
              {staff.length} member
              {staff.length !== 1
                ? "s"
                : ""}{" "}
              in your restaurant
            </div>
          </div>

          {loadingStaff ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#858a94",
                fontSize: "12px",
              }}
            >
              Loading team members...
            </div>
          ) : staff.length === 0 ? (
            <div
              style={{
                padding: "55px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "30px",
                  marginBottom: "10px",
                }}
              >
                👥
              </div>

              <div
                style={{
                  fontWeight: "600",
                  color: "#202228",
                  marginBottom: "5px",
                }}
              >
                No team members
              </div>

              <div
                style={{
                  color: "#858a94",
                  fontSize: "12px",
                  marginBottom: "16px",
                }}
              >
                Add your first staff member
                to get started.
              </div>

              <button
                onClick={openAddStaff}
                style={{
                  border: "none",
                  background: "#202228",
                  color: "#fff",
                  padding:
                    "10px 15px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                + Add member
              </button>
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
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#fafafa",
                    }}
                  >
                    {[
                      "Member",
                      "Role",
                      "Email",
                      "Phone",
                      "Status",
                      "",
                    ].map(
                      (heading) => (
                        <th
                          key={heading}
                          style={{
                            padding:
                              "13px 18px",
                            textAlign:
                              "left",
                            fontSize:
                              "10px",
                            color:
                              "#858a94",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {staff.map(
                    (member) => (
                      <tr
                        key={
                          member.id
                        }
                        style={{
                          borderBottom:
                            "1px solid #f2f4f7",
                        }}
                      >
                        <td
                          style={{
                            padding:
                              "14px 18px",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                width:
                                  "34px",
                                height:
                                  "34px",
                                borderRadius:
                                  "50%",
                                background:
                                  "#f2f4f7",
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  "700",
                                color:
                                  "#475467",
                              }}
                            >
                              {getInitials(
                                member.full_name
                              )}
                            </div>

                            <div>
                              <div
                                style={{
                                  fontSize:
                                    "12px",
                                  fontWeight:
                                    "600",
                                  color:
                                    "#202228",
                                }}
                              >
                                {
                                  member.full_name
                                }
                              </div>

                              <div
                                style={{
                                  fontSize:
                                    "10px",
                                  color:
                                    "#98a2b3",
                                  marginTop:
                                    "3px",
                                }}
                              >
                                ID #
                                {
                                  member.id
                                }
                              </div>
                            </div>
                          </div>
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 18px",
                          }}
                        >
                          <span
                            style={{
                              display:
                                "inline-block",
                              background:
                                "#f2f4f7",
                              color:
                                "#475467",
                              padding:
                                "5px 8px",
                              borderRadius:
                                "6px",
                              fontSize:
                                "10px",
                              fontWeight:
                                "600",
                            }}
                          >
                            {formatRole(
                              member.role_name
                            )}
                          </span>
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 18px",
                            fontSize:
                              "11px",
                            color:
                              "#667085",
                          }}
                        >
                          {
                            member.email
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 18px",
                            fontSize:
                              "11px",
                            color:
                              "#667085",
                          }}
                        >
                          {member.phone ||
                            "—"}
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 18px",
                          }}
                        >
                          <button
                            onClick={() =>
                              toggleStaffStatus(
                                member
                              )
                            }
                            style={{
                              border:
                                "none",
                              background:
                                member.is_active
                                  ? "#ecfdf3"
                                  : "#f2f4f7",
                              color:
                                member.is_active
                                  ? "#027a48"
                                  : "#667085",
                              padding:
                                "6px 9px",
                              borderRadius:
                                "6px",
                              cursor:
                                "pointer",
                              fontSize:
                                "10px",
                              fontWeight:
                                "600",
                            }}
                          >
                            ●{" "}
                            {member.is_active
                              ? "Active"
                              : "Disabled"}
                          </button>
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 18px",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              gap: "6px",
                            }}
                          >
                            <button
                              onClick={() =>
                                openEditStaff(
                                  member
                                )
                              }
                              style={{
                                border:
                                  "1px solid #d0d5dd",
                                background:
                                  "#fff",
                                color:
                                  "#344054",
                                padding:
                                  "6px 9px",
                                borderRadius:
                                  "6px",
                                cursor:
                                  "pointer",
                                fontSize:
                                  "11px",
                              }}
                            >
                              Edit
                            </button>

                            <button
                              onClick={() =>
                                deleteStaff(
                                  member
                                )
                              }
                              style={{
                                border:
                                  "1px solid #fecdca",
                                background:
                                  "#fff",
                                color:
                                  "#b42318",
                                padding:
                                  "6px 9px",
                                borderRadius:
                                  "6px",
                                cursor:
                                  "pointer",
                                fontSize:
                                  "11px",
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ROLES */}
      {activeTab === "roles" && (
        <div
          style={{
            background: "#fff",
            border:
              "1px solid #eaecf0",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding:
                "18px 20px",
              borderBottom:
                "1px solid #eaecf0",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "600",
                }}
              >
                Access & roles
              </div>

              <div
                style={{
                  marginTop: "5px",
                  color: "#858a94",
                  fontSize: "12px",
                }}
              >
                Manage what each role can
                access.
              </div>
            </div>

            <div
              style={{
                fontSize: "11px",
                color: "#667085",
              }}
            >
              {roleCount} roles
            </div>
          </div>

          {loadingRoles ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#858a94",
                fontSize: "12px",
              }}
            >
              Loading roles...
            </div>
          ) : (
            <div
              style={{
                padding: "18px",
                display: "grid",
                gap: "12px",
              }}
            >
              {roles.map((role) => (
                <div
                  key={role.id}
                  style={{
                    border:
                      "1px solid #eaecf0",
                    borderRadius: "10px",
                    padding: "17px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "flex-start",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize:
                            "14px",
                          fontWeight:
                            "600",
                          color:
                            "#202228",
                        }}
                      >
                        {formatRole(
                          role.name
                        )}
                      </div>

                      <div
                        style={{
                          fontSize:
                            "11px",
                          color:
                            "#858a94",
                          marginTop:
                            "4px",
                        }}
                      >
                        {role.description ||
                          "Custom restaurant role"}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        openPermissions(
                          role
                        )
                      }
                      disabled={
                        role.name ===
                        "OWNER"
                      }
                      style={{
                        border:
                          "1px solid #d0d5dd",
                        background:
                          "#fff",
                        color:
                          role.name ===
                          "OWNER"
                            ? "#98a2b3"
                            : "#344054",
                        padding:
                          "8px 11px",
                        borderRadius:
                          "7px",
                        cursor:
                          role.name ===
                          "OWNER"
                            ? "not-allowed"
                            : "pointer",
                        fontSize:
                          "11px",
                      }}
                    >
                      Edit access
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: "15px",
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "8px",
                    }}
                  >
                  {(roleModules[role.id] || []).length === 0 ? (
  <div
    style={{
      fontSize: "10px",
      color: "#98a2b3",
      padding: "9px 10px",
    }}
  >
    No access assigned
  </div>
) : (
  (roleModules[role.id] || []).map(
    (module) => (
      <div
        key={module}
        style={{
          background: "#f8f9fb",
          borderRadius: "7px",
          padding: "9px 10px",
          fontSize: "10px",
          color: "#667085",
        }}
      >
        {formatModule(module)}
      </div>
    )
  )
)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STAFF MODAL */}
      {showStaffModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(16,24,40,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "12px",
              boxShadow:
                "0 20px 50px rgba(0,0,0,.18)",
            }}
          >
            <div
              style={{
                padding:
                  "20px 22px",
                borderBottom:
                  "1px solid #eaecf0",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize:
                      "17px",
                    fontWeight:
                      "700",
                  }}
                >
                  {editingStaff
                    ? "Edit staff member"
                    : "Add staff member"}
                </div>

                <div
                  style={{
                    marginTop:
                      "5px",
                    fontSize:
                      "11px",
                    color:
                      "#858a94",
                  }}
                >
                  {editingStaff
                    ? "Update this team member's details."
                    : "Create an account for a new team member."}
                </div>
              </div>

              <button
                onClick={
                  closeStaffModal
                }
                style={{
                  border:
                    "none",
                  background:
                    "transparent",
                  fontSize:
                    "22px",
                  cursor:
                    "pointer",
                  color:
                    "#667085",
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveStaff}
              style={{
                padding: "22px",
              }}
            >
              {[
                [
                  "Full name",
                  "full_name",
                  "text",
                ],
                [
                  "Email",
                  "email",
                  "email",
                ],
                [
                  "Phone",
                  "phone",
                  "text",
                ],
                [
                  editingStaff
                    ? "New password"
                    : "Password",
                  "password",
                  "password",
                ],
              ].map(
                ([
                  label,
                  field,
                  type,
                ]) => (
                  <div
                    key={field}
                    style={{
                      marginBottom:
                        "15px",
                    }}
                  >
                    <label
                      style={{
                        display:
                          "block",
                        marginBottom:
                          "6px",
                        fontSize:
                          "11px",
                        fontWeight:
                          "600",
                        color:
                          "#344054",
                      }}
                    >
                      {label}
                      {field !==
                        "phone" &&
                        " *"}
                    </label>

                    <input
                      type={type}
                      value={
                        staffForm[
                          field as keyof typeof staffForm
                        ]
                      }
                      onChange={(
                        event
                      ) =>
                        setStaffForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            [field]:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder={
                        field ===
                        "password"
                          ? editingStaff
                            ? "Leave blank to keep current password"
                            : "Create password"
                          : `Enter ${String(
                              label
                            ).toLowerCase()}`
                      }
                      required={
                        field !==
                          "phone" &&
                        !(
                          field ===
                            "password" &&
                          editingStaff
                        )
                      }
                      style={{
                        width:
                          "100%",
                        boxSizing:
                          "border-box",
                        padding:
                          "10px 11px",
                        border:
                          "1px solid #d0d5dd",
                        borderRadius:
                          "7px",
                        fontSize:
                          "12px",
                        outline:
                          "none",
                      }}
                    />
                  </div>
                )
              )}

              <div
                style={{
                  marginBottom:
                    "20px",
                }}
              >
                <label
                  style={{
                    display:
                      "block",
                    marginBottom:
                      "6px",
                    fontSize:
                      "11px",
                    fontWeight:
                      "600",
                    color:
                      "#344054",
                  }}
                >
                  Role *
                </label>

                <select
                  value={
                    staffForm.role_id
                  }
                  onChange={(
                    event
                  ) =>
                    setStaffForm(
                      (
                        previous
                      ) => ({
                        ...previous,
                        role_id:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  required
                  style={{
                    width:
                      "100%",
                    padding:
                      "10px 11px",
                    border:
                      "1px solid #d0d5dd",
                    borderRadius:
                      "7px",
                    fontSize:
                      "12px",
                    background:
                      "#fff",
                  }}
                >
                  <option value="">
                    Select role
                  </option>

                  {roles.map(
                    (role) => (
                      <option
                        key={
                          role.id
                        }
                        value={
                          role.id
                        }
                      >
                        {formatRole(
                          role.name
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={
                    closeStaffModal
                  }
                  disabled={
                    saving
                  }
                  style={{
                    border:
                      "1px solid #d0d5dd",
                    background:
                      "#fff",
                    color:
                      "#344054",
                    padding:
                      "10px 14px",
                    borderRadius:
                      "7px",
                    cursor:
                      "pointer",
                    fontSize:
                      "12px",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  style={{
                    border:
                      "none",
                    background:
                      "#202228",
                    color:
                      "#fff",
                    padding:
                      "10px 15px",
                    borderRadius:
                      "7px",
                    cursor:
                      "pointer",
                    fontSize:
                      "12px",
                    fontWeight:
                      "600",
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingStaff
                    ? "Save changes"
                    : "Add member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROLE MODAL */}
      {showRoleModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(16,24,40,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              background: "#fff",
              borderRadius: "12px",
            }}
          >
            <div
              style={{
                padding:
                  "20px",
                borderBottom:
                  "1px solid #eaecf0",
                display: "flex",
                justifyContent:
                  "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize:
                      "17px",
                    fontWeight:
                      "700",
                  }}
                >
                  Add role
                </div>

                <div
                  style={{
                    fontSize:
                      "11px",
                    color:
                      "#858a94",
                    marginTop:
                      "5px",
                  }}
                >
                  Create a custom role for
                  your restaurant.
                </div>
              </div>

              <button
                onClick={
                  closeRoleModal
                }
                style={{
                  border:
                    "none",
                  background:
                    "transparent",
                  fontSize:
                    "22px",
                  cursor:
                    "pointer",
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveRole}
              style={{
                padding: "20px",
              }}
            >
              <div
                style={{
                  marginBottom:
                    "15px",
                }}
              >
                <label
                  style={{
                    display:
                      "block",
                    marginBottom:
                      "6px",
                    fontSize:
                      "11px",
                    fontWeight:
                      "600",
                  }}
                >
                  Role name *
                </label>

                <input
                  value={
                    roleForm.name
                  }
                  onChange={(
                    event
                  ) =>
                    setRoleForm(
                      (
                        previous
                      ) => ({
                        ...previous,
                        name: event
                          .target
                          .value,
                      })
                    )
                  }
                  placeholder="e.g. Supervisor"
                  required
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    padding:
                      "10px 11px",
                    border:
                      "1px solid #d0d5dd",
                    borderRadius:
                      "7px",
                    fontSize:
                      "12px",
                  }}
                />
              </div>

              <div
                style={{
                  marginBottom:
                    "20px",
                }}
              >
                <label
                  style={{
                    display:
                      "block",
                    marginBottom:
                      "6px",
                    fontSize:
                      "11px",
                    fontWeight:
                      "600",
                  }}
                >
                  Description
                </label>

                <textarea
                  value={
                    roleForm.description
                  }
                  onChange={(
                    event
                  ) =>
                    setRoleForm(
                      (
                        previous
                      ) => ({
                        ...previous,
                        description:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  placeholder="Describe what this role does"
                  rows={4}
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    padding:
                      "10px 11px",
                    border:
                      "1px solid #d0d5dd",
                    borderRadius:
                      "7px",
                    fontSize:
                      "12px",
                    resize:
                      "vertical",
                  }}
                />
              </div>

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={
                    closeRoleModal
                  }
                  style={{
                    border:
                      "1px solid #d0d5dd",
                    background:
                      "#fff",
                    padding:
                      "10px 14px",
                    borderRadius:
                      "7px",
                    cursor:
                      "pointer",
                    fontSize:
                      "12px",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  style={{
                    border:
                      "none",
                    background:
                      "#202228",
                    color:
                      "#fff",
                    padding:
                      "10px 15px",
                    borderRadius:
                      "7px",
                    cursor:
                      "pointer",
                    fontSize:
                      "12px",
                  }}
                >
                  {saving
                    ? "Creating..."
                    : "Create role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERMISSIONS MODAL */}
      {showPermissionsModal &&
        editingRole && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background:
                "rgba(16,24,40,0.45)",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              padding: "20px",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "650px",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#fff",
                borderRadius:
                  "12px",
              }}
            >
              <div
                style={{
                  padding:
                    "20px",
                  borderBottom:
                    "1px solid #eaecf0",
                  display: "flex",
                  justifyContent:
                    "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize:
                        "17px",
                      fontWeight:
                        "700",
                    }}
                  >
                    Edit{" "}
                    {formatRole(
                      editingRole.name
                    )}{" "}
                    access
                  </div>

                  <div
                    style={{
                      marginTop:
                        "5px",
                      fontSize:
                        "11px",
                      color:
                        "#858a94",
                    }}
                  >
                    Choose what this
                    role can access.
                  </div>
                </div>

                <button
                  onClick={
                    closePermissionsModal
                  }
                  style={{
                    border:
                      "none",
                    background:
                      "transparent",
                    fontSize:
                      "22px",
                    cursor:
                      "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  padding:
                    "20px",
                  display:
                    "grid",
                  gap: "8px",
                }}
              >
                {rolePermissions.map(
                  (permission) => (
                    <div
                      key={
                        permission.module
                      }
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        gap: "15px",
                        border:
                          "1px solid #eaecf0",
                        borderRadius:
                          "8px",
                        padding:
                          "12px 14px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize:
                              "12px",
                            fontWeight:
                              "600",
                            color:
                              "#202228",
                          }}
                        >
                          {formatModule(
                            permission.module
                          )}
                        </div>

                        <div
                          style={{
                            fontSize:
                              "10px",
                            color:
                              "#98a2b3",
                            marginTop:
                              "3px",
                          }}
                        >
                          Dashboard
                          access
                        </div>
                      </div>

                      <select
                        value={
                          permission.access
                        }
                        onChange={(
                          event
                        ) =>
                          updatePermission(
                            permission.module,
                            event
                              .target
                              .value as Permission["access"]
                          )
                        }
                        style={{
                          padding:
                            "8px 10px",
                          border:
                            "1px solid #d0d5dd",
                          borderRadius:
                            "7px",
                          fontSize:
                            "11px",
                          background:
                            "#fff",
                        }}
                      >
                        {ACCESS_OPTIONS.map(
                          (access) => (
                            <option
                              key={
                                access
                              }
                              value={
                                access
                              }
                            >
                              {formatAccess(
                                access
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  )
                )}
              </div>

              <div
                style={{
                  padding:
                    "0 20px 20px",
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap: "8px",
                }}
              >
                <button
                  onClick={
                    closePermissionsModal
                  }
                  disabled={
                    saving
                  }
                  style={{
                    border:
                      "1px solid #d0d5dd",
                    background:
                      "#fff",
                    padding:
                      "10px 14px",
                    borderRadius:
                      "7px",
                    cursor:
                      "pointer",
                    fontSize:
                      "12px",
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={
                    savePermissions
                  }
                  disabled={
                    saving
                  }
                  style={{
                    border:
                      "none",
                    background:
                      "#202228",
                    color:
                      "#fff",
                    padding:
                      "10px 15px",
                    borderRadius:
                      "7px",
                    cursor:
                      "pointer",
                    fontSize:
                      "12px",
                  }}
                >
                  {saving
                    ? "Saving..."
                    : "Save access"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}