import { urlFor } from "@/sanity/lib/image";

export function getSanityImageSrc(img: { asset?: { _ref?: string; url?: string } } | undefined, width = 800, height = 600, fit: string = "crop"): string | null {
  if (!img?.asset) return null;
  try {
    const sanityFit = fit === "contain" ? "max" : fit === "fill" ? "scale" : "crop";
    return urlFor(img).width(width).height(height).fit(sanityFit as "crop" | "clip" | "fill" | "max" | "min" | "scale").url();
  } catch {
    return null;
  }
}

export function getLogoSrc(img: { asset?: { _ref?: string; url?: string } } | undefined, width = 320): string | null {
  if (!img?.asset) return null;
  try {
    return urlFor(img).width(width).fit("max").url();
  } catch {
    return null;
  }
}
