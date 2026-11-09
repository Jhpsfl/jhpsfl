import type { Metadata } from 'next';

/**
 * Page details for NexaVision pay pages. The root layout's are JHPS's, and a page
 * replaces each group it names, so all of these must be set for a texted link's
 * preview and the browser tab to say NexaVision Group.
 */
export function nexaPayMetadata(title: string, description: string): Metadata {
  const fullTitle = `${title} | NexaVision Group`;
  return {
    title: fullTitle,
    description,
    authors: [{ name: 'NexaVision Group' }],
    creator: 'NexaVision Group',
    keywords: null,
    alternates: null,
    openGraph: { title: fullTitle, description, siteName: 'NexaVision Group', type: 'website', url: 'https://pay.nexavisiongroup.com' },
    twitter: { card: 'summary', title: fullTitle, description },
    icons: { icon: [{ url: 'https://nexavisiongroup.com/favicon.ico' }], apple: [] },
    robots: { index: false, follow: false },
  };
}
