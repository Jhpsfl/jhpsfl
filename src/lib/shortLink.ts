"use client";

/**
 * Create a short link for any URL.
 * Returns the short URL (e.g. https://jhpsfl.com/l/abc123)
 * Falls back to the original URL if shortening fails.
 *
 * NOTE: This is a client-only utility. Server-side code should
 * use an absolute URL to /api/short-link instead.
 */
export async function createShortLink(url: string, label?: string): Promise<string> {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://jhpsfl.com";
    const res = await fetch(`${base}/api/short-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, label }),
    });
    const data = await res.json();
    if (data.success && data.short_url) {
      return data.short_url;
    }
    return url; // fallback
  } catch {
    return url; // fallback
  }
}
