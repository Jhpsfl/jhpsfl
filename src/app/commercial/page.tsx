import { client } from "@/sanity/lib/client";
import { COMMERCIAL_PAGE_QUERY, SITE_SETTINGS_QUERY } from "@/sanity/queries";
import CommercialPage from "./CommercialPageClient";

export const revalidate = 60;

export default async function CommercialPageRoute() {
  const [data, siteSettings] = await Promise.all([
    client.fetch(COMMERCIAL_PAGE_QUERY).catch(() => null),
    client.fetch(SITE_SETTINGS_QUERY).catch(() => null),
  ]);
  return <CommercialPage data={data ?? undefined} siteSettings={siteSettings ?? undefined} />;
}
