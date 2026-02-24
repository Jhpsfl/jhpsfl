import type { Metadata, Viewport } from "next";
import AdminSwRegistrar from "./AdminSwRegistrar";

export const viewport: Viewport = {
  themeColor: "#050e05",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

export const metadata: Metadata = {
  title: "JHPS Admin",
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
      {/* Add mobile-friendly meta tags */}
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="HandheldFriendly" content="true" />
      </head>
      {children}
    </>
  );
}
