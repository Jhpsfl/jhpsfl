import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/studio/", "/admin/", "/account/", "/api/"],
    },
    sitemap: "https://jhpsfl.com/sitemap.xml",
  };
}
