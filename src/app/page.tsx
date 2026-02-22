export const dynamic = 'force-dynamic'

import { sanityFetch } from "@/sanity/lib/live";
import JHPSWebsite from "./components/JHPSWebsite";
import {
  SITE_SETTINGS_QUERY,
  HOME_PAGE_QUERY,
  SERVICES_QUERY,
  GALLERY_QUERY,
} from "@/sanity/queries";

export default async function Home() {
  const [
    { data: settings },
    { data: homePage },
    { data: services },
    { data: gallery },
  ] = await Promise.all([
    sanityFetch({ query: SITE_SETTINGS_QUERY }),
    sanityFetch({ query: HOME_PAGE_QUERY }),
    sanityFetch({ query: SERVICES_QUERY }),
    sanityFetch({ query: GALLERY_QUERY }),
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
