import { client } from "@/sanity/lib/client";
import { COMMERCIAL_PAGE_QUERY, SITE_SETTINGS_QUERY } from "@/sanity/queries";
import CommercialPage from "./CommercialPageClient";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Commercial Property Services | JHPS - Jenkins Home & Property Solutions",
  description:
    "Commercial lawn care, pressure washing, land clearing & property maintenance for businesses, HOAs, and property managers in Central Florida. Licensed & insured. Free estimates.",
  openGraph: {
    title: "Commercial Property Services | JHPS Florida",
    description: "Professional property maintenance for businesses, HOAs & property managers. Serving Central Florida.",
    type: "website",
    url: "https://jhpsfl.com/commercial",
  },
  alternates: { canonical: "/commercial" },
};

export default async function CommercialPageRoute() {
  const [data, siteSettings] = await Promise.all([
    client.fetch(COMMERCIAL_PAGE_QUERY).catch(() => null),
    client.fetch(SITE_SETTINGS_QUERY).catch(() => null),
  ]);
  return <CommercialPage data={data ?? undefined} siteSettings={siteSettings ?? undefined} />;
}
