import { defineType, defineField } from 'sanity'

export const commercialPage = defineType({
  name: 'commercialPage',
  title: 'Commercial Page',
  type: 'document',
  fields: [
    // ─── Hero ───
    defineField({ name: 'heroHeadline', title: 'Hero Headline', type: 'string',
      initialValue: 'Your Properties Maintained. Your Turnovers Handled. Your Billing Simplified.',
      description: 'Main headline shown in the hero section.',
    }),
    defineField({ name: 'heroSubheadline', title: 'Hero Subheadline', type: 'text', rows: 2,
      initialValue: 'One vendor. Multiple services. One system for scheduling, estimates, and payments — built for property managers and investors.',
    }),

    // ─── Stats ───
    defineField({
      name: 'stats', title: 'Stats Bar', type: 'array',
      description: 'The 4 animated counters shown in the stats section.',
      of: [{
        type: 'object',
        fields: [
          { name: 'value', title: 'Number Value', type: 'number' },
          { name: 'suffix', title: 'Suffix (e.g. + or hr)', type: 'string' },
          { name: 'label', title: 'Label', type: 'string' },
        ],
        preview: { select: { title: 'label' } },
      }],
      initialValue: [
        { value: 500, suffix: '+', label: 'Jobs Completed' },
        { value: 5, suffix: '+', label: 'Service Categories' },
        { value: 24, suffix: 'hr', label: 'Turnover Availability' },
        { value: 100, suffix: '%', label: 'Satisfaction Rate' },
      ],
    }),

    // ─── Solutions (6 cards with images) ───
    defineField({
      name: 'solutions', title: 'Solutions (Service Cards)', type: 'array',
      description: 'The 6 service cards shown in the Solutions section. Upload real job photos here.',
      of: [{
        type: 'object',
        fields: [
          { name: 'icon', title: 'Icon (emoji)', type: 'string' },
          { name: 'title', title: 'Title', type: 'string' },
          { name: 'description', title: 'Description', type: 'text', rows: 3 },
          defineField({
            name: 'image', title: 'Photo (upload)', type: 'image',
            options: { hotspot: true },
            description: 'Upload a real job photo. This overrides the URL field below.',
          }),
          { name: 'imageUrl', title: 'Photo URL (fallback)', type: 'url',
            description: 'Paste a URL if not uploading. Uploaded photo takes priority.',
          },
        ],
        preview: {
          select: { title: 'title', media: 'image' },
        },
      }],
      initialValue: [
        { icon: '🔄', title: 'Property Turnovers', description: 'Complete turnover services including junk removal, deep cleaning, exterior wash, and curb appeal restoration. Get units rent-ready in 24–48 hours, not weeks.', imageUrl: 'https://images.pexels.com/photos/5463576/pexels-photo-5463576.jpeg?auto=compress&cs=tinysrgb&w=800' },
        { icon: '💧', title: 'Exterior Maintenance Programs', description: 'Scheduled pressure washing, soft washing, and surface cleaning for buildings, walkways, parking areas, and common spaces. Recurring or on-demand.', imageUrl: 'https://images.pexels.com/photos/4239031/pexels-photo-4239031.jpeg?auto=compress&cs=tinysrgb&w=800' },
        { icon: '🌿', title: 'Grounds & Lawn Maintenance', description: 'Comprehensive lawn care, landscaping maintenance, and grounds keeping for commercial properties, rental communities, and multi-unit portfolios.', imageUrl: 'https://images.pexels.com/photos/1453499/pexels-photo-1453499.jpeg?auto=compress&cs=tinysrgb&w=800' },
        { icon: '🚛', title: 'Junk Removal & Cleanouts', description: 'Tenant trash-outs, unit cleanouts, construction debris removal, and bulk haul-offs. Fast scheduling, clean execution, and proper disposal every time.', imageUrl: 'https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?auto=compress&cs=tinysrgb&w=800' },
        { icon: '🌳', title: 'Land Clearing & Lot Prep', description: 'Overgrown lot clearing, brush removal, and property prep for development, resale, or code compliance. Handle everything from small lots to multi-acre parcels.', imageUrl: 'https://images.pexels.com/photos/5997993/pexels-photo-5997993.jpeg?auto=compress&cs=tinysrgb&w=800' },
        { icon: '✨', title: 'Curb Appeal & Property Restoration', description: 'Full exterior refresh packages combining pressure washing, cleanup, lawn care, and debris removal to restore property value and first impressions.', imageUrl: 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=800' },
      ],
    }),

    // ─── CTA / Contact ───
    defineField({ name: 'ctaHeadline', title: 'CTA Headline', type: 'string',
      initialValue: 'Ready to Simplify Your Property Maintenance?',
    }),
    defineField({ name: 'ctaSubtext', title: 'CTA Subtext', type: 'text', rows: 2,
      initialValue: 'Join property managers across Central Florida who trust JHPS for reliable, system-backed maintenance services.',
    }),
    defineField({ name: 'contactEmail', title: 'Contact Email (Vendor Inquiry Form)', type: 'string',
      initialValue: 'info@jhpsfl.com',
    }),
  ],
  preview: { select: { title: 'heroHeadline' }, prepare: () => ({ title: 'Commercial Page' }) },
})
