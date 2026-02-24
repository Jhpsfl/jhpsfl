import type { Metadata, Viewport } from "next";
import AdminSwRegistrar from "./AdminSwRegistrar";

export const viewport: Viewport = {
  themeColor: "#050e05",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "JHPS Admin",
  manifest: "/admin-manifest.json",
  appleWebApp: {
    capable: true,
    title: "JHPS Admin",
    statusBarStyle: "black-translucent",
    startupImage: [{ url: "/favicon-512.png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminSwRegistrar />
      {children}
    </>
  );
}
