import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { nexaPayMetadata } from "@/lib/nexa-pay-metadata";
import PaymentPage from "./PaymentPage";

export const dynamic = "force-dynamic";

const jhpsMetadata: Metadata = {
  title: "Make a Payment | Jenkins Home & Property Solutions",
  description: "Secure online payment for Jenkins Home & Property Solutions.",
  robots: {
    index: false,
    follow: false,
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const [{ brand }, h] = await Promise.all([searchParams, headers()]);
  const nexa = brand === "nexa" || (h.get("host") || "").startsWith("pay.nexavisiongroup.com");
  return nexa ? nexaPayMetadata("Make a Payment", "Secure online payment for NexaVision Group.") : jhpsMetadata;
}

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  if (Object.keys(params).length === 0) {
    redirect("/");
  }
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#050e05" }} />}>
      <PaymentPage />
    </Suspense>
  );
}
