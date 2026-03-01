import AdminDashboard from "./AdminDashboard";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Dashboard | JHPS",
  description: "Jenkins Home & Property Solutions - Admin CRM Dashboard",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
