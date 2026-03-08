import type { Metadata } from "next";
import Script from "next/script";
import ServicePageLayout from "../ServicePageLayout";

export const metadata: Metadata = {
  title: "Land Clearing Services in Deltona & Central Florida | JHPS",
  description:
    "Professional land clearing, brush removal, lot clearing & grading in Deltona, Orlando, Sanford & DeLand, FL. Residential & commercial. Free estimates. Call 407-686-9817.",
  openGraph: {
    title: "Land Clearing Services | Jenkins Home & Property Solutions",
    description: "Brush removal, lot clearing & grading for residential and commercial properties in Central Florida.",
    type: "website",
    url: "https://jhpsfl.com/services/land-clearing",
  },
  alternates: { canonical: "/services/land-clearing" },
};

const faqs = [
  { q: "What does land clearing include?", a: "Our land clearing service covers brush and vegetation removal, small tree clearing, stump grinding, debris hauling, and basic grading. We prepare lots for construction, landscaping, or general property improvement." },
  { q: "Can you clear overgrown vacant lots?", a: "Yes, that's one of our specialties. We regularly clear neglected and overgrown vacant lots for homeowners, investors, and property managers. We can take a completely overgrown property and make it clean and usable." },
  { q: "Do you handle commercial land clearing?", a: "We handle small to mid-size commercial clearing projects — parking lot expansions, easement clearing, retention pond maintenance, and buildable lot preparation. For very large acreage, we can provide referrals." },
  { q: "How long does land clearing take?", a: "It depends on the size and density of vegetation. A standard residential lot can often be cleared in 1-2 days. Larger or heavily overgrown properties may take 3-5 days. We'll give you a timeline with your estimate." },
  { q: "Do you remove the debris after clearing?", a: "Yes. We haul away all brush, vegetation, and debris as part of the job. When we leave, your property is clean and ready for its next use." },
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

export default function LandClearingPage() {
  return (
    <>
      <Script id="faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <ServicePageLayout
        title="Land Clearing"
        icon="🌲"
        headline="Land Clearing & Brush Removal in Central Florida"
        description="From overgrown vacant lots to buildable land prep, we clear properties efficiently and affordably. Brush removal, small tree clearing, stump grinding, and debris hauling — all in one crew."
        includes={[
          "Brush & vegetation removal",
          "Small tree clearing",
          "Stump grinding",
          "Lot grading & leveling",
          "Debris hauling & disposal",
          "Vacant lot restoration",
        ]}
        areas={["Deltona", "Orlando", "Sanford", "DeLand", "Daytona Beach", "Lake Mary", "Debary", "Orange City", "Oviedo", "Winter Springs"]}
        faqs={faqs}
        relatedServices={[
          { title: "Lawn Care", href: "/services/lawn-care", icon: "🌿" },
          { title: "Pressure Washing", href: "/services/pressure-washing", icon: "💧" },
          { title: "Junk Removal", href: "/services/junk-removal", icon: "🚛" },
        ]}
      />
    </>
  );
}
