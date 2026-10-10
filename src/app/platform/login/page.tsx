"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PlatformLogin() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) {
        setError(
          loginError.message ===
            "Invalid login credentials"
            ? "Invalid email or password."
            : loginError.message
        );
        return;
      }

      
if (!data.user) {
  setError("Unable to sign in.");
  return;
}

const accessResponse = await fetch("/api/platform/auth/check", {
  method: "GET",
  cache: "no-store",
});

const accessResult = await accessResponse.json();

if (!accessResponse.ok || !accessResult.authorized) {
  await supabase.auth.signOut();

  setError(
    accessResponse.status === 403
      ? "These credentials are not authorized for the platform. Please use your restaurant login."
      : "Unable to verify platform access. Please try again."
  );

  return;
}

router.replace("/platform");
router.refresh();

    } catch (err) {
      console.error(
        "Platform login error:",
        err
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f6f8",
        padding: "24px",
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "40px",
          boxShadow:
            "0 10px 35px rgba(0, 0, 0, 0.08)",
          border: "1px solid #e8e8e8",
          boxSizing: "border-box",
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "40px",
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
              fontSize: "21px",
              fontWeight: "700",
              flexShrink: 0,
            }}
          >
            S
          </div>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "21px",
                fontWeight: "700",
                color: "#111111",
              }}
            >
              Soraminds
            </h1>

            <p
              style={{
                margin: "2px 0 0",
                fontSize: "13px",
                color: "#777777",
              }}
            >
              Platform
            </p>
          </div>
        </div>

        {/* Heading */}
        <div
          style={{
            marginBottom: "28px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: "700",
              color: "#111111",
            }}
          >
            Welcome back
          </h2>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14px",
              color: "#707070",
              lineHeight: "1.5",
            }}
          >
            Sign in to manage your restaurant
            platform.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#333333",
              }}
            >
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter your email"
              required
              disabled={loading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 13px",
                border: "1px solid #d9d9d9",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                background: "#ffffff",
                color: "#111111",
              }}
            />
          </div>

          {/* Password */}
          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#333333",
              }}
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              required
              disabled={loading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 13px",
                border: "1px solid #d9d9d9",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                background: "#ffffff",
                color: "#111111",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "11px 12px",
                borderRadius: "8px",
                background: "#fff1f1",
                color: "#c62828",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "8px",
              padding: "13px",
              background: "#111111",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "600",
              cursor: loading
                ? "not-allowed"
                : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Signing in..."
              : "Sign in"}
          </button>
        </form>

        {/* Footer */}
        <p
          style={{
            margin: "28px 0 0",
            textAlign: "center",
            fontSize: "12px",
            color: "#999999",
          }}
        >
          Soraminds Platform
        </p>
      </div>
    </div>
  );
}