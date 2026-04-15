import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import PaymentPage from "./PaymentPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Make a Payment | Jenkins Home & Property Solutions",
  description: "Secure online payment for Jenkins Home & Property Solutions.",
  robots: {
    index: false,
    follow: false,
  },
};

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
