import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SanityLive } from "@/sanity/lib/live";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jenkins Home & Property Solutions | Lawn Care, Pressure Washing & More | Deltona, FL",
  description: "Central Florida's trusted property services company. Lawn care, pressure washing, junk removal, land clearing & property cleanups. Serving Deltona, Orlando, Sanford, DeLand & surrounding areas. Free estimates. Call 407-686-9817.",
  keywords: "lawn care Deltona FL, pressure washing Orlando, junk removal Central Florida, land clearing Deltona, property cleanup Orlando, lawn mowing Sanford FL, soft wash DeLand, Jenkins Home Property Solutions",
  authors: [{ name: "Jenkins Home & Property Solutions" }],
  creator: "Jenkins Home & Property Solutions",
  metadataBase: new URL("https://jhpsfl.com"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Jenkins Home & Property Solutions | Lawn Care & Property Services",
    description: "Lawn care, pressure washing, junk removal, land clearing & property cleanups in Central Florida. Free estimates. Call 407-686-9817.",
    url: "https://jhpsfl.com",
    siteName: "Jenkins Home & Property Solutions",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://cdn.sanity.io/images/fiublsi2/production/d1b9d7c905b59b28febea0c27b032a9718ca58ac-1024x1024.png",
        width: 1200,
        height: 630,
        alt: "Jenkins Home & Property Solutions - Central Florida Property Services",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jenkins Home & Property Solutions | Central Florida",
    description: "Lawn care, pressure washing, junk removal & more. Serving Deltona, Orlando & Central Florida. Free estimates!",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  verification: {
    google: "", // TODO: paste Google Search Console verification code here
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          id="local-business-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "@id": "https://jhpsfl.com",
              "name": "Jenkins Home & Property Solutions",
              "alternateName": "JHPS Florida",
              "description": "Central Florida's trusted partner for lawn care, pressure washing, junk removal, land clearing, and property cleanups.",
              "url": "https://jhpsfl.com",
              "telephone": "+14076869817",
              "email": "FRLawnCareFL@gmail.com",
              "logo": "https://cdn.sanity.io/images/fiublsi2/production/d1b9d7c905b59b28febea0c27b032a9718ca58ac-1024x1024.png",
              "image": "https://cdn.sanity.io/images/fiublsi2/production/d1b9d7c905b59b28febea0c27b032a9718ca58ac-1024x1024.png",
              "priceRange": "$$",
              "currenciesAccepted": "USD",
              "paymentAccepted": "Cash, Credit Card, Check",
              "areaServed": [
                { "@type": "City", "name": "Deltona", "sameAs": "https://en.wikipedia.org/wiki/Deltona,_Florida" },
                { "@type": "City", "name": "Orlando", "sameAs": "https://en.wikipedia.org/wiki/Orlando,_Florida" },
                { "@type": "City", "name": "Sanford", "sameAs": "https://en.wikipedia.org/wiki/Sanford,_Florida" },
                { "@type": "City", "name": "DeLand", "sameAs": "https://en.wikipedia.org/wiki/DeLand,_Florida" },
                { "@type": "City", "name": "Daytona Beach", "sameAs": "https://en.wikipedia.org/wiki/Daytona_Beach,_Florida" },
                { "@type": "State", "name": "Florida" }
              ],
              "serviceArea": {
                "@type": "GeoCircle",
                "geoMidpoint": { "@type": "GeoCoordinates", "latitude": 28.9005, "longitude": -81.2637 },
                "geoRadius": "80000"
              },
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Property Services",
                "itemListElement": [
                  { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Lawn Care", "description": "Mowing, edging, trimming, blowing & seasonal cleanups" } },
                  { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Pressure Washing", "description": "High-pressure & soft wash for driveways, buildings, and sidewalks" } },
                  { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Junk Removal", "description": "Fast, affordable haul-away for furniture, debris, and appliances" } },
                  { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Land Clearing", "description": "Brush removal, lot clearing & grading for residential and commercial" } },
                  { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Property Cleanups", "description": "Vacant house cleanup, overgrown yards & full property restoration" } }
                ]
              },
              "sameAs": [
                "https://www.facebook.com/profile.php?id=100063685565128",
                // TODO: add Google Business Profile URL once verified
              ],
              "openingHoursSpecification": [
                { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "07:00", "closes": "18:00" },
                { "@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday", "opens": "08:00", "closes": "16:00" }
              ]
            })
          }}
        />
        {children}
        <SanityLive />
        <Analytics />
      </body>
    </html>
  );
}
