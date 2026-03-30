import { NextRequest, NextResponse } from 'next/server';

// Gmail API helper
async function getGmailAccessToken(): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Gmail token refresh failed');
  return data.access_token;
}

export async function POST(req: NextRequest) {
  // Authenticate: agent uses Bearer AGENT_SECRET
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.AGENT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { conversationId, message, customerName, maskedEmail } = await req.json();

    if (!message?.trim() || !maskedEmail) {
      return NextResponse.json({ error: 'message and maskedEmail required' }, { status: 400 });
    }

    const accessToken = await getGmailAccessToken();
    const gmailUser = process.env.GMAIL_USER || 'FRLawnCareFL@gmail.com';

    // Search Gmail for the most recent Yelp thread with this customer
    const searchQuery = encodeURIComponent(
      `from:messaging.yelp.com ("${customerName || ''}" OR to:${maskedEmail}) newer_than:30d`
    );

    const searchResp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}&maxResults=3`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchResp.json();

    if (!searchData.messages?.length) {
      return NextResponse.json({ success: false, error: 'No Gmail thread found for this customer' }, { status: 404 });
    }

    // Get the most recent message metadata to thread the reply
    const msgId = searchData.messages[0].id;
    const metaResp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const metaData = await metaResp.json();
    const threadId = metaData.threadId;
    const gmailMessageId = metaData.payload?.headers?.find((h: { name: string }) => h.name === 'Message-ID')?.value || '';
    const fromHeader = metaData.payload?.headers?.find((h: { name: string }) => h.name === 'From')?.value || '';
    const subject = metaData.payload?.headers?.find((h: { name: string }) => h.name === 'Subject')?.value || 'Yelp Message';

    // Extract reply-to address from From header (the Yelp masked email)
    const fromMatch = fromHeader.match(/<([^>]+)>/);
    const replyTo = fromMatch ? fromMatch[1] : maskedEmail;

    // Build RFC 2822 email
    const rawLines = [
      `From: ${gmailUser}`,
      `To: ${replyTo}`,
      `Subject: Re: ${subject.replace(/^Re:\s*/i, '')}`,
      ...(gmailMessageId ? [`In-Reply-To: ${gmailMessageId}`, `References: ${gmailMessageId}`] : []),
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      message.trim(),
    ].join('\r\n');

    const encodedMessage = Buffer.from(rawLines)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API
    const sendResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage,
        ...(threadId ? { threadId } : {}),
      }),
    });

    if (!sendResp.ok) {
      const errText = await sendResp.text();
      return NextResponse.json({ success: false, error: `Gmail send failed: ${errText}` }, { status: 500 });
    }

    const sendData = await sendResp.json();
    console.log(`Email reply sent for ${customerName}: msgId=${sendData.id}, threadId=${sendData.threadId}`);

    return NextResponse.json({ success: true, messageId: sendData.id, threadId: sendData.threadId });
  } catch (err) {
    console.error('Email reply error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
