import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Commercial Property Services | Jenkins Home & Property Solutions",
  description:
    "Professional property maintenance, turnovers, and recurring service programs for property managers, investors, HOAs, and commercial facilities across Central Florida. Online billing, recurring scheduling, and fast turnovers.",
  keywords: [
    "commercial property maintenance Central Florida",
    "property turnover services Orlando",
    "HOA exterior maintenance Florida",
    "property management vendor Deltona",
    "commercial pressure washing Orlando",
    "rental property turnover service",
    "recurring property maintenance program",
    "junk removal commercial Florida",
    "property cleanup services Central Florida",
    "vendor onboarding property management",
  ],
  openGraph: {
    title: "Commercial Property Services | JHPS Florida",
    description:
      "One vendor for property turnovers, exterior maintenance, junk removal, lawn care, and land clearing. Online billing, recurring programs, and 24-48hr turnover availability.",
    url: "https://jhpsfl.com/commercial",
    siteName: "Jenkins Home & Property Solutions",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://jhpsfl.com/og-commercial.jpg",
        width: 1200,
        height: 630,
        alt: "JHPS Commercial Property Maintenance Services",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Commercial Property Services | JHPS Florida",
    description:
      "Property maintenance infrastructure for managers, investors & HOAs. Online billing, recurring programs, fast turnovers.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://jhpsfl.com/commercial",
  },
};

export default function CommercialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="commercial-services-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Commercial Property Maintenance Services",
            provider: {
              "@type": "LocalBusiness",
              name: "Jenkins Home & Property Solutions",
              telephone: "407-686-9817",
              url: "https://jhpsfl.com",
              areaServed: {
                "@type": "State",
                name: "Florida",
              },
            },
            description:
              "Professional property maintenance, turnovers, and recurring service programs for property managers, investors, HOAs, and commercial facilities.",
            serviceType: [
              "Property Turnovers",
              "Exterior Pressure Washing",
              "Lawn & Grounds Maintenance",
              "Junk Removal & Cleanouts",
              "Land Clearing",
              "Curb Appeal Restoration",
            ],
            areaServed: [
              "Deltona, FL",
              "Orlando, FL",
              "Sanford, FL",
              "DeLand, FL",
              "Daytona Beach, FL",
            ],
            url: "https://jhpsfl.com/commercial",
          }),
        }}
      />
      {children}
    </>
  );
}
