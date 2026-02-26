"use client";

import { useEffect } from "react";

export default function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.3s ease", cursor: "zoom-out", padding: "20px",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ maxWidth: "95%", maxHeight: "90vh", borderRadius: "12px", boxShadow: "0 25px 80px rgba(0,0,0,0.5)" }} />
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", color: "#fff", fontSize: 36, cursor: "pointer", lineHeight: 1 }}>✕</button>
    </div>
  );
}
