import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    short_name: "JHPS Admin",
    name: "JHPS Florida Admin Portal",
    description: "Internal management tool for JHPS team.",
    icons: [
      { src: "/favicon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/favicon-192.png", type: "image/png", sizes: "192x192", purpose: "maskable" },
      { src: "/favicon-512.png", type: "image/png", sizes: "512x512" },
      { src: "/favicon-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
    start_url: "/admin",
    scope: "/admin",
    background_color: "#050e05",
    theme_color: "#050e05",
    display: "standalone",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    // Additional PWA features for better mobile experience
    shortcuts: [
      {
        name: "New Job",
        short_name: "New Job",
        description: "Create a new job",
        url: "/admin?action=new-job",
        icons: [{ src: "/favicon-192.png", sizes: "192x192" }]
      },
      {
        name: "Video Leads",
        short_name: "Leads",
        description: "View video quote leads",
        url: "/admin?tab=video_leads",
        icons: [{ src: "/favicon-192.png", sizes: "192x192" }]
      }
    ],
    // Better mobile support
    prefer_related_applications: false,
    // iOS specific
    apple_touch_icon: "/favicon-192.png",
    apple_mobile_web_app_capable: "yes",
    apple_mobile_web_app_status_bar_style: "black-translucent",
  };
}
