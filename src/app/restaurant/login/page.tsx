"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RestaurantLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/restaurant/dashboard");
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f6f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          border: "1px solid #e7e9ed",
          borderRadius: "16px",
          padding: "40px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            background: "#111111",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: 700,
            marginBottom: "24px",
          }}
        >
          S
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: 700,
            color: "#202228",
          }}
        >
          Restaurant Admin
        </h1>

        <p
          style={{
            margin: "8px 0 28px",
            fontSize: "13px",
            color: "#858a94",
          }}
        >
          Sign in to manage your restaurant
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#44474e",
                marginBottom: "7px",
              }}
            >
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 12px",
                border: "1px solid #dfe2e7",
                borderRadius: "8px",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#44474e",
                marginBottom: "7px",
              }}
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 12px",
                border: "1px solid #dfe2e7",
                borderRadius: "8px",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#fff1f1",
                border: "1px solid #ffd5d5",
                color: "#c62828",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "12px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              border: "none",
              background: loading ? "#777777" : "#111111",
              color: "#ffffff",
              borderRadius: "8px",
              padding: "11px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div
          style={{
            marginTop: "28px",
            paddingTop: "18px",
            borderTop: "1px solid #eeeeee",
            textAlign: "center",
            fontSize: "11px",
            color: "#9a9da4",
          }}
        >
          Soraminds Platform
        </div>
      </div>
    </main>
  );
}