import { defineType, defineField } from 'sanity'

const imageControls = (prefix: string, stockUrl: string) => [
  defineField({
    name: `${prefix}Url`,
    title: 'Image URL (optional override)',
    type: 'url',
    description: `Paste a URL instead of uploading. Uploaded image takes priority. Current stock fallback: ${stockUrl}`,
  }),
  defineField({
    name: `${prefix}Fit`,
    title: 'Image Fit',
    type: 'string',
    initialValue: 'cover',
    options: {
      list: [
        { title: 'Cover (fill, may crop)', value: 'cover' },
        { title: 'Contain (show full image)', value: 'contain' },
        { title: 'Fill (stretch)', value: 'fill' },
      ],
      layout: 'radio',
    },
  }),
  defineField({
    name: `${prefix}Position`,
    title: 'Image Position',
    type: 'string',
    initialValue: 'center',
    options: {
      list: [
        { title: 'Center', value: 'center' },
        { title: 'Top', value: 'top' },
        { title: 'Bottom', value: 'bottom' },
        { title: 'Left', value: 'left' },
        { title: 'Right', value: 'right' },
      ],
      layout: 'radio',
    },
  }),
]

export const homePage = defineType({
  name: 'homePage',
  title: 'Home Page',
  type: 'document',
  fields: [
    // ─── Hero ───
    defineField({ name: 'heroHeadline', title: 'Hero Headline', type: 'string', initialValue: 'Your Property,' }),
    defineField({ name: 'heroHighlight', title: 'Hero Highlight Text (gradient)', type: 'string', initialValue: 'Transformed.' }),
    defineField({
      name: 'heroDescription', title: 'Hero Description', type: 'text',
      initialValue: 'From lawn care to land clearing, pressure washing to junk removal — Jenkins Home & Property Solutions handles it all. Serving the Deltona, Orlando & Central Florida area.',
    }),
    defineField({
      name: 'heroImage', title: 'Hero Image', type: 'image', options: { hotspot: true },
      description: 'Main image shown in the hero section. Upload or use URL below.',
    }),
    ...imageControls('hero', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=700&h=500&fit=crop'),

    // ─── Promo Featured ───
    defineField({
      name: 'promoFeaturedImage', title: 'Promo Featured Image', type: 'image', options: { hotspot: true },
      description: 'Left banner image (gold border). Upload or use URL below.',
    }),
    ...imageControls('promoFeatured', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=400&fit=crop'),
    defineField({
      name: 'promoFeaturedHeight', title: 'Promo Featured Banner Height (px)', type: 'number',
      initialValue: 320,
      description: 'Height of the featured banner in pixels. Default: 320.',
      validation: (Rule) => Rule.min(200).max(600),
    }),
    defineField({ name: 'promoFeaturedHeadline', title: 'Promo Featured Headline', type: 'string', initialValue: 'Commercial Pressure Washing' }),
    defineField({ name: 'promoFeaturedTag', title: 'Promo Featured Tag', type: 'string', initialValue: 'FEATURED SERVICE' }),
    defineField({
      name: 'promoFeaturedSubtext', title: 'Promo Featured Subtext', type: 'text',
      initialValue: 'Gas stations, storefronts, driveways & more. Day or night service available.',
    }),

    // ─── Promo Secondary ───
    defineField({
      name: 'promoSecondaryImage', title: 'Promo Secondary Image', type: 'image', options: { hotspot: true },
      description: 'Right banner image (green border). Upload or use URL below.',
    }),
    ...imageControls('promoSecondary', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=400&fit=crop'),
    defineField({
      name: 'promoSecondaryHeight', title: 'Promo Secondary Banner Height (px)', type: 'number',
      initialValue: 320,
      description: 'Height of the secondary banner in pixels. Default: 320.',
      validation: (Rule) => Rule.min(200).max(600),
    }),
    defineField({ name: 'promoSecondaryHeadline', title: 'Promo Secondary Headline', type: 'string', initialValue: 'Land Clearing & Lot Prep' }),
    defineField({ name: 'promoSecondaryTag', title: 'Promo Secondary Tag', type: 'string', initialValue: 'LAND SERVICES' }),
    defineField({
      name: 'promoSecondarySubtext', title: 'Promo Secondary Subtext', type: 'text',
      initialValue: 'Brush removal, grading & clearing for residential or commercial projects.',
    }),

    // ─── How It Works Steps ───
    defineField({
      name: 'steps',
      title: 'How It Works Steps',
      type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'num', title: 'Step Number (e.g. 01)', type: 'string' },
          { name: 'title', title: 'Step Title', type: 'string' },
          { name: 'desc', title: 'Step Description', type: 'text' },
          { name: 'icon', title: 'Icon (emoji)', type: 'string' },
        ],
      }],
      initialValue: [
        { num: '01', title: 'Call or Text', desc: 'Reach us at 407-686-9817. We respond fast.', icon: '📱' },
        { num: '02', title: 'Free Estimate', desc: 'We assess your property and give you an honest quote.', icon: '📋' },
        { num: '03', title: 'We Do The Work', desc: 'Our crew shows up on time and gets it done right.', icon: '💪' },
        { num: '04', title: 'You Enjoy', desc: 'Sit back and enjoy your clean, beautiful property.', icon: '✨' },
      ],
    }),

    // ─── Big CTA ───
    defineField({ name: 'bigCtaHeadline', title: 'Big CTA Headline', type: 'string', initialValue: 'Ready to Transform Your Property?' }),
    defineField({
      name: 'bigCtaDescription', title: 'Big CTA Description', type: 'text',
      initialValue: 'One call is all it takes. Get a free estimate today and see why Central Florida trusts Jenkins Home & Property Solutions.',
    }),
  ],
  preview: { select: { title: 'heroHeadline' } },
})
