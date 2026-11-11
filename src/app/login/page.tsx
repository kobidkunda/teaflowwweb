"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff, Sparkles, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

function LoginFormInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectUrl = searchParams ? searchParams.get("redirect") || "/account/orders" : "/account/orders";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  function handleFillDemo() {
    setMode("login");
    setEmail("tasting.room@teafloww.com");
    setPassword("HimalayanTea@2026");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      const payload =
        mode === "register"
          ? { action: "register", email: cleanEmail, password: cleanPassword, name: name.trim(), phone: phone.trim() }
          : { action: "login", identifier: cleanEmail, password: cleanPassword };

      const res = await fetch("/api/customer/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed. Please check your credentials.");
      }

      setSuccessMsg(mode === "register" ? "Account created successfully! Redirecting…" : "Welcome back! Redirecting…");
      setTimeout(() => {
        window.location.assign(redirectUrl);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDemoLogin() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "demo" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Demo login failed");
      setSuccessMsg("Signed in with Tasting Room demo account! Redirecting…");
      setTimeout(() => {
        window.location.assign(redirectUrl);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto py-12 px-4 sm:px-6">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center justify-center gap-2 mb-3">
          <BrandLogo variant="symbol" size={38} aria-hidden={true} />
        </Link>
        <h1 className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal">
          {mode === "login" ? "Sign in to TeaFloww" : "Create your TeaFloww Account"}
        </h1>
        <p className="text-xs sm:text-sm text-[#5c6659] mt-1.5 max-w-sm mx-auto">
          {mode === "login"
            ? "Access your past orders, manage saved addresses, and track shipments from Siliguri."
            : "Save delivery preferences, track single-estate harvests, and unlock fast 1-click checkout."}
        </p>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex border-b border-[#ded7cb] mb-4" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={`flex-1 pb-3 text-xs sm:text-sm font-semibold transition-all relative ${
            mode === "login" ? "text-[#23483a]" : "text-[#757065] hover:text-[#171713]"
          }`}
        ><StorefrontText id="copy_bcc0bcc9140b0c97" fallback="Sign In" />
          {mode === "login" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#23483a]" />
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => {
            setMode("register");
            setError(null);
          }}
          className={`flex-1 pb-3 text-xs sm:text-sm font-semibold transition-all relative ${
            mode === "register" ? "text-[#23483a]" : "text-[#757065] hover:text-[#171713]"
          }`}
        ><StorefrontText id="copy_0dffe234b44793b6" fallback="Create Account" />
          {mode === "register" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#23483a]" />
          )}
        </button>
      </div>

      {/* Demo Credentials Quick Fill Bar */}
      <div className="mb-5 flex items-center justify-between p-2.5 rounded-lg bg-[#f6f1e7] border border-[#ded7cb] text-xs">
        <span className="text-[#5c6659]"><StorefrontText id="copy_e694cf8b748ad69e" fallback="Tasting Room Demo?" /></span>
        <button
          type="button"
          onClick={handleFillDemo}
          className="font-bold text-[#23483a] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Sparkles size={13} className="text-[#b39156]" />
          <span><StorefrontText id="copy_5ec97dd79327f9fe" fallback="Auto-fill Demo Details" /></span>
        </button>
      </div>

      {/* Error & Success Alerts */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 p-3.5 rounded-xl border border-[#fca5a5] bg-[#fef2f2] text-xs text-[#991b1b] flex items-start gap-2.5"
        >
          <span className="font-bold flex-none"><StorefrontText id="copy_c77db0ab2c5d60f6" fallback="Notice:" /></span>
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 p-3.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] text-xs text-[#166534] flex items-center gap-2"
        >
          <CheckCircle2 size={16} className="text-[#16a34a] flex-none" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <div>
            <label
              htmlFor="register-name"
              className="block text-xs font-semibold text-[#171713] mb-1"
            ><StorefrontText id="copy_8fec1bff94bf651a" fallback="Full Name *" />
            </label>
            <input
              id="register-name"
              name="name"
              type="text"
              required
              maxLength={100}
              autoComplete="name"
              placeholder="e.g. Ananya Roy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              className="w-full min-h-[46px] border border-[#b8b5a8] rounded-lg px-3.5 py-2.5 bg-[#fffefa] text-sm text-[#171713] placeholder-[#8f8c82] focus:border-[#23483a] focus:ring-1 focus:ring-[#23483a] outline-none"
            />
          </div>
        )}

        <div>
          <label htmlFor="customer-email" className="block text-xs font-semibold text-[#171713] mb-1"><StorefrontText id="copy_1b72562c828c7223" fallback="Email Address *" />
          </label>
          <input
            id="customer-email"
            name="email"
            type="email"
            required
            maxLength={120}
            autoComplete="username"
            spellCheck={false}
            placeholder="e.g. yourname@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className="w-full min-h-[46px] border border-[#b8b5a8] rounded-lg px-3.5 py-2.5 bg-[#fffefa] text-sm text-[#171713] placeholder-[#8f8c82] focus:border-[#23483a] focus:ring-1 focus:ring-[#23483a] outline-none"
          />
        </div>

        {mode === "register" && (
          <div>
            <label htmlFor="register-phone" className="block text-xs font-semibold text-[#171713] mb-1"><StorefrontText id="copy_cd401e467be20b4e" fallback="Contact Phone (Optional)" />
            </label>
            <input
              id="register-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={20}
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
              className="w-full min-h-[46px] border border-[#b8b5a8] rounded-lg px-3.5 py-2.5 bg-[#fffefa] text-sm text-[#171713] placeholder-[#8f8c82] focus:border-[#23483a] focus:ring-1 focus:ring-[#23483a] outline-none"
            />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="customer-password"
              className="block text-xs font-semibold text-[#171713]"
            ><StorefrontText id="copy_7c6dc119843f036f" fallback="Password *" />
            </label>
            {mode === "login" && (
              <span className="text-[11px] text-[#757065]"><StorefrontText id="copy_e4e54a0028c8bac4" fallback="Min 8 characters" />
              </span>
            )}
          </div>
          <div className="relative">
            <input
              id="customer-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              maxLength={128}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full min-h-[46px] border border-[#b8b5a8] rounded-lg pl-3.5 pr-11 py-2.5 bg-[#fffefa] text-sm text-[#171713] placeholder-[#8f8c82] focus:border-[#23483a] focus:ring-1 focus:ring-[#23483a] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757065] hover:text-[#171713] p-1"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full min-h-[48px] rounded-lg bg-[#23483a] text-white hover:bg-[#1a362b] transition-colors font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 mt-2 shadow-sm disabled:opacity-60"
        >
          {busy ? (
            "Please wait…"
          ) : mode === "login" ? (
            <><StorefrontText id="copy_bcc0bcc9140b0c97" fallback="Sign In" /> <ArrowRight size={15} />
            </>
          ) : (
            <><StorefrontText id="copy_0dffe234b44793b6" fallback="Create Account" /> <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      {/* Demo Account 1-Click Fast Pass */}
      <div className="mt-6 pt-6 border-t border-[#ded7cb]">
        <div className="p-4 rounded-xl border border-[#d2c9b8] bg-[#f9f7f2] text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#b39156] flex items-center justify-center gap-1 mb-1">
            <Sparkles size={13} /><StorefrontText id="copy_775534ca018daf3a" fallback="Instant Verification Mode" />
          </p>
          <p className="text-xs text-[#524e46] mb-3"><StorefrontText id="copy_be28b2e7356b7df9" fallback="Evaluating the tea commerce journey? Sign in immediately with preloaded tasting orders and addresses." />
          </p>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={busy}
            className="w-full min-h-[42px] rounded-lg border border-[#23483a] text-[#23483a] hover:bg-[#23483a] hover:text-white transition-colors text-xs font-semibold flex items-center justify-center gap-2"
          >
            <span><StorefrontText id="copy_fd5bd43f9a9339b8" fallback="One-Click Tasting Room Login" /></span>
          </button>
        </div>
      </div>

      {/* Trust & Privacy Footnote */}
      <div className="mt-8 text-center text-[11px] text-[#757065] flex items-center justify-center gap-1.5">
        <ShieldCheck size={14} className="text-[#23483a]" />
        <span><StorefrontText id="copy_9f5586cb55e7c96c" fallback="TLS 1.3 encrypted · Zero third-party tracker data sharing" /></span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[#fdfbf7] py-8">
      <Suspense fallback={<div className="text-center p-8 text-xs text-[#5c6659]"><StorefrontText id="copy_a85680660c9c16fd" fallback="Loading login…" /></div>}>
        <LoginFormInner />
      </Suspense>
    </div>
  );
}
