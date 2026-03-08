import type { Metadata } from "next";
import Script from "next/script";
import ServicePageLayout from "../ServicePageLayout";

export const metadata: Metadata = {
  title: "Lawn Care Services in Deltona & Central Florida | JHPS",
  description:
    "Professional lawn care and maintenance in Deltona, Orlando, Sanford & DeLand, FL. Weekly mowing, edging, trimming, leaf removal & seasonal cleanups. Free estimates. Call 407-686-9817.",
  openGraph: {
    title: "Lawn Care Services | Jenkins Home & Property Solutions",
    description: "Weekly mowing, edging, trimming & seasonal cleanups in Central Florida. Free estimates.",
    type: "website",
    url: "https://jhpsfl.com/services/lawn-care",
  },
  alternates: { canonical: "/services/lawn-care" },
};

const faqs = [
  { q: "How often should I have my lawn mowed in Florida?", a: "During the growing season (March-October), we recommend weekly mowing. In the cooler months, bi-weekly is usually sufficient. We'll customize a schedule based on your grass type and property." },
  { q: "Do you offer recurring lawn care plans?", a: "Yes! We offer weekly and bi-weekly maintenance plans. Recurring customers get priority scheduling and consistent pricing with no contracts required." },
  { q: "What does your lawn care service include?", a: "Every visit includes mowing, edging along driveways and walkways, string trimming around obstacles, and blowing all clippings off hard surfaces. We leave your property looking clean and sharp." },
  { q: "Do you service commercial properties?", a: "Absolutely. We maintain commercial lots, HOA common areas, and multi-unit properties throughout Central Florida. Contact us for a commercial quote." },
  { q: "How much does lawn care cost?", a: "Pricing depends on lot size and frequency. Most residential lawns in our area range from $35-$75 per visit. We provide free on-site estimates with no obligation." },
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

export default function LawnCarePage() {
  return (
    <>
      <Script id="faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <ServicePageLayout
        title="Lawn Care"
        icon="🌿"
        headline="Professional Lawn Care in Central Florida"
        description="Keep your property looking sharp year-round. From weekly mowing to seasonal cleanups, our crew delivers consistent, reliable lawn maintenance for homes and businesses across Deltona, Orlando, and surrounding areas."
        includes={[
          "Weekly or bi-weekly mowing",
          "Precision edging along driveways & walks",
          "String trimming around beds & obstacles",
          "Blowing clippings off all hard surfaces",
          "Seasonal leaf & debris cleanup",
          "Overgrown yard restoration",
        ]}
        areas={["Deltona", "Orlando", "Sanford", "DeLand", "Daytona Beach", "Lake Mary", "Debary", "Orange City", "Oviedo", "Winter Springs"]}
        faqs={faqs}
        relatedServices={[
          { title: "Pressure Washing", href: "/services/pressure-washing", icon: "💧" },
          { title: "Junk Removal", href: "/services/junk-removal", icon: "🚛" },
          { title: "Land Clearing", href: "/services/land-clearing", icon: "🌲" },
        ]}
      />
    </>
  );
}
