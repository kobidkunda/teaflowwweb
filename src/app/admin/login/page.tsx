"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { useAdminAuth } from "@/components/admin/layout/AdminAuthContext";
import Link from "next/link";

function LoginSuccess() {
  const router = useRouter();
  const { user } = useAdminAuth();

  useEffect(() => {
    if (user) {
      router.replace("/admin");
    }
  }, [user, router]);

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
      <h2>Signed in as {user?.username}</h2>
      <p style={{ margin: "16px 0", color: "#63665e" }}>Redirecting to dashboard…</p>
      <Link href="/admin" className="button button-primary">
        Go to Admin Dashboard
      </Link>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <AdminAuthGate>
      <LoginSuccess />
    </AdminAuthGate>
  );
}
