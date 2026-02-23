"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

// ─── Types ───
type Step = "contact" | "property" | "service" | "media" | "review" | "uploading" | "submitted";

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
  compressed?: boolean;
  tooLarge?: boolean;
}

interface UploadProgress {
  total: number;
  completed: number;
  current: string;
  percent: number;
  failed: string[];
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

// ─── Shot list generator ───
function getShotList(service: string, modifiers: Record<string, unknown>): { id: string; label: string; hint: string }[] {
  const shots: { id: string; label: string; hint: string }[] = [
    { id: "front_wide", label: "Front yard — wide shot", hint: "Stand at the sidewalk and slowly pan across the full front of the property." },
  ];

  if (service === "Lawn Care") {
    const areas = (modifiers.areas as string) || "";
    if (areas.includes("back")) {
      shots.push({ id: "back_wide", label: "Backyard — wide shot", hint: "Pan slowly across the full backyard from one corner." });
    }
    if ((modifiers.palm_trees as string) && !(modifiers.palm_trees as string).includes("None")) {
      shots.push({ id: "palm_height", label: "Palm trees — height reference", hint: "Photo the tallest palm with your house or car visible for scale." });
    }
    if ((modifiers.narrow_gate as string)?.includes("Yes")) {
      shots.push({ id: "gate_width", label: "Gate opening", hint: "Place your foot next to the gate opening for scale." });
    }
    if ((modifiers.hedges as string) && !(modifiers.hedges as string).includes("None")) {
      shots.push({ id: "hedges", label: "Hedges / bushes", hint: "Show the hedges from a few feet away so we can see height and density." });
    }
    if ((modifiers.grass_condition as string)?.includes("overgrown") || (modifiers.grass_condition as string)?.includes("knee")) {
      shots.push({ id: "condition", label: "Worst area close-up", hint: "Film or photo the most overgrown section." });
    }
  } else if (service === "Pressure Washing") {
    shots.push({ id: "surface_main", label: "Main surface to wash", hint: "Stand back to capture the full area." });
    shots.push({ id: "stain_closeup", label: "Stain close-up", hint: "Get close to show the type of staining." });
  } else if (service === "Junk Removal") {
    shots.push({ id: "junk_overview", label: "All items overview", hint: "Show everything that needs to go in one wide shot." });
    shots.push({ id: "junk_access", label: "Access path", hint: "Show how we'd get to and remove the items." });
  } else if (service === "Land Clearing") {
    shots.push({ id: "clearing_area", label: "Area to clear", hint: "Show the full area from the widest vantage point." });
    shots.push({ id: "vegetation_closeup", label: "Vegetation close-up", hint: "Show brush sizes and density up close." });
  } else if (service === "Property Cleanup") {
    shots.push({ id: "cleanup_overview", label: "Property overview", hint: "Slow pan showing the overall state." });
    shots.push({ id: "problem_areas", label: "Worst areas", hint: "Film the areas needing the most attention." });
  }

  shots.push({ id: "additional", label: "Anything else (optional)", hint: "Any other angles or areas you want us to see." });
  return shots;
}

// ─── File size limits ───
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;   // 500MB hard limit
const MAX_PHOTO_BYTES = 50 * 1024 * 1024;    // 50MB
const COMPRESS_THRESHOLD = 200 * 1024 * 1024; // compress videos over 200MB

// ─── Video compression using MediaRecorder ───
async function compressVideo(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const targetWidth = Math.min(video.videoWidth, 1280);
      const targetHeight = Math.min(video.videoHeight, 720);
      const scale = Math.min(targetWidth / video.videoWidth, targetHeight / video.videoHeight, 1);
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;

      let mimeType = "video/webm;codecs=vp8";
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) mimeType = "video/webm;codecs=vp9";
      if (MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")) mimeType = "video/mp4;codecs=avc1";

      const stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2000000 });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: mimeType.split(";")[0] });
        URL.revokeObjectURL(video.src);
        resolve(compressed);
      };
      recorder.onerror = () => { URL.revokeObjectURL(video.src); reject(new Error("Compression failed")); };

      recorder.start();
      const drawFrame = () => {
        if (video.ended || video.paused) { recorder.stop(); return; }
        ctx.drawImage(video, 0, 0, width, height);
        requestAnimationFrame(drawFrame);
      };
      video.onended = () => recorder.stop();
      video.play().then(drawFrame).catch(reject);

      // Safety: stop after 5 minutes max
      setTimeout(() => { if (recorder.state === "recording") { video.pause(); recorder.stop(); } }, 300000);
    };
    video.onerror = () => { URL.revokeObjectURL(video.src); reject(new Error("Could not load video")); };
  });
}

// ─── Phone formatting ───
function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function fileSizeStr(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ═══════════ COMPONENT ═══════════
export default function GetQuotePage() {
  const [step, setStep] = useState<Step>("contact");
  const [form, setForm] = useState<FormData>({
    name: "", email: "", phone: "", address: "", city: "Deltona", state: "FL", zip: "",
    latitude: null, longitude: null, property_type: "residential", service_requested: "",
    modifier_data: {}, customer_notes: "",
  });
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [compressing, setCompressing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── GPS ───
  const captureGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })); setGpsLoading(false); },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const isContactValid = form.name && form.email && form.phone.replace(/\D/g, "").length >= 10 && form.address;
  const isServiceValid = form.service_requested !== "";

  // ─── Media handling — compress videos over 200MB, add all others immediately ───
  const addMedia = async (files: FileList | null, context: string = "") => {
    if (!files) return;

    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const limit = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;

      if (file.size > limit) {
        // File is genuinely too large even for compression — skip silently with indicator
        const preview = URL.createObjectURL(file);
        setMediaFiles((prev) => [...prev, { file, preview, context, type: isVideo ? "video" : "photo", tooLarge: true }]);
        continue;
      }

      if (isVideo && file.size > COMPRESS_THRESHOLD) {
        // Large video — compress it down before upload
        setCompressing(file.name);
        try {
          const compressed = await compressVideo(file);
          const preview = URL.createObjectURL(compressed);
          setMediaFiles((prev) => [...prev, { file: compressed, preview, context, type: "video", compressed: true }]);
        } catch {
          // Compression failed — add original and let upload handle it
          const preview = URL.createObjectURL(file);
          setMediaFiles((prev) => [...prev, { file, preview, context, type: "video", compressed: false }]);
        }
        setCompressing(null);
      } else {
        // Under 200MB — add directly, no compression needed
        const preview = URL.createObjectURL(file);
        setMediaFiles((prev) => [...prev, { file, preview, context, type: isVideo ? "video" : "photo" }]);
      }
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ─── Submit: Direct-to-B2 Upload Flow ───
  const handleSubmit = async () => {
    setError("");
    setStep("uploading");
    setUploadProgress({ total: mediaFiles.length, completed: 0, current: "Creating quote request...", percent: 0, failed: [] });

    // Keep screen/CPU awake during upload — prevents Android from killing the tab
    let wakeLock: WakeLockSentinel | null = null;
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
      }
    } catch { /* wake lock not supported or denied — continue anyway */ }

    try {
      // Step 1: Create the lead record
      const leadRes = await fetch("/api/leads/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          latitude: form.latitude,
          longitude: form.longitude,
          property_type: form.property_type,
          service_requested: form.service_requested,
          modifier_data: form.modifier_data,
          customer_notes: form.customer_notes,
        }),
      });

      const leadData = await leadRes.json();
      if (!leadRes.ok || !leadData.success) {
        setError(leadData.error || "Failed to create quote request");
        setStep("review");
        return;
      }

      const newLeadId = leadData.leadId;
      setLeadId(newLeadId);

      // Step 2: Get all pre-signed URLs in parallel
      setUploadProgress({
        total: mediaFiles.length, completed: 0,
        current: `Getting upload slots for ${mediaFiles.length} files...`,
        percent: 5, failed: [],
      });

      const urlResults = await Promise.allSettled(
        mediaFiles.map((media, i) =>
          fetch("/api/leads/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leadId: newLeadId,
              filename: media.file.name,
              contentType: media.file.type || "application/octet-stream",
              fileSize: media.file.size,
            }),
          }).then((r) => r.json()).then((d) => ({ ...d, index: i }))
        )
      );

      // Step 3: Upload all files to B2 in parallel
      setUploadProgress({
        total: mediaFiles.length, completed: 0,
        current: `Uploading ${mediaFiles.length} files...`,
        percent: 15, failed: [],
      });

      const failed: string[] = [];
      type UploadOk = { storageKey: string; index: number };

      const uploadResults = await Promise.allSettled(
        urlResults.map(async (urlResult, i) => {
          const media = mediaFiles[i];
          if (urlResult.status === "rejected" || !urlResult.value?.uploadUrl) {
            throw new Error("no-url");
          }
          const { uploadUrl, storageKey } = urlResult.value;
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": media.file.type || "application/octet-stream" },
            body: media.file,
          });
          if (!uploadRes.ok) throw new Error(`b2-${uploadRes.status}`);
          return { storageKey, index: i } as UploadOk;
        })
      );

      // Collect failures
      uploadResults.forEach((result, i) => {
        if (result.status === "rejected") {
          console.error(`Upload failed for ${mediaFiles[i].file.name}:`, result.reason);
          failed.push(mediaFiles[i].file.name);
        }
      });

      // Step 4: Register all successful uploads in parallel
      const successful = uploadResults
        .filter((r): r is PromiseFulfilledResult<UploadOk> => r.status === "fulfilled")
        .map((r) => r.value);

      setUploadProgress({
        total: mediaFiles.length,
        completed: successful.length,
        current: successful.length > 0 ? "Saving..." : "Done",
        percent: 85,
        failed,
      });

      await Promise.allSettled(
        successful.map(({ storageKey, index }) => {
          const media = mediaFiles[index];
          return fetch("/api/leads/register-media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leadId: newLeadId,
              storagePath: storageKey,
              mediaType: media.type,
              originalFilename: media.file.name,
              contentType: media.file.type,
              fileSizeBytes: media.file.size,
              captureContext: media.context,
              sortOrder: index,
            }),
          });
        })
      );

      setUploadProgress({
        total: mediaFiles.length,
        completed: successful.length,
        current: "Complete!",
        percent: 100,
        failed,
      });

      // Small delay for the progress bar to fill
      await new Promise((r) => setTimeout(r, 500));
      setStep("submitted");

    } catch (err) {
      console.error("Submit error:", err);
      setError("Connection error. Please check your internet and try again.");
      setStep("review");
    } finally {
      wakeLock?.release().catch(() => {});
    }
  };

  // ─── Shot list ───
  const shotList = form.service_requested ? getShotList(form.service_requested, form.modifier_data) : [];

  // ─── Styles ───
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "14px 16px", background: "#0d1a0d",
    border: "1px solid #1a3a1a", borderRadius: 12, color: "#e8f5e8",
    fontSize: 16, outline: "none", fontFamily: "'DM Sans', sans-serif",
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
        @keyframes progressPulse { 0%, 100% { box-shadow: 0 0 0 rgba(76,175,80,0); } 50% { box-shadow: 0 0 20px rgba(76,175,80,0.3); } }

        .qc { max-width: 640px; margin: 0 auto; padding: 24px 20px 60px; min-height: 100vh; animation: fadeIn 0.4s ease; }
        .qi:focus { border-color: #4CAF50 !important; }
        .qi::placeholder { color: #3a5a3a; }

        .step-dots { display: flex; gap: 8px; justify-content: center; margin-bottom: 32px; }
        .sd { width: 10px; height: 10px; border-radius: 50%; transition: all 0.3s; }
        .sd.a { background: #4CAF50; box-shadow: 0 0 10px rgba(76,175,80,0.5); }
        .sd.d { background: #2E7D32; }
        .sd.f { background: #1a3a1a; }

        .sc { padding: 16px 20px; border: 1px solid #1a3a1a; border-radius: 14px; cursor: pointer; transition: all 0.3s; background: transparent; text-align: left; width: 100%; font-family: inherit; color: inherit; }
        .sc:hover { border-color: #4CAF50; background: rgba(76,175,80,0.04); }
        .sc.sel { border-color: #4CAF50; background: rgba(76,175,80,0.1); }

        .mo { padding: 10px 16px; border: 1px solid #1a3a1a; border-radius: 10px; cursor: pointer; transition: all 0.2s; background: transparent; font-family: inherit; color: #c8e0c8; font-size: 14px; text-align: left; }
        .mo:hover { border-color: #4CAF50; }
        .mo.sel { border-color: #4CAF50; background: rgba(76,175,80,0.1); color: #4CAF50; }

        .uz { border: 2px dashed #1a3a1a; border-radius: 16px; padding: 32px 20px; text-align: center; cursor: pointer; transition: all 0.3s; background: rgba(76,175,80,0.02); }
        .uz:hover { border-color: #4CAF50; background: rgba(76,175,80,0.05); }

        .mt { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 10px; background: #0a160a; }

        .bp { width: 100%; padding: 16px; border-radius: 14px; border: none; background: linear-gradient(135deg, #4CAF50, #2E7D32); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; box-shadow: 0 4px 20px rgba(76,175,80,0.3); transition: all 0.3s; }
        .bp:hover { transform: translateY(-1px); box-shadow: 0 6px 30px rgba(76,175,80,0.4); }
        .bp:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .bs { width: 100%; padding: 14px; border-radius: 14px; border: 1px solid #1a3a1a; background: transparent; color: #5a8a5a; font-size: 15px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.3s; }
        .bs:hover { border-color: #4CAF50; color: #4CAF50; }

        @media (max-width: 640px) { .qc { padding: 16px 16px 48px; } }
      `}</style>

      <div className="qc">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 8, paddingTop: 8 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jhps-nav-logo.svg" alt="JHPS" style={{ height: 36, marginBottom: 16 }} />
          </Link>
          {!["uploading", "submitted"].includes(step) && (
            <>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8f5e8", fontWeight: 800, lineHeight: 1.2, marginBottom: 6 }}>
                Get a Free Video Quote
              </h1>
              <p style={{ color: "#5a8a5a", fontSize: 15, marginBottom: 24 }}>
                Show us your property, get a price in hours — no site visit needed.
              </p>
            </>
          )}
        </div>

        {/* Step Dots */}
        {!["uploading", "submitted"].includes(step) && (
          <div className="step-dots">
            {(["contact", "property", "service", "media", "review"] as Step[]).map((s, i) => {
              const idx = (["contact", "property", "service", "media", "review"] as Step[]).indexOf(step);
              return <div key={s} className={`sd ${i === idx ? "a" : i < idx ? "d" : "f"}`} />;
            })}
          </div>
        )}

        {/* ═══ STEP 1: CONTACT ═══ */}
        {step === "contact" && (
          <div style={{ animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 700, marginBottom: 4 }}>Your Info</h2>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input className="qi" style={inputStyle} placeholder="John Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input className="qi" style={inputStyle} type="email" placeholder="john@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Phone *</label>
              <input className="qi" style={inputStyle} type="tel" placeholder="(407) 555-1234" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })} inputMode="tel" />
            </div>
            <div>
              <label style={labelStyle}>Property Address *</label>
              <input className="qi" style={inputStyle} placeholder="123 Main St" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
              <div><label style={labelStyle}>City</label><input className="qi" style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><label style={labelStyle}>State</label><input className="qi" style={inputStyle} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
              <div><label style={labelStyle}>Zip</label><input className="qi" style={inputStyle} placeholder="32725" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} inputMode="numeric" /></div>
            </div>
            <button onClick={captureGPS} disabled={gpsLoading} style={{
              padding: "10px 16px", background: "rgba(76,175,80,0.08)", border: "1px solid #1a3a1a",
              borderRadius: 10, color: form.latitude ? "#4CAF50" : "#5a8a5a", fontSize: 13,
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              {gpsLoading ? "📍 Getting location..." : form.latitude ? "📍 Location captured ✓" : "📍 Share my location (helps accuracy)"}
            </button>
            <button className="bp" disabled={!isContactValid} onClick={() => setStep("property")}>Next →</button>
          </div>
        )}

        {/* ═══ STEP 2: PROPERTY TYPE ═══ */}
        {step === "property" && (
          <div style={{ animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 700 }}>Property Type</h2>
            {(["residential", "commercial"] as const).map((t) => (
              <button key={t} className={`sc ${form.property_type === t ? "sel" : ""}`} onClick={() => setForm({ ...form, property_type: t })}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{t === "residential" ? "🏡" : "🏢"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f5e8", textTransform: "capitalize" }}>{t}</div>
                <div style={{ fontSize: 13, color: "#5a8a5a" }}>{t === "residential" ? "Home, townhouse, or condo" : "Office, retail, HOA, or multi-unit"}</div>
              </button>
            ))}
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button className="bs" onClick={() => setStep("contact")}>← Back</button>
              <button className="bp" onClick={() => setStep("service")}>Next →</button>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: SERVICE + MODIFIERS ═══ */}
        {step === "service" && (
          <div style={{ animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 700 }}>What do you need?</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["Lawn Care", "Pressure Washing", "Junk Removal", "Land Clearing", "Property Cleanup"].map((svc) => (
                <button key={svc} className={`sc ${form.service_requested === svc ? "sel" : ""}`}
                  onClick={() => setForm({ ...form, service_requested: svc, modifier_data: {} })}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: form.service_requested === svc ? "#4CAF50" : "#e8f5e8" }}>
                    {{"Lawn Care":"🌿","Pressure Washing":"💧","Junk Removal":"🚛","Land Clearing":"🌲","Property Cleanup":"🧹"}[svc]} {svc}
                  </div>
                </button>
              ))}
            </div>

            {form.service_requested && SERVICE_MODIFIERS[form.service_requested] && (
              <div style={{ marginTop: 16, padding: 20, background: "rgba(76,175,80,0.03)", border: "1px solid #1a3a1a", borderRadius: 16 }}>
                <h3 style={{ fontSize: 15, color: "#4CAF50", fontWeight: 700, marginBottom: 16 }}>Tell us more</h3>
                {SERVICE_MODIFIERS[form.service_requested].map((mod) => {
                  if (mod.key === "palm_height" && (!(form.modifier_data.palm_trees as string) || (form.modifier_data.palm_trees as string).includes("None"))) return null;
                  return (
                    <div key={mod.key} style={{ marginBottom: 16 }}>
                      <label style={{ ...labelStyle, fontSize: 13, letterSpacing: 0.5 }}>{mod.label}</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {(mod.options || mod.tiers?.map((t) => t.label) || []).map((opt) => {
                          const val = mod.tiers ? mod.tiers.find((t) => t.label === opt)?.value || opt : opt;
                          const sel = form.modifier_data[mod.key] === (mod.tiers ? val : opt);
                          return (
                            <button key={opt} className={`mo ${sel ? "sel" : ""}`}
                              onClick={() => setForm({ ...form, modifier_data: { ...form.modifier_data, [mod.key]: mod.tiers ? val : opt } })}>
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
              <button className="bs" onClick={() => setStep("property")}>← Back</button>
              <button className="bp" disabled={!isServiceValid} onClick={() => setStep("media")}>Next: Add Photos / Video →</button>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: MEDIA ═══ */}
        {step === "media" && (
          <div style={{ animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 700 }}>Show Us Your Property</h2>
            <p style={{ color: "#5a8a5a", fontSize: 14, marginBottom: 8 }}>
              Upload photos and videos of your property. Large videos are automatically optimized.
            </p>

            {compressing && (
              <div style={{ padding: "12px 16px", background: "rgba(255,167,38,0.1)", border: "1px solid rgba(255,167,38,0.2)", borderRadius: 10, fontSize: 13, color: "#ffa726", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>⚙️</span> Optimizing {compressing}...
              </div>
            )}

            {shotList.map((shot) => {
              const shotMedia = mediaFiles.filter((m) => m.context === shot.id);
              const hasMedia = shotMedia.length > 0;
              return (
                <div key={shot.id} style={{
                  border: `1px solid ${hasMedia ? "#2E7D32" : "#1a3a1a"}`, borderRadius: 14,
                  padding: 16, background: hasMedia ? "rgba(76,175,80,0.05)" : "transparent",
                }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: hasMedia ? "#4CAF50" : "#e8f5e8" }}>
                      {hasMedia ? "✓ " : ""}{shot.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#5a8a5a", marginTop: 2 }}>{shot.hint}</div>
                  </div>

                  {shotMedia.map((m) => {
                    const gi = mediaFiles.indexOf(m);
                    return (
                      <div key={gi} style={{ position: "relative", marginTop: 8 }}>
                        {m.type === "photo" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.preview} alt={shot.label} className="mt" />
                        ) : (
                          <video src={m.preview} className="mt" controls playsInline />
                        )}
                        {m.compressed && (
                          <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", padding: "2px 8px", borderRadius: 6, fontSize: 10, color: "#4CAF50", fontWeight: 700 }}>
                            OPTIMIZED
                          </div>
                        )}
                        {m.tooLarge && (
                          <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(239,83,80,0.85)", padding: "2px 8px", borderRadius: 6, fontSize: 10, color: "#fff", fontWeight: 700 }}>
                            TOO LARGE
                          </div>
                        )}
                        <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.7)", padding: "2px 8px", borderRadius: 6, fontSize: 10, color: "#5a8a5a" }}>
                          {fileSizeStr(m.file.size)}
                        </div>
                        <button onClick={() => removeMedia(gi)} style={{
                          position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)",
                          border: "none", color: "#ef5350", width: 28, height: 28, borderRadius: 8,
                          cursor: "pointer", fontSize: 14, fontWeight: 700,
                        }}>✕</button>
                      </div>
                    );
                  })}

                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
                    padding: "8px 14px", background: "rgba(76,175,80,0.08)", border: "1px solid #1a3a1a",
                    borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#4CAF50", fontWeight: 600,
                  }}>
                    📷 {hasMedia ? "Add More" : "Upload"}
                    <input type="file" accept="image/*,video/*" capture="environment" multiple style={{ display: "none" }}
                      onChange={(e) => addMedia(e.target.files, shot.id)} />
                  </label>
                </div>
              );
            })}

            <div className="uz" onClick={() => fileInputRef.current?.click()}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#4CAF50" }}>Upload additional files</div>
              <div style={{ fontSize: 12, color: "#3a5a3a", marginTop: 4 }}>Photos & videos — large files auto-compressed</div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }}
                onChange={(e) => addMedia(e.target.files, "general")} />
            </div>

            <div>
              <label style={labelStyle}>Anything else we should know?</label>
              <textarea className="qi" style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                placeholder="Special requests, timeline, concerns..."
                value={form.customer_notes} onChange={(e) => setForm({ ...form, customer_notes: e.target.value })} />
            </div>

            {mediaFiles.length > 0 && (
              <div style={{ padding: "10px 16px", background: "rgba(76,175,80,0.08)", borderRadius: 10, fontSize: 13, color: "#4CAF50", fontWeight: 600, textAlign: "center" }}>
                {mediaFiles.filter((m) => m.type === "photo").length} photo(s) & {mediaFiles.filter((m) => m.type === "video").length} video(s) ·
                Total: {fileSizeStr(mediaFiles.reduce((s, m) => s + m.file.size, 0))}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button className="bs" onClick={() => setStep("service")}>← Back</button>
              <button className="bp" onClick={() => setStep("review")}>Review & Submit →</button>
            </div>
          </div>
        )}

        {/* ═══ STEP 5: REVIEW ═══ */}
        {step === "review" && (
          <div style={{ animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 18, color: "#e8f5e8", fontWeight: 700 }}>Review Your Request</h2>

            {[
              { title: "Contact", lines: [form.name, `${form.email} · ${form.phone}`] },
              { title: "Property", lines: [form.address, `${[form.city, form.state, form.zip].filter(Boolean).join(", ")} · ${form.property_type}`, form.latitude ? "📍 GPS captured" : ""] },
              { title: "Service", lines: [form.service_requested] },
            ].map((card) => (
              <div key={card.title} style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>{card.title}</div>
                {card.lines.filter(Boolean).map((line, i) => (
                  <div key={i} style={{ color: i === 0 ? (card.title === "Service" ? "#4CAF50" : "#e8f5e8") : "#5a8a5a", fontSize: i === 0 ? 15 : 13, fontWeight: card.title === "Service" ? 700 : 400 }}>{line}</div>
                ))}
                {card.title === "Service" && Object.entries(form.modifier_data).length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(form.modifier_data).map(([k, v]) => (
                      <span key={k} style={{ padding: "3px 10px", background: "rgba(76,175,80,0.1)", borderRadius: 8, fontSize: 12, color: "#66bb6a" }}>{String(v)}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div style={{ background: "#0d1a0d", border: "1px solid #1a3a1a", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#5a8a5a", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Media</div>
              <div style={{ color: "#e8f5e8", fontSize: 15 }}>
                {mediaFiles.length === 0 ? "No media uploaded" : `${mediaFiles.filter((m) => m.type === "photo").length} photos, ${mediaFiles.filter((m) => m.type === "video").length} videos`}
              </div>
              {mediaFiles.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, marginTop: 10 }}>
                  {mediaFiles.map((m, i) => (
                    <div key={i}>{m.type === "photo" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.preview} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "1", background: "#0a160a", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#4CAF50", fontSize: 20 }}>▶</div>
                    )}</div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div style={{ padding: "12px 16px", background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 10, color: "#ef5350", fontSize: 14 }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button className="bs" onClick={() => setStep("media")}>← Back</button>
              <button className="bp" onClick={handleSubmit}>Submit Quote Request</button>
            </div>
          </div>
        )}

        {/* ═══ UPLOADING ═══ */}
        {step === "uploading" && uploadProgress && (
          <div style={{ animation: "fadeIn 0.3s ease", textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📤</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#e8f5e8", fontWeight: 800, marginBottom: 8 }}>
              Uploading Your Files
            </h2>
            <p style={{ color: "#5a8a5a", fontSize: 14, marginBottom: 32 }}>{uploadProgress.current}</p>

            {/* Progress bar */}
            <div style={{
              width: "100%", maxWidth: 400, margin: "0 auto 16px", height: 8,
              background: "#1a3a1a", borderRadius: 4, overflow: "hidden",
              animation: "progressPulse 2s infinite",
            }}>
              <div style={{
                height: "100%", background: "linear-gradient(90deg, #4CAF50, #66bb6a)",
                borderRadius: 4, transition: "width 0.5s ease",
                width: `${uploadProgress.percent}%`,
              }} />
            </div>

            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "#4CAF50" }}>
              {uploadProgress.completed} / {uploadProgress.total} files
            </p>

            {uploadProgress.failed.length > 0 && (
              <div style={{ marginTop: 16, padding: "10px 16px", background: "rgba(239,83,80,0.08)", borderRadius: 10, fontSize: 12, color: "#ef5350" }}>
                Failed: {uploadProgress.failed.join(", ")}
              </div>
            )}

            <p style={{ color: "#3a5a3a", fontSize: 12, marginTop: 24 }}>Keep this page open &amp; screen unlocked while uploading</p>
          </div>
        )}

        {/* ═══ SUBMITTED ═══ */}
        {step === "submitted" && (
          <div style={{ animation: "slideUp 0.5s ease", textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: "#e8f5e8", fontWeight: 800, marginBottom: 12, lineHeight: 1.2 }}>
              Quote Request Submitted!
            </h1>
            <p style={{ color: "#5a8a5a", fontSize: 16, maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.6 }}>
              We&apos;ll review your property and send you a detailed estimate. Most quotes are ready within 2 hours during business hours.
            </p>

            <div style={{
              background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.2)",
              borderRadius: 14, padding: 20, maxWidth: 360, margin: "0 auto 24px",
            }}>
              <div style={{ fontSize: 13, color: "#4CAF50", fontWeight: 700, marginBottom: 8 }}>What happens next?</div>
              <div style={{ fontSize: 14, color: "#5a8a5a", lineHeight: 1.8 }}>
                1. We review your photos & videos<br />
                2. We send you a price range<br />
                3. You accept — we schedule the job
              </div>
            </div>

            {leadId && <p style={{ fontSize: 12, color: "#2a4a2a", marginBottom: 20 }}>Ref: {leadId.slice(0, 8)}</p>}

            <Link href="/" style={{
              display: "inline-block", padding: "14px 32px", borderRadius: 12,
              background: "linear-gradient(135deg, #4CAF50, #2E7D32)", color: "#fff",
              textDecoration: "none", fontWeight: 700, fontSize: 15,
            }}>← Back to Home</Link>
          </div>
        )}
      </div>
    </>
  );
}
