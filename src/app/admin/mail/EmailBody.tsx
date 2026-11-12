"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Renders an HTML email inside a sandboxed iframe (no scripts, no forms):
 *  - the email's own CSS can no longer restyle the app around it;
 *  - links open in a new tab (<base target="_blank">);
 *  - images shrink to the screen, and fixed-width layouts (the classic 600 px newsletter table) are zoomed
 *    to fit the phone instead of forcing sideways scrolling;
 *  - two-finger pinch zooms the email itself (fit … 4x), double-tap toggles 2x, pan sideways while zoomed;
 *  - in dark mode the email is colour-inverted, with images inverted back, unless `original` is set.
 *
 * Height: the frame is sized from the email BODY's own box, never from the document's scrollHeight.
 * A document is never shorter than its viewport, so measuring scrollHeight and feeding it back as the frame
 * height grows forever ("ever-expanding page" bug).
 */
type Props = { html: string; dark: boolean; original?: boolean; className?: string };

const BASE_CSS = `
html,body{margin:0;padding:0;height:auto!important;min-height:0!important;max-height:none!important}
html{overflow-x:hidden;overflow-y:hidden;-webkit-tap-highlight-color:transparent}
body{padding:14px 14px 12px;font:15px/1.55 -apple-system,BlinkMacSystemFont,Roboto,"Segoe UI",Helvetica,Arial,sans-serif;overflow-wrap:anywhere;word-break:break-word;-webkit-text-size-adjust:100%;touch-action:pan-x pan-y}
img,video,svg{max-width:100%!important;height:auto!important}
table{max-width:100%!important;height:auto!important}
td,th{word-break:break-word}
pre{white-space:pre-wrap!important}
blockquote{margin:8px 0;padding-left:10px;border-left:3px solid rgba(128,128,128,.35)}
a{color:#2E7D32}
`;
const LIGHT_CSS = `:root{color-scheme:light}body{background:#ffffff;color:#1f2a3a}`;
const DARK_INVERT_CSS = `:root{color-scheme:light}body{background:#e9ecf1;color:#1f2a3a}
html{filter:invert(1) hue-rotate(180deg)}
img,video,picture,canvas,svg,[style*="background-image"],[background]{filter:invert(1) hue-rotate(180deg)}`;

const MAX_ZOOM = 3;

function buildDoc(html: string, css: string) {
  const safe = (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<base[^>]*>/gi, "")
    .replace(/<meta[^>]+viewport[^>]*>/gi, "");
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank">`;
  // our stylesheet goes LAST so it wins over the email's own <style> blocks
  const tail = `<style>${BASE_CSS}${css}</style>`;
  if (/<head[\s>]/i.test(safe)) return safe.replace(/<head([^>]*)>/i, `<head$1>${head}`) + tail;
  if (/<html[\s>]/i.test(safe)) return safe.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`) + tail;
  return `<!doctype html><html><head>${head}</head><body>${safe}</body></html>${tail}`;
}

type ZoomBody = HTMLElement & { style: CSSStyleDeclaration & { zoom?: string } };

export default function EmailBody({ html, dark, original, className }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(140);
  const [zoomed, setZoomed] = useState(false);
  const doc = useMemo(() => buildDoc(html, dark && !original ? DARK_INVERT_CSS : LIGHT_CSS), [html, dark, original]);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let stopped = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let fitZoom = 1;      // shrink-to-width factor
    let userZoom = 1;     // pinch factor on top of it (1 = fit)
    let lastHeight = 0;

    const inner = () => {
      try {
        const d = frame.contentDocument;
        if (!d?.body || !d.documentElement) return null;
        return { d, html: d.documentElement, body: d.body as ZoomBody };
      } catch { return null; }
    };

    const apply = () => {
      const x = inner(); if (!x) return;
      x.body.style.zoom = String(fitZoom * userZoom);
      // sideways panning only while zoomed in (or when the email is too wide even at the minimum fit)
      x.html.style.overflowX = userZoom > 1.01 || fitZoom <= 0.55 ? "auto" : "hidden";
    };

    // frame height = the body's own box (independent of the frame's current height → no feedback loop)
    const measure = () => {
      if (stopped) return;
      const x = inner(); if (!x) return;
      const r = x.body.getBoundingClientRect();
      const cs = x.d.defaultView?.getComputedStyle(x.body);
      const mb = cs ? parseFloat(cs.marginBottom) || 0 : 0;
      const h = Math.ceil(r.bottom + (x.html.scrollTop || 0) + mb) + 2;
      if (h > 20 && Math.abs(h - lastHeight) > 1) { lastHeight = h; setHeight(h); }
    };

    const fit = () => {
      if (stopped) return;
      const x = inner(); if (!x) return;
      if (userZoom === 1) {
        x.body.style.zoom = "1";
        const cw = frame.clientWidth;
        const sw = Math.max(x.html.scrollWidth, x.body.scrollWidth);
        fitZoom = cw && sw > cw + 2 ? Math.max(0.55, cw / sw) : 1;
        apply();
      }
      measure();
    };

    // ── pinch to zoom / double-tap, wired on the email document from the outside (its own scripts are blocked)
    let pinch: { dist: number; zoom: number } | null = null;
    let lastTap = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const setUserZoom = (z: number) => {
      userZoom = Math.min(MAX_ZOOM, Math.max(1, z));
      if (userZoom < 1.02) userZoom = 1;
      apply(); measure();
      setZoomed(userZoom > 1);
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) { pinch = { dist: dist(e.touches), zoom: userZoom }; e.preventDefault(); }
    };
    const onMove = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const d = dist(e.touches);
        if (d > 0) setUserZoom(pinch.zoom * (d / pinch.dist));
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (pinch) { if (e.touches.length < 2) pinch = null; return; }
      if (e.changedTouches.length === 1 && e.touches.length === 0) {
        const now = Date.now();
        if (now - lastTap < 300) { setUserZoom(userZoom > 1 ? 1 : 2); lastTap = 0; e.preventDefault(); }
        else lastTap = now;
      }
    };
    let wiredDoc: Document | null = null;
    const wire = () => {
      const x = inner(); if (!x || wiredDoc === x.d) return;
      wiredDoc = x.d;
      x.d.addEventListener("touchstart", onStart, { passive: false });
      x.d.addEventListener("touchmove", onMove, { passive: false });
      x.d.addEventListener("touchend", onEnd, { passive: false });
    };
    const unwire = () => {
      if (!wiredDoc) return;
      wiredDoc.removeEventListener("touchstart", onStart); wiredDoc.removeEventListener("touchmove", onMove); wiredDoc.removeEventListener("touchend", onEnd);
      wiredDoc = null;
    };

    // The iframe's load event waits for every image in the email (slow newsletters), so don't depend on it:
    // measure right away and keep re-measuring while content arrives, plus watch the email's own body size.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => fit()) : null;
    ro?.observe(frame);
    let innerObserved = false;
    const watchInner = () => {
      if (innerObserved || !ro) return;
      const x = inner(); if (x) { ro.observe(x.body); innerObserved = true; }
    };
    const tick = () => { wire(); watchInner(); fit(); };
    const onLoad = () => { tick(); [100, 400, 1000, 2500, 5000].forEach((ms) => timers.push(setTimeout(tick, ms))); };
    frame.addEventListener("load", onLoad);
    [0, 50, 150, 300, 600, 1000, 1500, 2200, 3000, 4500, 6000, 9000].forEach((ms) => timers.push(setTimeout(tick, ms)));
    return () => { stopped = true; unwire(); frame.removeEventListener("load", onLoad); ro?.disconnect(); timers.forEach(clearTimeout); };
  }, [doc]);

  return (
    <div className="relative">
      <iframe
        ref={ref}
        title="Email"
        srcDoc={doc}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        className={className || "block w-full border-0"}
        style={{ height, colorScheme: dark && !original ? "dark" : "light", touchAction: "pan-x pan-y" }}
      />
      {zoomed && (
        <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
          Zoomed · double-tap to reset
        </span>
      )}
    </div>
  );
}
