"use client";

import { useState, useEffect } from "react";

// Square Web Payments SDK type shim
declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => SquarePayments;
    };
  }
}
interface SquarePayments {
  card: (options?: object) => Promise<SquareCard>;
}
export interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message: string }> }>;
  destroy: () => Promise<void>;
}

interface SquareCardFormProps {
  containerId?: string;
  onReady: (card: SquareCard) => void;
  onError: (msg: string) => void;
}

export default function SquareCardForm({
  containerId = "sq-card-container",
  onReady,
  onError,
}: SquareCardFormProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let card: SquareCard | null = null;

    const init = async () => {
      try {
        // Load SDK script if not already present
        if (!window.Square) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[src*="squarecdn"]');
            if (existing) { resolve(); return; }
            const s = document.createElement("script");
            s.src = "https://web.squarecdn.com/v1/square.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Square SDK failed to load"));
            document.head.appendChild(s);
          });
        }
        if (cancelled) return;

        const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
        const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim();
        if (!appId || !locationId) throw new Error("Payment configuration missing");

        const payments = window.Square!.payments(appId, locationId);
        card = await payments.card({
          style: {
            ".input-container": {
              borderColor: "#1a3a1a",
              borderRadius: "12px",
            },
            ".input-container.is-focus": {
              borderColor: "#4CAF50",
            },
            ".input-container.is-error": {
              borderColor: "#ef5350",
            },
            "input": {
              backgroundColor: "#0d1a0d",
              color: "#e8f5e8",
            },
            "input::placeholder": {
              color: "#3a5a3a",
            },
          },
        });
        if (cancelled) { card.destroy().catch(() => {}); return; }

        await card.attach(`#${containerId}`);
        if (cancelled) { card.destroy().catch(() => {}); return; }

        setLoading(false);
        onReady(card);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Square init error:", msg);
        setLoading(false);
        onError(msg);
      }
    };

    init();
    return () => {
      cancelled = true;
      if (card) card.destroy().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {loading && (
        <div style={{ color: "#4a7a4a", fontSize: 13, padding: "20px 0", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #4CAF50", borderTopColor: "transparent", borderRadius: "50%", animation: "pulse 0.8s linear infinite" }} />
          Loading secure payment form...
        </div>
      )}
      <div id={containerId} style={{ minHeight: loading ? 0 : 89 }} />
    </>
  );
}
