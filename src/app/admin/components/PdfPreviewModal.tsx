"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

let pdfjsLoaded: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (pdfjsLoaded) return pdfjsLoaded;
  pdfjsLoaded = new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) { resolve((window as any).pdfjsLib); return; }
    const s = document.createElement("script");
    s.src = `${PDFJS_CDN}/pdf.min.js`;
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(lib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return pdfjsLoaded;
}

// ─── Pinch-to-zoom hook (ref-based to avoid stale closures) ───
function usePinchZoom(contentRef: React.RefObject<HTMLDivElement | null>) {
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender(n => n + 1), []);

  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const panStartTx = useRef(0);
  const panStartTy = useRef(0);
  const isPinching = useRef(false);
  const isPanning = useRef(false);

  const applyTransform = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const s = scaleRef.current;
    const tx = txRef.current;
    const ty = tyRef.current;
    el.style.transform = s <= 1
      ? "none"
      : `scale(${s}) translate(${tx / s}px, ${ty / s}px)`;
  }, [contentRef]);

  const resetZoom = useCallback(() => {
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    applyTransform();
    rerender();
  }, [applyTransform, rerender]);

  useEffect(() => {
    const el = contentRef.current?.parentElement; // the scroll container
    if (!el) return;

    const getDist = (t: TouchList) => {
      const dx = t[1].clientX - t[0].clientX;
      const dy = t[1].clientY - t[0].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        isPinching.current = true;
        isPanning.current = false;
        pinchStartDist.current = getDist(e.touches);
        pinchStartScale.current = scaleRef.current;
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        isPanning.current = true;
        panStartX.current = e.touches[0].clientX;
        panStartY.current = e.touches[0].clientY;
        panStartTx.current = txRef.current;
        panStartTy.current = tyRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isPinching.current && e.touches.length === 2) {
        e.preventDefault();
        const dist = getDist(e.touches);
        const newScale = Math.min(5, Math.max(1, pinchStartScale.current * (dist / pinchStartDist.current)));
        scaleRef.current = newScale;
        if (newScale <= 1) { txRef.current = 0; tyRef.current = 0; }
        applyTransform();
      } else if (isPanning.current && e.touches.length === 1 && scaleRef.current > 1) {
        e.preventDefault();
        txRef.current = panStartTx.current + (e.touches[0].clientX - panStartX.current);
        tyRef.current = panStartTy.current + (e.touches[0].clientY - panStartY.current);
        applyTransform();
      }
    };

    const onTouchEnd = () => {
      if (isPinching.current) {
        isPinching.current = false;
        rerender(); // update UI (reset button, touch-action, etc.)
      }
      isPanning.current = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [contentRef, applyTransform, rerender]);

  return { getScale: () => scaleRef.current, resetZoom };
}

export default function PdfPreviewModal({ pdfUrl, loading, onClose }: {
  pdfUrl: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [pages, setPages] = useState<string[]>([]);
  const [renderError, setRenderError] = useState(false);
  const [rendering, setRendering] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { getScale, resetZoom } = usePinchZoom(contentRef);
  const scale = getScale();
  const isZoomed = scale > 1.05;

  // Prevent body scroll while modal is open + clean up blob URL on unmount
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      if (pdfUrl && pdfUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Render PDF pages to canvas images using pdf.js
  const renderPdf = useCallback(async (url: string) => {
    setRendering(true);
    setRenderError(false);
    setPages([]);

    try {
      const pdfjsLib = await loadPdfJs();
      const pdf = await pdfjsLib.getDocument(url).promise;
      const pageImages: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;

        await page.render({ canvasContext: ctx, viewport }).promise;
        pageImages.push(canvas.toDataURL("image/png"));
      }

      setPages(pageImages);
    } catch (err) {
      console.error("PDF render error:", err);
      setRenderError(true);
    }
    setRendering(false);
  }, []);

  useEffect(() => {
    if (pdfUrl && !loading) {
      renderPdf(pdfUrl);
    }
  }, [pdfUrl, loading, renderPdf]);

  const showSpinner = loading || rendering;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        animation: "pdfFadeIn 0.25s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 900,
          height: "calc(100vh - 32px)", maxHeight: "calc(100dvh - 32px)",
          display: "flex", flexDirection: "column",
          background: "linear-gradient(160deg, #0a1a0a, #060e06)",
          border: "1px solid rgba(66,165,245,0.25)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 0 60px rgba(13,71,161,0.3), 0 0 120px rgba(0,0,0,0.5), inset 0 1px 0 rgba(66,165,245,0.1)",
          animation: "pdfSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Header bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(66,165,245,0.15)",
          background: "linear-gradient(135deg, rgba(13,71,161,0.2), rgba(21,101,192,0.08))",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #1565C0, #0D47A1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 10px rgba(21,101,192,0.4)",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E3F2FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#E3F2FD", fontFamily: "'DM Sans', sans-serif" }}>
                PDF Preview
              </div>
              <div style={{ fontSize: 11, color: "rgba(144,202,249,0.6)" }}>
                {pages.length > 0 ? `${pages.length} page${pages.length > 1 ? "s" : ""} · pinch to zoom` : "Review before sending"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isZoomed && (
              <button
                onClick={resetZoom}
                style={{
                  padding: "6px 10px", borderRadius: 8,
                  background: "rgba(66,165,245,0.15)", border: "1px solid rgba(66,165,245,0.3)",
                  color: "#90CAF9", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
                {Math.round(scale * 100)}%
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.2)",
                color: "#ef9a9a", fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
              onMouseOver={e => { e.currentTarget.style.background = "rgba(239,83,80,0.2)"; e.currentTarget.style.borderColor = "rgba(239,83,80,0.4)"; }}
              onMouseOut={e => { e.currentTarget.style.background = "rgba(239,83,80,0.1)"; e.currentTarget.style.borderColor = "rgba(239,83,80,0.2)"; }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* PDF content area — scroll container */}
        <div
          style={{
            flex: 1, position: "relative",
            overflow: isZoomed ? "hidden" : "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {showSpinner ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "100%", gap: 16,
            }}>
              <div style={{
                width: 40, height: 40, border: "3px solid rgba(66,165,245,0.2)",
                borderTopColor: "#42a5f5", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
              <div style={{ fontSize: 14, color: "#90CAF9", fontWeight: 600 }}>
                {loading ? "Generating PDF..." : "Rendering pages..."}
              </div>
              <div style={{ fontSize: 12, color: "rgba(144,202,249,0.4)" }}>
                This takes a few seconds
              </div>
            </div>
          ) : pages.length > 0 ? (
            <div
              ref={contentRef}
              style={{
                padding: 16,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
                transformOrigin: "top center",
              }}
            >
              {pages.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Page ${i + 1}`}
                  draggable={false}
                  style={{
                    width: "100%", maxWidth: 800,
                    borderRadius: 4,
                    boxShadow: "0 2px 20px rgba(0,0,0,0.5)",
                    pointerEvents: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "100%", gap: 12,
            }}>
              <div style={{ fontSize: 36 }}>⚠</div>
              <div style={{ fontSize: 14, color: "#ef9a9a", fontWeight: 600 }}>
                {renderError ? "Failed to render PDF" : "Failed to generate PDF"}
              </div>
              <div style={{ fontSize: 12, color: "#5a8a5a" }}>
                Try again or check your form data
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pdfFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pdfSlideUp { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
