import type { Metadata } from "next";
import Script from "next/script";
import ServicePageLayout from "../ServicePageLayout";

export const metadata: Metadata = {
  title: "Pressure Washing Services in Deltona & Central Florida | JHPS",
  description:
    "Professional pressure washing and soft wash services in Deltona, Orlando, Sanford & DeLand, FL. Driveways, sidewalks, buildings, roofs & more. Free estimates. Call 407-686-9817.",
  openGraph: {
    title: "Pressure Washing Services | Jenkins Home & Property Solutions",
    description: "High-pressure & soft wash for driveways, buildings & sidewalks in Central Florida. Free estimates.",
    type: "website",
    url: "https://jhpsfl.com/services/pressure-washing",
  },
  alternates: { canonical: "/services/pressure-washing" },
};

const faqs = [
  { q: "What's the difference between pressure washing and soft washing?", a: "Pressure washing uses high-pressure water to clean hard surfaces like concrete and brick. Soft washing uses lower pressure with specialized cleaning solutions — ideal for roofs, siding, and painted surfaces where high pressure could cause damage." },
  { q: "How often should I pressure wash my driveway?", a: "In Florida's humid climate, we recommend pressure washing driveways and sidewalks at least once a year. Properties near trees or with heavy shade may benefit from twice-yearly cleaning to prevent mold and algae buildup." },
  { q: "Can pressure washing damage my property?", a: "When done incorrectly, yes. That's why we assess every surface before starting and use the appropriate pressure and technique. Delicate surfaces like stucco, wood, and roofing get our soft wash treatment instead." },
  { q: "Do you pressure wash commercial properties?", a: "Yes. We handle storefronts, parking lots, dumpster pads, building exteriors, and drive-throughs. Regular commercial pressure washing keeps your business looking professional and helps prevent slip hazards." },
  { q: "How much does pressure washing cost?", a: "Pricing depends on the surface area and type. A standard driveway typically runs $100-$200. Full house exteriors and commercial properties are quoted on-site. We always provide free estimates." },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(f => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function PressureWashingPage() {
  return (
    <>
      <Script id="faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <ServicePageLayout
        title="Pressure Washing"
        icon="💧"
        headline="Pressure Washing & Soft Wash in Central Florida"
        description="Restore your property's curb appeal with professional pressure washing. We clean driveways, sidewalks, building exteriors, roofs, and more — using the right technique for every surface."
        includes={[
          "Driveway & sidewalk cleaning",
          "Building & house exterior wash",
          "Roof soft washing",
          "Fence & deck cleaning",
          "Dumpster pad cleaning",
          "Commercial storefront washing",
        ]}
        areas={["Deltona", "Orlando", "Sanford", "DeLand", "Daytona Beach", "Lake Mary", "Debary", "Orange City", "Oviedo", "Winter Springs"]}
        faqs={faqs}
        relatedServices={[
          { title: "Lawn Care", href: "/services/lawn-care", icon: "🌿" },
          { title: "Junk Removal", href: "/services/junk-removal", icon: "🚛" },
          { title: "Land Clearing", href: "/services/land-clearing", icon: "🌲" },
        ]}
      />
    </>
  );
}
