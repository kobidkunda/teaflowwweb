import { HomepageEditor } from "@/components/admin/content/HomepageEditor";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
export default function HomepageAdminPage() { return <AdminAuthGate><HomepageEditor /></AdminAuthGate>; }
