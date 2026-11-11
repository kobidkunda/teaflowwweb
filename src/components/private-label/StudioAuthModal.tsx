"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect, useRef } from "react";
import { X, Lock, CheckCircle2, AlertCircle, Eye, EyeOff, MessageCircle } from "lucide-react";
import { formatWhatsAppDigits } from "@/lib/private-label/whatsapp";

export interface StudioAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  intendedAction?: "quote" | "draft";
  whatsappNumber?: string;
}

export function StudioAuthModal({
  isOpen,
  onClose,
  onSuccess,
  intendedAction = "quote",
  whatsappNumber = "+91 7001304853",
}: StudioAuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [identifier, setIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      setError(null);
      setLoading(false);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
        if (e.key === "Tab" && modalRef.current) {
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";

      // Focus the first input after mount
      const timer = setTimeout(() => {
        const input = modalRef.current?.querySelector<HTMLInputElement>("input");
        input?.focus();
      }, 50);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
        clearTimeout(timer);
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actionVerb = intendedAction === "quote" ? "Generate Official Quotation" : "Save Draft Project";

  const cleanDigits = formatWhatsAppDigits(whatsappNumber);
  const whatsappUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(
    "Hello TeaFloww! I'm in the Private Label Studio and would like help generating a custom quotation."
  )}`;

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !loginPassword.trim()) {
      setError("Please enter your email or phone number and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/customer/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          identifier: identifier.trim(),
          password: loginPassword.trim(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Authentication failed. Please check your credentials.");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !registerPassword.trim()) {
      setError("Please fill in your name, email, and choose a password.");
      return;
    }
    if (registerPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/customer/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password: registerPassword.trim(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Registration failed. Please check your information.");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(12, 37, 30, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "460px",
          boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(20, 60, 49, 0.08)",
          overflow: "hidden",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <style>{`
          @keyframes modalFadeIn {
            from {
              opacity: 0;
              transform: scale(0.96) translateY(8px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #143C31 0%, #0C251E 100%)",
            color: "#FFFCF7",
            padding: "24px 24px 20px",
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "rgba(255, 255, 255, 0.12)",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFCF7",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.6875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#D7B474",
              }}
            >
              <Lock size={12} /><StorefrontText id="copy_f8fdbf0fc119a6a5" fallback="Account Required" />
            </span>
          </div>

          <h2
            id="auth-modal-title"
            style={{
              margin: 0,
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: "1.375rem",
              lineHeight: 1.25,
              color: "#FFFCF7",
            }}
          >
            {tab === "login" ? "Sign in to generate quotation" : "Create account for quotation"}
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "0.8125rem",
              color: "#DDE4DC",
              lineHeight: 1.45,
            }}
          ><StorefrontText id="copy_cb68712fffbe48d9" fallback="Your recipe and packaging selections are saved on this device. Sign in to link your project and issue your quotation reference." />
          </p>
        </div>

        {/* Tab switcher */}
        <div
          role="tablist"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderBottom: "1px solid #ECEEEA",
            background: "#F9FAF9",
          }}
        >
          <button
            role="tab"
            aria-selected={tab === "login"}
            type="button"
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            style={{
              padding: "12px",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              background: tab === "login" ? "#FFFFFF" : "transparent",
              color: tab === "login" ? "#143C31" : "#65746D",
              borderBottom: tab === "login" ? "2px solid #143C31" : "2px solid transparent",
              cursor: "pointer",
            }}
          ><StorefrontText id="copy_bcc0bcc9140b0c97" fallback="Sign In" />
          </button>
          <button
            role="tab"
            aria-selected={tab === "register"}
            type="button"
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            style={{
              padding: "12px",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              background: tab === "register" ? "#FFFFFF" : "transparent",
              color: tab === "register" ? "#143C31" : "#65746D",
              borderBottom: tab === "register" ? "2px solid #143C31" : "2px solid transparent",
              cursor: "pointer",
            }}
          ><StorefrontText id="copy_a1e1b0fc3641d686" fallback="Create Free Account" />
          </button>
        </div>

        {/* Body Form */}
        <div style={{ padding: "24px" }}>
          {error && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                padding: "12px 14px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: "8px",
                color: "#991B1B",
                fontSize: "0.8125rem",
                lineHeight: 1.4,
                marginBottom: "16px",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{error}</span>
            </div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label
                  htmlFor="auth-identifier"
                  style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#143C31", marginBottom: "6px" }}
                ><StorefrontText id="copy_9db2abf693044ed2" fallback="Email Address or Phone" />
                </label>
                <input
                  id="auth-identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@company.com"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    border: "1px solid #DDE4DC",
                    fontSize: "0.9375rem",
                    color: "#143C31",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label
                    htmlFor="auth-password"
                    style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#143C31" }}
                  ><StorefrontText id="copy_e7cf3ef4f17c3999" fallback="Password" />
                  </label>
                  <a
                    href="/login"
                    target="_blank"
                    style={{ fontSize: "0.75rem", color: "#143C31", textDecoration: "underline" }}
                  ><StorefrontText id="copy_30c1d8d3e9128893" fallback="Forgot password?" />
                  </a>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 40px 10px 14px",
                      borderRadius: "6px",
                      border: "1px solid #DDE4DC",
                      fontSize: "0.9375rem",
                      color: "#143C31",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#65746D",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  minHeight: "46px",
                  padding: "12px 20px",
                  backgroundColor: "#143C31",
                  color: "#FFFCF7",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  cursor: loading ? "wait" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  marginTop: "8px",
                  transition: "background 0.2s ease",
                }}
              >
                {loading ? "Authenticating..." : `Sign In & ${actionVerb}`}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label
                  htmlFor="reg-name"
                  style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#143C31", marginBottom: "4px" }}
                ><StorefrontText id="copy_8e00cdf71fa7cc76" fallback="Full Name" />
                </label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maya Sharma"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #DDE4DC",
                    fontSize: "0.875rem",
                    color: "#143C31",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#143C31", marginBottom: "4px" }}
                ><StorefrontText id="copy_4b7605707e64ad37" fallback="Email Address (for Quotation Delivery)" />
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@brand.com"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #DDE4DC",
                    fontSize: "0.875rem",
                    color: "#143C31",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="reg-phone"
                  style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#143C31", marginBottom: "4px" }}
                ><StorefrontText id="copy_c4c66c67dfb189d3" fallback="Phone / WhatsApp (Optional)" />
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #DDE4DC",
                    fontSize: "0.875rem",
                    color: "#143C31",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#143C31", marginBottom: "4px" }}
                ><StorefrontText id="copy_cc619a53a8d6c121" fallback="Choose Password (min 6 characters)" />
                </label>
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #DDE4DC",
                    fontSize: "0.875rem",
                    color: "#143C31",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  minHeight: "46px",
                  padding: "12px 20px",
                  backgroundColor: "#143C31",
                  color: "#FFFCF7",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  cursor: loading ? "wait" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  marginTop: "6px",
                  transition: "background 0.2s ease",
                }}
              >
                {loading ? "Creating Account..." : `Create Account & ${actionVerb}`}
              </button>
            </form>
          )}

          {/* WhatsApp Direct Help fallback */}
          <div
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid #ECEEEA",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: "0.75rem", color: "#65746D" }}><StorefrontText id="copy_f82b22d963bbb2ac" fallback="Prefer to consult with our tea desk before creating an account?" />
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#128C7E",
                textDecoration: "none",
              }}
            >
              <MessageCircle size={16} fill="#25D366" color="#25D366" />
              <span><StorefrontText id="copy_e784d9d49932cec3" fallback="Chat directly on WhatsApp (" />{whatsappNumber})</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
