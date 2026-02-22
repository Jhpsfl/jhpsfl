import type { Metadata } from "next";
import AccountPage from "./AccountPage";

export const metadata: Metadata = {
  title: "My Account | Jenkins Home & Property Solutions",
  description:
    "Sign in to your JHPS customer portal. View payment history, manage subscriptions, and track your property services.",
  openGraph: {
    title: "My Account | Jenkins Home & Property Solutions",
    description:
      "Customer portal for Jenkins Home & Property Solutions. Manage services and payments.",
    url: "https://jhpsfl.com/account",
    siteName: "Jenkins Home & Property Solutions",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountRoutePage() {
  return <AccountPage />;
}
