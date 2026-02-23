"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

// ─── Types ───
type Step = "contact" | "property" | "service" | "media" | "review" | "submitted";

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  property_type: "residential" | "commercial";
  service_requested: string;
  modifier_data: Record<string, unknown>;
  customer_notes: string;
}

interface MediaFile {
  file: File;
  preview: string;
  context: string;
  type: "video" | "photo";
}

// ─── Service modifier configs ───
const SERVICE_MODIFIERS: Record<string, { label: string; key: string; options?: string[]; tiers?: { label: string; value: string }[] }[]> = {
  "Lawn Care": [
    { label: "Yard size estimate", key: "yard_size", options: ["Small (under 5,000 sq ft)", "Medium (5,000–8,000 sq ft)", "Large (8,000–12,000 sq ft)", "Extra Large (12,000+ sq ft)"] },
    { label: "Areas to service", key: "areas", options: ["Front yard only", "Front + back yard", "Front + back + side yards"] },
    { label: "Any palm trees?", key: "palm_trees", options: ["None", "1–3 palms", "4–6 palms", "7+ palms"] },
    { label: "Palm height (tallest)", key: "palm_height", tiers: [{ label: "Under 10 ft", value: "short" }, { label: "10–20 ft", value: "medium" }, { label: "Over 20 ft", value: "tall" }] },
    { label: "Hedges or bushes?", key: "hedges", options: ["None", "Low hedges (under 4 ft)", "Tall hedges (4+ ft)", "Dense overgrowth"] },
    { label: "Narrow gates? (under 36\")", key: "narrow_gate", options: ["No narrow gates", "Yes — one gate", "Yes — multiple gates"] },
    { label: "Current grass condition", key: "grass_condition", options: ["Well maintained", "Slightly overgrown", "Very overgrown / knee-high"] },
  ],
  "Pressure Washing": [
    { label: "Surfaces to wash", key: "surfaces", options: ["Driveway", "Sidewalk / walkway", "House exterior", "Pool deck / patio", "Fence", "Roof"] },
    { label: "Approximate area", key: "wash_area", options: ["Small (under 500 sq ft)", "Medium (500–1,500 sq ft)", "Large (1,500+ sq ft)"] },
    { label: "Second story areas?", key: "second_story", options: ["No", "Yes"] },
    { label: "Heavy staining?", key: "staining", options: ["Light / normal", "Heavy mold or algae", "Oil / grease stains"] },
  ],
  "Junk Removal": [
    { label: "Amount of junk", key: "junk_amount", options: ["A few items", "Partial truck load", "Full truck load", "Multiple truck loads"] },
    { label: "Location of items", key: "junk_location", options: ["Curbside / driveway", "Inside garage", "Backyard", "Inside house", "Mixed locations"] },
    { label: "Heavy items? (appliances, furniture)", key: "heavy_items", options: ["No heavy items", "1–3 heavy items", "4+ heavy items"] },
  ],
  "Land Clearing": [
    { label: "Area to clear", key: "clearing_area", options: ["Small area (under 1/4 acre)", "Medium (1/4 to 1/2 acre)", "Large (1/2 to 1 acre)", "Very large (1+ acre)"] },
    { label: "Vegetation type", key: "vegetation", options: ["Light brush / weeds", "Dense brush / bushes", "Small trees", "Mixed brush and trees"] },
    { label: "Stumps to remove?", key: "stumps", options: ["No stumps", "A few stumps", "Many stumps"] },
  ],
  "Property Cleanup": [
    { label: "Cleanup scope", key: "cleanup_scope", options: ["Yard waste / leaves", "Storm debris", "Construction debris", "Full property cleanout", "Foreclosure / estate cleanup"] },
    { label: "Property size", key: "property_size", options: ["Small lot", "Standard residential", "Large property", "Commercial property"] },
  ],
};

// ─── Shot list generators ───
function getShotList(service: string, modifiers: Record<string, unknown>): { id: string; label: string; hint: string }[] {
  const shots: { id: string; label: string; hint: string }[] = [
    { id: "front_wide", label: "Front yard — wide shot", hint: "Stand at the sidewalk or street and slowly pan across the full front of the property." },
  ];

  if (service === "Lawn Care") {
    const areas = modifiers.areas as string || "";
    if (areas.includes("back")) {
      shots.push({ id: "back_wide", label: "Backyard — wide shot", hint: "Pan slowly across the full backyard from one corner." });
    }
    const palms = modifiers.palm_trees as string || "";
    if (palms && !palms.includes("None")) {
      shots.push({ id: "palm_height", label: "Palm trees — height reference", hint: "Photo the tallest palm with your house or car visible for height comparison." });
    }
    const gate = modifiers.narrow_gate as string || "";
    if (gate.includes("Yes")) {
      shots.push({ id: "gate_width", label: "Gate opening", hint: "Place your foot next to the gate opening for scale reference." });
    }
    const hedges = modifiers.hedges as string || "";
    if (hedges && !hedges.includes("None")) {
      shots.push({ id: "hedges", label: "Hedges / bushes", hint: "Show the hedges from a few feet away so we can see the height and density." });
    }
    const condition = modifiers.grass_condition as string || "";
    if (condition.includes("overgrown") || condition.includes("knee")) {
      shots.push({ id: "condition", label: "Worst area close-up", hint: "Film or photo the most overgrown section so we can assess the work needed." });
    }
  } else if (service === "Pressure Washing") {
    shots.push({ id: "surface_main", label: "Main surface to wash", hint: "Show the full area — stand back to capture the size." });
    shots.push({ id: "stain_closeup", label: "Stain / buildup close-up", hint: "Get close to show the type of staining or buildup." });
  } else if (service === "Junk Removal") {
    shots.push({ id: "junk_overview", label: "All items overview", hint: "Show everything that needs to go in one wide shot." });
    shots.push({ id: "junk_access", label: "Access path", hint: "Show how we'd get to and remove the items — driveway, hallway, stairs, etc." });
  } else if (service === "Land Clearing") {
    shots.push({ id: "clearing_area", label: "Area to clear — overview", hint: "Show the full area from the highest or widest vantage point." });
    shots.push({ id: "vegetation_closeup", label: "Vegetation close-up", hint: "Get closer to show the type of brush, tree sizes, and density." });
  } else if (service === "Property Cleanup") {
    shots.push({ id: "cleanup_overview", label: "Full property overview", hint: "Slow pan showing the overall state of the property." });
    shots.push({ id: "problem_areas", label: "Worst areas", hint: "Film the areas that need the most attention." });
  }

  // Always add an optional general shot
  shots.push({ id: "additional", label: "Anything else (optional)", hint: "Any other angles or areas you want us to see." });

  return shots;
}

// ─── Phone formatting ───
function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ─── Component ───
export default function GetQuotePage() {
  const [step, setStep] = useState<Step>("contact");
  const [form, setForm] = useState<FormData>({
    name: "", email: "", phone: "", address: "", city: "Deltona", state: "FL", zip: "",
    latitude: null, longitude: null,
    property_type: "residential", service_requested: "",
    modifier_data: {}, customer_notes: "",
  });
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── GPS capture ───
  const captureGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ─── Validation ───
  const isContactValid = form.name && form.email && form.phone.replace(/\D/g, "").length >= 10 && form.address;
  const isServiceValid = form.service_requested !== "";

  // ─── Media handling ───
  const addMedia = (files: FileList | null, context: string = "") => {
    if (!files) return;
    const newFiles: MediaFile[] = [];
    Array.from(files).forEach((file) => {
      if (file.size > 100 * 1024 * 1024) return; // Skip > 100MB
      const isVideo = file.type.startsWith("video/");
      const preview = URL.createObjectURL(file);
      newFiles.push({ file, preview, context, type: isVideo ? "video" : "photo" });
    });
    setMediaFiles((prev) => [...prev, ...newFiles]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ─── Submit ───
  const handleSubmit = async () => {
    setUploading(true);
    setError("");

    try {
      const formDataObj = new FormData();
      formDataObj.set("name", form.name);
      formDataObj.set("email", form.email);
      formDataObj.set("phone", form.phone);
      formDataObj.set("address", form.address);
      formDataObj.set("city", form.city);
      formDataObj.set("state", form.state);
      formDataObj.set("zip", form.zip);
      if (form.latitude) formDataObj.set("latitude", form.latitude.toString());
      if (form.longitude) formDataObj.set("longitude", form.longitude.toString());
      formDataObj.set("property_type", form.property_type);
      formDataObj.set("service_requested", form.service_requested);
      formDataObj.set("modifier_data", JSON.stringify(form.modifier_data));
      formDataObj.set("customer_notes", form.customer_notes);

      mediaFiles.forEach((m, i) => {
        formDataObj.set(`media_${i}`, m.file);
        formDataObj.set(`context_${i}`, m.context);
      });

      const res = await fetch("/api/leads/submit", { method: "POST", body: formDataObj });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong. Please try again.");
        setUploading(false);
        return;
      }

      setLeadId(data.leadId);
      setStep("submitted");
    } catch {
      setError("Connection error. Please check your internet and try again.");
    }
    setUploading(false);
  };

  // ─── Shot list for current service ───
  const shotList = form.service_requested ? getShotList(form.service_requested, form.modifier_data) : [];

  // ─── Styles ───
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "14px 16px", background: "#0d1a0d",
    border: "1px solid #1a3a1a", borderRadius: 12, color: "#e8f5e8",
    fontSize: 16, outline: "none", fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.3s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, color: "#5a8a5a", fontWeight: 700,
    letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 8,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Playfair+Display:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DM Sans', sans-serif; background: #050e05; color: #c8e0c8; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        .quote-container {
          max-width: 640px; margin: 0 auto; padding: 24px 20px 60px;
          min-height: 100vh; animation: fadeIn 0.4s ease;
        }
        .quote-input:focus { border-color: #4CAF50 !important; }
        .quote-input::placeholder { color: #3a5a3a; }

        .step-dots { display: flex; gap: 8px; justify-content: center; margin-bottom: 32px; }
        .step-dot {
          width: 10px; height: 10px; border-radius: 50%; transition: all 0.3s;
        }
        .step-dot.active { background: #4CAF50; box-shadow: 0 0 10px rgba(76,175,80,0.5); }
        .step-dot.done { background: #2E7D32; }
        .step-dot.future { background: #1a3a1a; }

        .service-card {
          padding: 16px 20px; border: 1px solid #1a3a1a; border-radius: 14px;
          cursor: pointer; transition: all 0.3s; background: transparent;
          text-align: left; width: 100%; font-family: inherit; color: inherit;
        }
        .service-card:hover { border-color: #4CAF50; background: rgba(76,175,80,0.04); }
        .service-card.selected { border-color: #4CAF50; background: rgba(76,175,80,0.1); }

        .modifier-option {
          padding: 10px 16px; border: 1px solid #1a3a1a; border-radius: 10px;
          cursor: pointer; transition: all 0.2s; background: transparent;
          font-family: inherit; color: #c8e0c8; font-size: 14px; text-align: left;
        }
        .modifier-option:hover { border-color: #4CAF50; }
        .modifier-option.selected { border-color: #4CAF50; background: rgba(76,175,80,0.1); color: #4CAF50; }

        .upload-zone {
          border: 2px dashed #1a3a1a; border-radius: 16px; padding: 32px 20px;
          text-align: center; cursor: pointer; transition: all 0.3s;
          background: rgba(76,175,80,0.02);
        }
        .upload-zone:hover { border-color: #4CAF50; background: rgba(76,175,80,0.05); }

        .media-thumb {
          width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 10px;
          background: #0a160a;
        }

        .btn-primary {
          width: 100%; padding: 16px; border-radius: 14px; border: none;
          background: linear-gradient(135deg, #4CAF50, #2E7D32); color: #fff;
          font-size: 16px; font-weight: 700; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.3s;
          box-shadow: 0 4px 20px rgba(76,175,80,0.3);
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 30px rgba(76,175,80,0.4); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .btn-secondary {
          width: 100%; padding: 14px; border-radius: 14px;
          border: 1px solid #1a3a1a; background: transparent;
          color: #5a8a5a; font-size: 15px; font-weight: 600; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.3s;
        }
        .btn-secondary:hover { border-color: #4CAF50; color: #4CAF50; }

        @media (max-width: 640px) {
          .quote-container { padding: 16px 16px 48px; }
        }
      `}</style>

      <div className="quote-container">
        {/* ─── Header ─── */}
        <div style={{ textAlign: "center", marginBottom: 8, paddingTop: 8 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jhps-nav-logo.svg" alt="JHPS" style={{ height: 36, marginBottom: 16 }} />
          </Link>
          {step !== "submitted" && (
            <h1 style={{
              fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8",
              fontWeight: 800, lineHeight: 1.2, marginBottom: 6,
            }}>
              Get a Free Video Quote
            </h1>
          )}
          {step !== "submitted" && (
            <p style={{ color: "#5a8a5a", fontSize: 15, marginBottom: 24 }}>
              Show us your property, get a price in hours — no site visit needed.
            </p>
          )}
        </div>

        {/* ─── Step Dots ─── */}
        {step !== "submitted" && (
          <div className="step-dots">
            {(["contact", "property", "service", "media", "review"] as Step[]).map((s, i) => {
              const steps: Step[] = ["contact", "property", "service", "media", "review"];
              const currentIndex = steps.indexOf(step);
              return (
                <div key={s} className={`step-dot ${i === currentIndex ? "active" : i < currentIndex ? "done" : "future"}`} />
              );
            })}
          </div>
        )}

        {/* ═══════════ STEP 1: CONTACT INFO ═══════════ */}
        {step === "contact" && (
          <div style={{ animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 700, marginBottom: 4 }}>Your Info</h2>

            <div>
              <label style={labelStyle}>Full Name *</label>
              <input className="quote-input" style={inputStyle} placeholder="John Smith"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div>
              <label style={labelStyle}>Email *</label>
              <input className="quote-input" style={inputStyle} type="email" placeholder="john@email.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>

            <div>
              <label style={labelStyle}>Phone *</label>
              <input className="quote-input" style={inputStyle} type="tel" placeholder="(407) 555-1234"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })}
                inputMode="tel" />
            </div>

            <div>
              <label style={labelStyle}>Property Address *</label>
              <input className="quote-input" style={inputStyle} placeholder="123 Main St"
                value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>City</label>
                <input className="quote-input" style={inputStyle} value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <input className="quote-input" style={inputStyle} value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Zip</label>
                <input className="quote-input" style={inputStyle} placeholder="32725"
                  value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} inputMode="numeric" />
              </div>
            </div>

            {/* GPS Capture */}
            <button onClick={captureGPS} disabled={gpsLoading} style={{
              padding: "10px 16px", background: "rgba(76,175,80,0.08)", border: "1px solid #1a3a1a",
              borderRadius: 10, color: form.latitude ? "#4CAF50" : "#5a8a5a", fontSize: 13,
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {gpsLoading ? (
                <span style={{ animation: "pulse 1s infinite" }}>📍 Getting location...</span>
              ) : form.latitude ? (
                <span>📍 Location captured ✓</span>
              ) : (
                <span>📍 Share my location (optional — helps with accuracy)</span>
              )}
            </button>

            <button className="btn-primary" disabled={!isContactValid}
              onClick={() => setStep("property")}>
              Next →
            </button>
          </div>
        )}

        {/* ═══════════ STEP 2: PROPERTY TYPE ═══════════ */}
        {step === "property" && (
          <div style={{ animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 700, marginBottom: 4 }}>Property Type</h2>

            {(["residential", "commercial"] as const).map((type) => (
              <button key={type} className={`service-card ${form.property_type === type ? "selected" : ""}`}
                onClick={() => setForm({ ...form, property_type: type })}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{type === "residential" ? "🏡" : "🏢"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f5e8", textTransform: "capitalize" }}>{type}</div>
                <div style={{ fontSize: 13, color: "#5a8a5a" }}>
                  {type === "residential" ? "Home, townhouse, or condo" : "Office, retail, HOA, or multi-unit"}
                </div>
              </button>
            ))}

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button className="btn-secondary" onClick={() => setStep("contact")}>← Back</button>
              <button className="btn-primary" onClick={() => setStep("service")}>Next →</button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 3: SERVICE & MODIFIERS ═══════════ */}
        {step === "service" && (
          <div style={{ animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 700, marginBottom: 4 }}>What do you need?</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["Lawn Care", "Pressure Washing", "Junk Removal", "Land Clearing", "Property Cleanup"].map((svc) => (
                <button key={svc}
                  className={`service-card ${form.service_requested === svc ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, service_requested: svc, modifier_data: {} })}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: form.service_requested === svc ? "#4CAF50" : "#e8f5e8" }}>
                    {svc === "Lawn Care" && "🌿 "}
                    {svc === "Pressure Washing" && "💧 "}
                    {svc === "Junk Removal" && "🚛 "}
                    {svc === "Land Clearing" && "🌲 "}
                    {svc === "Property Cleanup" && "🧹 "}
                    {svc}
                  </div>
                </button>
              ))}
            </div>

            {/* Modifiers for selected service */}
            {form.service_requested && SERVICE_MODIFIERS[form.service_requested] && (
              <div style={{
                marginTop: 16, padding: "20px", background: "rgba(76,175,80,0.03)",
                border: "1px solid #1a3a1a", borderRadius: 16,
              }}>
                <h3 style={{ fontSize: 15, color: "#4CAF50", fontWeight: 700, marginBottom: 16 }}>
                  Tell us more about the job
                </h3>
                {SERVICE_MODIFIERS[form.service_requested].map((mod) => {
                  // Skip palm height if no palms selected
                  if (mod.key === "palm_height" && (!form.modifier_data.palm_trees || (form.modifier_data.palm_trees as string).includes("None"))) {
                    return null;
                  }

                  return (
                    <div key={mod.key} style={{ marginBottom: 16 }}>
                      <label style={{ ...labelStyle, fontSize: 13, letterSpacing: 0.5 }}>{mod.label}</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {(mod.options || mod.tiers?.map((t) => t.label) || []).map((opt) => {
                          const value = mod.tiers ? mod.tiers.find((t) => t.label === opt)?.value || opt : opt;
                          const selected = form.modifier_data[mod.key] === (mod.tiers ? value : opt);
                          return (
                            <button key={opt}
                              className={`modifier-option ${selected ? "selected" : ""}`}
                              onClick={() => setForm({
                                ...form,
                                modifier_data: { ...form.modifier_data, [mod.key]: mod.tiers ? value : opt },
                              })}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button className="btn-secondary" onClick={() => setStep("property")}>← Back</button>
              <button className="btn-primary" disabled={!isServiceValid}
                onClick={() => setStep("media")}>
                Next: Add Photos / Video →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 4: MEDIA CAPTURE ═══════════ */}
        {step === "media" && (
          <div style={{ animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 700 }}>Show Us Your Property</h2>
            <p style={{ color: "#5a8a5a", fontSize: 14, marginBottom: 8 }}>
              Upload photos or short videos. The more we can see, the more accurate your quote.
            </p>

            {/* Shot list prompts */}
            {shotList.map((shot) => {
              const hasMedia = mediaFiles.some((m) => m.context === shot.id);
              return (
                <div key={shot.id} style={{
                  border: `1px solid ${hasMedia ? "#2E7D32" : "#1a3a1a"}`,
                  borderRadius: 14, padding: "16px", transition: "all 0.3s",
                  background: hasMedia ? "rgba(76,175,80,0.05)" : "transparent",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: hasMedia ? "#4CAF50" : "#e8f5e8" }}>
                        {hasMedia ? "✓ " : ""}{shot.label}
                      </div>
                      <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 2 }}>{shot.hint}</div>
                    </div>
                  </div>

                  {/* Show uploaded media for this shot */}
                  {mediaFiles.filter((m) => m.context === shot.id).map((m, i) => {
                    const globalIndex = mediaFiles.indexOf(m);
                    return (
                      <div key={i} style={{ position: "relative", marginTop: 8 }}>
                        {m.type === "photo" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.preview} alt={shot.label} className="media-thumb" />
                        ) : (
                          <video src={m.preview} className="media-thumb" controls playsInline style={{ background: "#0a160a" }} />
                        )}
                        <button onClick={() => removeMedia(globalIndex)} style={{
                          position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)",
                          border: "none", color: "#ef5350", width: 28, height: 28, borderRadius: 8,
                          cursor: "pointer", fontSize: 14, fontWeight: 700,
                        }}>✕</button>
                      </div>
                    );
                  })}

                  {/* Upload button for this shot */}
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
                    padding: "8px 14px", background: "rgba(76,175,80,0.08)", border: "1px solid #1a3a1a",
                    borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#4CAF50", fontWeight: 600,
                    transition: "all 0.2s",
                  }}>
                    📷 {hasMedia ? "Add More" : "Upload"}
                    <input type="file" accept="image/*,video/*" capture="environment" multiple
                      style={{ display: "none" }}
                      onChange={(e) => addMedia(e.target.files, shot.id)} />
                  </label>
                </div>
              );
            })}

            {/* General upload zone */}
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#4CAF50" }}>Upload additional files</div>
              <div style={{ fontSize: 12, color: "#3a5a3a", marginTop: 4 }}>Photos & videos up to 100MB each</div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple
                style={{ display: "none" }}
                onChange={(e) => addMedia(e.target.files, "general")} />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Anything else we should know?</label>
              <textarea className="quote-input" style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                placeholder="Special requests, timeline, specific concerns..."
                value={form.customer_notes}
                onChange={(e) => setForm({ ...form, customer_notes: e.target.value })} />
            </div>

            {/* File count summary */}
            {mediaFiles.length > 0 && (
              <div style={{
                padding: "10px 16px", background: "rgba(76,175,80,0.08)", borderRadius: 10,
                fontSize: 13, color: "#4CAF50", fontWeight: 600, textAlign: "center",
              }}>
                {mediaFiles.filter((m) => m.type === "photo").length} photo(s) &amp;
                {" "}{mediaFiles.filter((m) => m.type === "video").length} video(s) ready to upload
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn-secondary" onClick={() => setStep("service")}>← Back</button>
              <button className="btn-primary" onClick={() => setStep("review")}>
                Review & Submit →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 5: REVIEW ═══════════ */}
        {step === "review" && (
          <div style={{ animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 700 }}>Review Your Request</h2>

            {/* Summary cards */}
            <div style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Contact</div>
              <div style={{ color: "#e8f5e8", fontSize: 15 }}>{form.name}</div>
              <div style={{ color: "#5a8a5a", fontSize: 13 }}>{form.email} · {form.phone}</div>
            </div>

            <div style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Property</div>
              <div style={{ color: "#e8f5e8", fontSize: 15 }}>{form.address}</div>
              <div style={{ color: "#5a8a5a", fontSize: 13 }}>{[form.city, form.state, form.zip].filter(Boolean).join(", ")} · {form.property_type}</div>
              {form.latitude && <div style={{ color: "#3a5a3a", fontSize: 11, marginTop: 4 }}>📍 GPS captured</div>}
            </div>

            <div style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Service</div>
              <div style={{ color: "#4CAF50", fontSize: 16, fontWeight: 700 }}>{form.service_requested}</div>
              {Object.entries(form.modifier_data).length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(form.modifier_data).map(([key, val]) => (
                    <span key={key} style={{
                      padding: "3px 10px", background: "rgba(76,175,80,0.1)", borderRadius: 8,
                      fontSize: 12, color: "#66bb6a",
                    }}>
                      {String(val)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Media</div>
              <div style={{ color: "#e8f5e8", fontSize: 15 }}>
                {mediaFiles.length === 0
                  ? "No media uploaded"
                  : `${mediaFiles.filter((m) => m.type === "photo").length} photos, ${mediaFiles.filter((m) => m.type === "video").length} videos`}
              </div>
              {mediaFiles.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, marginTop: 10 }}>
                  {mediaFiles.map((m, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      {m.type === "photo" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.preview} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} />
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "1", background: "#0a160a", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#4CAF50", fontSize: 20 }}>▶</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {form.customer_notes && (
              <div style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Notes</div>
                <div style={{ color: "#c8e0c8", fontSize: 14 }}>{form.customer_notes}</div>
              </div>
            )}

            {error && (
              <div style={{ padding: "12px 16px", background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 10, color: "#ef5350", fontSize: 14 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn-secondary" onClick={() => setStep("media")}>← Back</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={uploading}>
                {uploading ? "Uploading..." : "Submit Quote Request"}
              </button>
            </div>

            {uploading && (
              <div style={{ textAlign: "center", color: "#5a8a5a", fontSize: 13 }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>Uploading your files... This may take a moment for videos.</span>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ SUBMITTED ═══════════ */}
        {step === "submitted" && (
          <div style={{ animation: "slideUp 0.5s ease", textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif", fontSize: 32, color: "#e8f5e8",
              fontWeight: 800, marginBottom: 12, lineHeight: 1.2,
            }}>
              Quote Request Submitted!
            </h1>
            <p style={{ color: "#5a8a5a", fontSize: 16, maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.6 }}>
              We&apos;ll review your property and send you a detailed estimate. Most quotes are ready within 2 hours during business hours.
            </p>

            <div style={{
              background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.2)",
              borderRadius: 14, padding: "20px", maxWidth: 360, margin: "0 auto 24px",
            }}>
              <div style={{ fontSize: 13, color: "#4CAF50", fontWeight: 700, marginBottom: 8 }}>What happens next?</div>
              <div style={{ fontSize: 14, color: "#5a8a5a", lineHeight: 1.8 }}>
                1. We review your photos &amp; videos<br />
                2. We send you a price range<br />
                3. You accept — we schedule the job
              </div>
            </div>

            {leadId && (
              <p style={{ fontSize: 12, color: "#2a4a2a", marginBottom: 20 }}>
                Reference: {leadId.slice(0, 8)}
              </p>
            )}

            <Link href="/" style={{
              display: "inline-block", padding: "14px 32px", borderRadius: 12,
              background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
              textDecoration: "none", fontWeight: 700, fontSize: 15,
            }}>
              ← Back to Home
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
