import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

// Cron: Check FRLawnCareFL Gmail for Yelp customer reply notifications
// These arrive at Gmail (not info@jhpsfl.com) because the initial AI reply
// was sent FROM Gmail, so Yelp associates the thread with the Gmail account.

async function getGmailAccessToken(): Promise<string> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("Gmail token refresh failed");
  return data.access_token;
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = await getGmailAccessToken();
    const supabase = createSupabaseAdmin();

    // Search for Yelp reply notifications in the last 10 minutes
    // These have subjects like "Kyle sent you a message" or "You have a new message from Kyle"
    const searchQuery = encodeURIComponent(
      'from:messaging.yelp.com subject:("sent you a message" OR "new message from" OR "replied to your") newer_than:1h -label:processed-yelp'
    );

    const searchResp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}&maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchResp.json();

    if (!searchData.messages?.length) {
      return NextResponse.json({ ok: true, found: 0 });
    }

    let triggersCreated = 0;

    for (const msg of searchData.messages) {
      try {
        // Get message metadata
        const metaResp = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const metaData = await metaResp.json();

        const subject = metaData.payload?.headers?.find(
          (h: { name: string }) => h.name === "Subject"
        )?.value || "";

        // Skip if this is a new lead notification (handled by Resend webhook)
        if (subject.includes("new lead on Yelp")) continue;

        // Extract customer name from subject
        // Patterns: "Kyle sent you a message" or "New message from Kyle"
        let customerName: string | null = null;
        const sentMatch = subject.match(/^(.+?)\s+sent you a message/i);
        const fromMatch = subject.match(/message from\s+(.+)/i);
        const repliedMatch = subject.match(/^(.+?)\s+replied/i);
        customerName = sentMatch?.[1] || fromMatch?.[1] || repliedMatch?.[1] || null;

        if (!customerName) {
          console.log(`Yelp Gmail: couldn't parse customer name from subject: ${subject}`);
          continue;
        }

        // Check if we already have a pending/processing trigger for this customer in the last 5 min
        const { data: existingTrigger } = await supabase
          .from("yelp_triggers")
          .select("id")
          .eq("customer_name", customerName)
          .eq("trigger_type", "customer_reply")
          .in("status", ["pending", "processing"])
          .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .limit(1);

        if (existingTrigger?.length) {
          console.log(`Yelp Gmail: trigger already exists for ${customerName}, skipping`);
        } else {
          // Also check if a completed trigger was recently created (last 2 min) to avoid duplicates
          const { data: recentCompleted } = await supabase
            .from("yelp_triggers")
            .select("id")
            .eq("customer_name", customerName)
            .eq("trigger_type", "customer_reply")
            .gte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
            .limit(1);

          if (!recentCompleted?.length) {
            // Get the lead_id from the conversation if we have one
            const { data: conv } = await supabase
              .from("yelp_conversations")
              .select("yelp_thread_id, services")
              .ilike("customer_name", `%${customerName.split(" ")[0]}%`)
              .limit(1);

            const leadId = conv?.[0]?.yelp_thread_id || null;
            const service = conv?.[0]?.services?.[0] || null;

            await supabase.from("yelp_triggers").insert({
              trigger_type: "customer_reply",
              lead_id: leadId,
              customer_name: customerName,
              service,
              email_subject: subject,
              status: "pending",
            });

            triggersCreated++;
            console.log(`Yelp Gmail: created trigger for ${customerName} (lead: ${leadId})`);
          }
        }

        // Label the message as processed so we don't process it again
        // First, ensure the "processed-yelp" label exists
        try {
          const labelsResp = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/labels",
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const labelsData = await labelsResp.json();
          let labelId = labelsData.labels?.find(
            (l: { name: string }) => l.name === "processed-yelp"
          )?.id;

          if (!labelId) {
            const createResp = await fetch(
              "https://gmail.googleapis.com/gmail/v1/users/me/labels",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: "processed-yelp",
                  labelListVisibility: "labelHide",
                  messageListVisibility: "hide",
                }),
              }
            );
            const createData = await createResp.json();
            labelId = createData.id;
          }

          if (labelId) {
            await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ addLabelIds: [labelId] }),
              }
            );
          }
        } catch (labelErr) {
          console.error("Gmail label error:", labelErr);
        }
      } catch (msgErr) {
        console.error("Error processing Gmail message:", msgErr);
      }
    }

    return NextResponse.json({
      ok: true,
      found: searchData.messages.length,
      triggersCreated,
    });
  } catch (err) {
    console.error("Yelp Gmail check error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
