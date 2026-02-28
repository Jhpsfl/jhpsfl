import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { uploadToB2 } from "@/lib/b2Storage";
import { buildAgreementKey } from "@/lib/agreement";

export const maxDuration = 30; // Allow longer execution for file uploads

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      token,
      signer_name,
      signer_email,
      signer_phone,
      signer_address,
      signature_data,   // base64 PNG of signature
      id_front_data,    // base64 JPEG of ID front
      id_back_data,     // base64 JPEG of ID back
      id_type,          // "drivers_license" | "state_id" | "passport" | "military_id"
    } = body;

    // Validate required fields
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
    if (!signer_name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!signature_data) return NextResponse.json({ error: "Signature is required" }, { status: 400 });
    if (!id_front_data) return NextResponse.json({ error: "Front of ID is required" }, { status: 400 });
    if (!id_back_data) return NextResponse.json({ error: "Back of ID is required" }, { status: 400 });

    const supabase = createSupabaseAdmin();

    // Fetch the agreement
    const { data: agreement, error: fetchErr } = await supabase
      .from("financing_agreements")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchErr || !agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    // Validate status
    if (agreement.status === "signed") {
      return NextResponse.json({ error: "This agreement has already been signed" }, { status: 400 });
    }
    if (agreement.status === "expired") {
      return NextResponse.json({ error: "This agreement has expired" }, { status: 410 });
    }
    if (agreement.status === "voided") {
      return NextResponse.json({ error: "This agreement has been voided" }, { status: 400 });
    }

    // Check expiration
    if (agreement.expires_at && new Date(agreement.expires_at) < new Date()) {
      await supabase
        .from("financing_agreements")
        .update({ status: "expired" })
        .eq("id", agreement.id);
      return NextResponse.json({ error: "This agreement has expired" }, { status: 410 });
    }

    // ─── Upload files to B2 ───
    const agreementId = agreement.id;

    // 1. Signature PNG
    let signatureUrl = "";
    try {
      const sigBuffer = Buffer.from(signature_data.replace(/^data:image\/\w+;base64,/, ""), "base64");
      const sigKey = buildAgreementKey(agreementId, "signature.png");
      await uploadToB2(sigBuffer, sigKey, "image/png");
      signatureUrl = sigKey;
    } catch (err) {
      console.error("Signature upload error:", err);
      return NextResponse.json({ error: "Failed to upload signature" }, { status: 500 });
    }

    // 2. ID Front
    let idFrontUrl = "";
    try {
      const frontBuffer = Buffer.from(id_front_data.replace(/^data:image\/\w+;base64,/, ""), "base64");
      const frontKey = buildAgreementKey(agreementId, "id-front.jpg");
      await uploadToB2(frontBuffer, frontKey, "image/jpeg");
      idFrontUrl = frontKey;
    } catch (err) {
      console.error("ID front upload error:", err);
      return NextResponse.json({ error: "Failed to upload ID front" }, { status: 500 });
    }

    // 3. ID Back
    let idBackUrl = "";
    try {
      const backBuffer = Buffer.from(id_back_data.replace(/^data:image\/\w+;base64,/, ""), "base64");
      const backKey = buildAgreementKey(agreementId, "id-back.jpg");
      await uploadToB2(backBuffer, backKey, "image/jpeg");
      idBackUrl = backKey;
    } catch (err) {
      console.error("ID back upload error:", err);
      return NextResponse.json({ error: "Failed to upload ID back" }, { status: 500 });
    }

    // ─── Capture audit trail ───
    const signerIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    const signerUserAgent = request.headers.get("user-agent") || "unknown";
    const signedAt = new Date().toISOString();

    // ─── Update agreement record ───
    const { error: updateErr } = await supabase
      .from("financing_agreements")
      .update({
        status: "signed",
        signer_name: signer_name.trim(),
        signer_email: signer_email?.trim() || agreement.signer_email,
        signer_phone: signer_phone?.trim() || agreement.signer_phone,
        signer_address: signer_address?.trim() || null,
        signature_url: signatureUrl,
        signed_at: signedAt,
        signer_ip: signerIp,
        signer_user_agent: signerUserAgent,
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        id_type: id_type || "drivers_license",
      })
      .eq("id", agreementId);

    if (updateErr) {
      console.error("Agreement update error:", updateErr);
      return NextResponse.json({ error: "Failed to update agreement" }, { status: 500 });
    }

    // ─── Update quote status to accepted ───
    if (agreement.quote_id) {
      await supabase
        .from("quotes")
        .update({
          status: "accepted",
          accepted_at: signedAt,
        })
        .eq("id", agreement.quote_id);
    }

    // ─── Send admin notification ───
    try {
      const snapshot = agreement.quote_snapshot as { quote_number?: string; total?: number; customer_name?: string } | null;
      // Push notification via existing endpoint
      await fetch(new URL("/api/push/send", request.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "✍️ Agreement Signed!",
          body: `${signer_name.trim()} signed the financing agreement for ${snapshot?.quote_number || "estimate"}`,
          url: "/admin",
        }),
      }).catch(() => { /* non-fatal */ });

      // Email notification
      await fetch(new URL("/api/agreement/notify", request.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreement_id: agreementId,
          signer_name: signer_name.trim(),
          quote_number: snapshot?.quote_number,
          total: snapshot?.total,
        }),
      }).catch(() => { /* non-fatal */ });
    } catch {
      // Notifications are non-fatal
    }

    return NextResponse.json({
      success: true,
      message: "Agreement signed successfully",
      agreement_id: agreementId,
    });
  } catch (err) {
    console.error("Agreement sign error:", err);
    return NextResponse.json({ error: "Failed to process agreement" }, { status: 500 });
  }
}
