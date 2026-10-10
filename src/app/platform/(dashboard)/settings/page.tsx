
"use client";

import { useEffect, useState } from "react";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "11px 12px",
  border: "1px solid #e2e5ea",
  borderRadius: 8,
  fontSize: 14,
  color: "#202228",
  background: "#fff",
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "#4b505b",
  marginBottom: 7,
};

export default function PlatformSettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    async function loadProfile() {
  try {
    const response = await fetch("/api/platform/settings/profile", {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Unable to load your profile.");
    }

    setName(result.name ?? "");
    setEmail(result.email ?? "");
  } catch (error) {
    setProfileError(
      error instanceof Error
        ? error.message
        : "Unable to load your profile. Please log in again."
    );
  } finally {
    setLoading(false);
  }
}    
void loadProfile();
  }, []);
  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setSavingName(true);
  setProfileError("");
  setProfileMessage("");

  const trimmedName = name.trim();

  if (!trimmedName || trimmedName.length > 100) {
    setProfileError("Name must contain 1–100 characters.");
    setSavingName(false);
    return;
  }

  try {
    const response = await fetch("/api/platform/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedName }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Failed to update profile.");
    }

    setName(result.name);
    setEmail(result.email ?? email);
    setProfileMessage("Profile updated successfully.");
  } catch (error) {
    setProfileError(
      error instanceof Error ? error.message : "Failed to update profile."
    );
  } finally {
    setSavingName(false);
  }
}

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setSavingPassword(true);
  setPasswordError("");
  setPasswordMessage("");

  if (!currentPassword || !newPassword || !confirmPassword) {
    setPasswordError("Please fill in all password fields.");
    setSavingPassword(false);
    return;
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    setPasswordError("Your new password must contain 8–128 characters.");
    setSavingPassword(false);
    return;
  }

  if (newPassword !== confirmPassword) {
    setPasswordError("New passwords do not match.");
    setSavingPassword(false);
    return;
  }

  if (currentPassword === newPassword) {
    setPasswordError("Your new password must be different.");
    setSavingPassword(false);
    return;
  }

  try {
    const response = await fetch("/api/platform/settings/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Failed to update password.");
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Password changed successfully.");
  } catch (error) {
    setPasswordError(
      error instanceof Error ? error.message : "Failed to update password."
    );
  } finally {
    setSavingPassword(false);
  }
}

  if (loading) {
    return <p style={{ color: "#777d87" }}>Loading settings...</p>;
  }

  return (
    <div style={{ maxWidth: 850, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: "#202228" }}>
          Settings
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#777d87" }}>
          Manage your profile and account security.
        </p>
      </div>

      {/* Profile */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e8eaf0",
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ padding: 22, borderBottom: "1px solid #eef0f3" }}>
          <h2 style={{ margin: 0, fontSize: 17, color: "#202228" }}>
            Profile
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#777d87" }}>
            Update your account information.
          </p>
        </div>

        <form onSubmit={saveProfile} style={{ padding: 22 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Full Name</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              maxLength={100}
              required
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle}>Email Address</label>
            <input
              style={{ ...inputStyle, background: "#f7f8fa", color: "#777d87" }}
              value={email}
              readOnly
            />
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9297a1" }}>
              Your login email cannot be changed here.
            </p>
          </div>

          {profileError && (
            <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>
              {profileError}
            </p>
          )}

          {profileMessage && (
            <p role="status" style={{ color: "#16803d", fontSize: 13 }}>
              {profileMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={savingName}
            style={primaryButtonStyle(savingName)}
          >
            {savingName ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

      {/* Password */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e8eaf0",
          borderRadius: 12,
        }}
      >
        <div style={{ padding: 22, borderBottom: "1px solid #eef0f3" }}>
          <h2 style={{ margin: 0, fontSize: 17, color: "#202228" }}>
            Change Password
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#777d87" }}>
            Verify your current password before choosing a new one.
          </p>
        </div>

        <form onSubmit={changePassword} style={{ padding: 22 }}>
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <label style={labelStyle}>Current Password</label>
              <input
                style={inputStyle}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>New Password</label>
              <input
                style={inputStyle}
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                style={inputStyle}
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {passwordError && (
            <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>
              {passwordError}
            </p>
          )}

          {passwordMessage && (
            <p role="status" style={{ color: "#16803d", fontSize: 13 }}>
              {passwordMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={savingPassword}
            style={{ ...primaryButtonStyle(savingPassword), marginTop: 22 }}
          >
            {savingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>
    </div>
  );
}

function primaryButtonStyle(disabled: boolean) {
  return {
    padding: "11px 18px",
    border: 0,
    borderRadius: 8,
    background: "#6558d3",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    cursor: disabled ? "wait" : "pointer",
    opacity: disabled ? 0.7 : 1,
  } as const;
}
