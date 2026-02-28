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

export default function PdfPreviewModal({ pdfUrl, loading, onClose }: {
  pdfUrl: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [pages, setPages] = useState<string[]>([]);
  const [renderError, setRenderError] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Refs for pinch/pan state (no re-renders during gesture)
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const gestureRef = useRef({
    isPinching: false,
    isPanning: false,
    isScrolling: false,
    startDist: 0,
    startScale: 1,
    panStartX: 0,
    panStartY: 0,
    panStartTx: 0,
    panStartTy: 0,
    scrollStartY: 0,
    scrollStartTop: 0,
  });

  const applyTransform = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const s = scaleRef.current;
    if (s <= 1) {
      el.style.transform = "none";
    } else {
      el.style.transform = `scale(${s}) translate(${txRef.current / s}px, ${tyRef.current / s}px)`;
    }
  }, []);

  const resetZoom = useCallback(() => {
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    applyTransform();
    setZoomLevel(1);
  }, [applyTransform]);

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

  // ─── Touch event handling ───
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || pages.length === 0) return;

    const getDist = (t: TouchList) => {
      const dx = t[1].clientX - t[0].clientX;
      const dy = t[1].clientY - t[0].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const g = gestureRef.current;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch start
        e.preventDefault();
        g.isPinching = true;
        g.isPanning = false;
        g.isScrolling = false;
        g.startDist = getDist(e.touches);
        g.startScale = scaleRef.current;
      } else if (e.touches.length === 1) {
        if (scaleRef.current > 1.05) {
          // Pan when zoomed in
          e.preventDefault();
          g.isPanning = true;
          g.isScrolling = false;
          g.panStartX = e.touches[0].clientX;
          g.panStartY = e.touches[0].clientY;
          g.panStartTx = txRef.current;
          g.panStartTy = tyRef.current;
        } else {
          // Normal scroll at 1x — let it through but track in case 2nd finger added
          g.isScrolling = true;
          g.isPanning = false;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (g.isPinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = getDist(e.touches);
        const newScale = Math.min(5, Math.max(1, g.startScale * (dist / g.startDist)));
        scaleRef.current = newScale;
        if (newScale <= 1.01) {
          txRef.current = 0;
          tyRef.current = 0;
        }
        applyTransform();
      } else if (g.isPanning && e.touches.length === 1 && scaleRef.current > 1.05) {
        e.preventDefault();
        txRef.current = g.panStartTx + (e.touches[0].clientX - g.panStartX);
        tyRef.current = g.panStartTy + (e.touches[0].clientY - g.panStartY);
        applyTransform();
      }
      // isScrolling: don't preventDefault, let browser handle native scroll
    };

    const onTouchEnd = () => {
      if (g.isPinching) {
        g.isPinching = false;
        // Snap to 1x if close
        if (scaleRef.current < 1.05) {
          scaleRef.current = 1;
          txRef.current = 0;
          tyRef.current = 0;
          applyTransform();
        }
        setZoomLevel(scaleRef.current);
      }
      g.isPanning = false;
      g.isScrolling = false;
    };

    scrollEl.addEventListener("touchstart", onTouchStart, { passive: false });
    scrollEl.addEventListener("touchmove", onTouchMove, { passive: false });
    scrollEl.addEventListener("touchend", onTouchEnd);

    return () => {
      scrollEl.removeEventListener("touchstart", onTouchStart);
      scrollEl.removeEventListener("touchmove", onTouchMove);
      scrollEl.removeEventListener("touchend", onTouchEnd);
    };
  }, [pages.length, applyTransform]);

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
  const isZoomed = zoomLevel > 1.05;

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
                {Math.round(zoomLevel * 100)}% ✕
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

        {/* PDF content area */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, position: "relative",
            overflow: isZoomed ? "hidden" : "auto",
            WebkitOverflowScrolling: isZoomed ? undefined : "touch",
            touchAction: pages.length > 0 ? "none" : "auto",
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
