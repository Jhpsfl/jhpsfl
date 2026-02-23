import GetQuotePage from "./GetQuotePage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get a Free Video Quote | JHPS - Jenkins Home & Property Solutions",
  description:
    "Get a fast, free estimate for lawn care, pressure washing, junk removal, and more. Film your property, submit online, and receive a quote in hours — no site visit needed.",
  openGraph: {
    title: "Get a Free Video Quote | JHPS",
    description: "Film your property, get a quote in hours. No site visit needed.",
    type: "website",
    url: "https://jhpsfl.com/get-quote",
  },
};

export default function Page() {
  return <GetQuotePage />;
}
