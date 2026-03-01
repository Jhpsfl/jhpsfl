import { redirect } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";

export default async function ShortLinkRedirect({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createSupabaseAdmin();

  const { data: link } = await supabase
    .from("short_links")
    .select("target_url")
    .eq("code", code)
    .single();

  if (!link) {
    redirect("/");
  }

  // Increment click count (fire and forget)
  supabase
    .from("short_links")
    .update({ clicks: (link as { clicks?: number }).clicks ? (link as { clicks?: number }).clicks! + 1 : 1 })
    .eq("code", code)
    .then(() => {});

  // If target_url is a relative path, it works with redirect()
  // If absolute, redirect() handles it
  redirect(link.target_url);
}
