/**
 * Create a short link for any URL.
 * Returns the short URL (e.g. https://jhpsfl.com/l/abc123)
 * Falls back to the original URL if shortening fails.
 */
export async function createShortLink(url: string, label?: string): Promise<string> {
  try {
    const res = await fetch("/api/short-link", {
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
