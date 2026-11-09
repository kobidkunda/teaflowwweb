import React from "react";
import { AdminShell } from "@/components/admin/layout/AdminShell";
import { AdminAuthProvider } from "@/components/admin/layout/AdminAuthContext";

export const metadata = {
  title: "Admin | Himalayan Tea House",
  description: "Account-gated store administration console",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          background: #fbf8f1;
        }
        .admin-table caption {
          text-align: left;
          padding: 8px 0;
        }
        .admin-table th, .admin-table td {
          border: 1px solid #d9d4c8;
          padding: 10px 12px;
          text-align: left;
          vertical-align: top;
        }
        .admin-table thead th {
          background: #ede9df;
        }
      `}</style>
      <AdminAuthProvider>
        <AdminShell>{children}</AdminShell>
      </AdminAuthProvider>
    </>
  );
}
