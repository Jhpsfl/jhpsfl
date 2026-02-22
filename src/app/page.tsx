export const dynamic = 'force-dynamic'

import { client } from "@/sanity/lib/client";
import JHPSWebsite from "./components/JHPSWebsite";
import {
  SITE_SETTINGS_QUERY,
  HOME_PAGE_QUERY,
  SERVICES_QUERY,
  GALLERY_QUERY,
} from "@/sanity/queries";

export default async function Home() {
  const [settings, homePage, services, gallery] = await Promise.all([
    client.fetch(SITE_SETTINGS_QUERY),
    client.fetch(HOME_PAGE_QUERY),
    client.fetch(SERVICES_QUERY),
    client.fetch(GALLERY_QUERY),
  ]);

  return (
    <JHPSWebsite
      settings={settings}
      homePage={homePage}
      services={services}
      gallery={gallery}
    />
  );
}
