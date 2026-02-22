import type { Metadata } from "next";
import PaymentPage from "./PaymentPage";

export const metadata: Metadata = {
  title: "Make a Payment | Jenkins Home & Property Solutions",
  description:
    "Pay for lawn care, pressure washing, junk removal, land clearing & property cleanup services. Secure online payment for Jenkins Home & Property Solutions in Central Florida.",
  openGraph: {
    title: "Make a Payment | Jenkins Home & Property Solutions",
    description:
      "Pay for property services securely online. Serving Deltona, Orlando & Central Florida.",
    url: "https://jhpsfl.com/pay",
    siteName: "Jenkins Home & Property Solutions",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PayPage() {
  return <PaymentPage />;
}
