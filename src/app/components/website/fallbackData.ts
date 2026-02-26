import type { CSSProperties } from "react";

export interface GalleryItemLocal {
  src: string;
  caption: string;
  tag: string;
  imageFit?: CSSProperties['objectFit'];
  imagePosition?: string;
  fullSrc?: string;
}

export const FALLBACK_SERVICES = [
  { title: "Lawn Care", desc: "Mowing, edging, trimming, blowing & seasonal cleanups. Your yard, perfected every visit.", icon: "🌿", image: "https://images.pexels.com/photos/1453499/pexels-photo-1453499.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop", imageFit: "cover" as const, imagePosition: "center" },
  { title: "Pressure Washing", desc: "High-pressure & soft wash for driveways, buildings, sidewalks & commercial properties.", icon: "💧", image: "https://images.pexels.com/photos/9681671/pexels-photo-9681671.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop", imageFit: "cover" as const, imagePosition: "center" },
  { title: "Junk Removal", desc: "Fast, affordable haul-away for furniture, debris, appliances & construction waste.", icon: "🚛", image: "https://images.pexels.com/photos/4108715/pexels-photo-4108715.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop", imageFit: "cover" as const, imagePosition: "center" },
  { title: "Land Clearing", desc: "Brush removal, lot clearing & grading for residential and commercial properties.", icon: "🌲", image: "https://images.pexels.com/photos/296234/pexels-photo-296234.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop", imageFit: "cover" as const, imagePosition: "center" },
  { title: "Property Cleanups", desc: "Vacant house cleanup, overgrown yards, plant removal & full property restoration.", icon: "🏠", image: "https://images.pexels.com/photos/186077/pexels-photo-186077.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop", imageFit: "cover" as const, imagePosition: "center" },
];

export const FALLBACK_GALLERY: GalleryItemLocal[] = [
  { src: "https://images.pexels.com/photos/9681671/pexels-photo-9681671.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop", caption: "Commercial Pressure Washing", tag: "Pressure Wash", imageFit: "cover", imagePosition: "center" },
  { src: "https://images.pexels.com/photos/1453499/pexels-photo-1453499.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop", caption: "Professional Lawn Maintenance", tag: "Lawn Care", imageFit: "cover", imagePosition: "center" },
  { src: "https://images.pexels.com/photos/186077/pexels-photo-186077.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop", caption: "Full Property Restoration", tag: "Property Cleanup", imageFit: "cover", imagePosition: "center" },
  { src: "https://images.pexels.com/photos/296234/pexels-photo-296234.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop", caption: "Land Clearing & Grading", tag: "Land Clearing", imageFit: "cover", imagePosition: "center" },
  { src: "https://images.pexels.com/photos/7587924/pexels-photo-7587924.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop", caption: "Residential Exterior Cleaning", tag: "Pressure Wash", imageFit: "cover", imagePosition: "center" },
  { src: "https://images.pexels.com/photos/1301856/pexels-photo-1301856.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop", caption: "Garden & Yard Cleanup", tag: "Lawn Care", imageFit: "cover", imagePosition: "center" },
];

export const FALLBACK_STEPS = [
  { num: "01", title: "Call or Text", desc: "Reach us at 407-686-9817. We respond fast.", icon: "📱" },
  { num: "02", title: "Free Estimate", desc: "We assess your property and give you an honest quote.", icon: "📋" },
  { num: "03", title: "We Do The Work", desc: "Our crew shows up on time and gets it done right.", icon: "💪" },
  { num: "04", title: "You Enjoy", desc: "Sit back and enjoy your clean, beautiful property.", icon: "✨" },
];

export const FALLBACK_STATS = [
  { value: 500, suffix: "+", label: "Jobs Completed" },
  { value: 100, suffix: "%", label: "Satisfaction Rate" },
  { value: 24, suffix: "hr", label: "Fast Response" },
  { value: 5, suffix: "+", label: "Services Offered" },
];

export const FALLBACK_TRUST = [
  { icon: "✓", title: "Free Estimates", description: "No obligation quotes for all services" },
  { icon: "⚡", title: "Fast Scheduling", description: "Quick turnaround, flexible availability" },
  { icon: "📍", title: "Locally Owned", description: "Based in the Deltona / Orlando area" },
  { icon: "🛡️", title: "Reliable & Insured", description: "Professional service you can trust" },
];

export const FALLBACK_SERVICE_IMAGES = [
  'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop',
];

export const FALLBACK_GALLERY_IMAGES = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop',
];

export const HERO_STOCK = 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=700&h=500&fit=crop';
export const PROMO_FEATURED_STOCK = 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=400&fit=crop';
export const PROMO_SECONDARY_STOCK = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=400&fit=crop';
