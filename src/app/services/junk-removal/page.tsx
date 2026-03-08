import type { Metadata } from "next";
import Script from "next/script";
import ServicePageLayout from "../ServicePageLayout";

export const metadata: Metadata = {
  title: "Junk Removal Services in Deltona & Central Florida | JHPS",
  description:
    "Fast, affordable junk removal and hauling in Deltona, Orlando, Sanford & DeLand, FL. Furniture, appliances, debris, construction waste & more. Same-day available. Call 407-686-9817.",
  openGraph: {
    title: "Junk Removal Services | Jenkins Home & Property Solutions",
    description: "Fast, affordable haul-away for furniture, debris & appliances in Central Florida. Free estimates.",
    type: "website",
    url: "https://jhpsfl.com/services/junk-removal",
  },
  alternates: { canonical: "/services/junk-removal" },
};

const faqs = [
  { q: "What items do you haul away?", a: "We remove almost anything — furniture, appliances, mattresses, electronics, yard debris, construction waste, hot tubs, sheds, and general household junk. If you're unsure, just ask. The only things we can't take are hazardous materials like paint, chemicals, and asbestos." },
  { q: "Do you offer same-day junk removal?", a: "Yes, when our schedule allows. We try to accommodate same-day and next-day requests, especially for urgent cleanouts. Call us and we'll let you know our earliest availability." },
  { q: "How is junk removal priced?", a: "We price by volume — how much space your items take up in our truck. We give you an upfront quote before we start, so there are no surprises. Most single-item pickups start around $75, and full truck loads run $300-$500." },
  { q: "Do I need to move the junk outside first?", a: "No. Our crew handles everything. We'll come inside, carry items out, load the truck, and clean up the area. You just point to what needs to go." },
  { q: "Do you handle estate cleanouts?", a: "Yes. We do full estate cleanouts, foreclosure cleanups, and tenant move-out cleanings. We can clear an entire house or just specific rooms. We work efficiently and respectfully." },
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

export default function JunkRemovalPage() {
  return (
    <>
      <Script id="faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <ServicePageLayout
        title="Junk Removal"
        icon="🚛"
        headline="Junk Removal & Hauling in Central Florida"
        description="Need stuff gone? We handle the heavy lifting. From single-item pickups to full property cleanouts, our crew removes and hauls away your junk fast and affordably."
        includes={[
          "Furniture & appliance removal",
          "Yard debris & brush hauling",
          "Construction waste cleanup",
          "Estate & foreclosure cleanouts",
          "Garage & storage unit clearing",
          "Hot tub & shed removal",
        ]}
        areas={["Deltona", "Orlando", "Sanford", "DeLand", "Daytona Beach", "Lake Mary", "Debary", "Orange City", "Oviedo", "Winter Springs"]}
        faqs={faqs}
        relatedServices={[
          { title: "Lawn Care", href: "/services/lawn-care", icon: "🌿" },
          { title: "Pressure Washing", href: "/services/pressure-washing", icon: "💧" },
          { title: "Land Clearing", href: "/services/land-clearing", icon: "🌲" },
        ]}
      />
    </>
  );
}
