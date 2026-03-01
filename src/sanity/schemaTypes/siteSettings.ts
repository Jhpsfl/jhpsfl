import { defineType, defineField } from 'sanity'

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    defineField({ name: 'companyName', title: 'Company Name', type: 'string', initialValue: 'Jenkins Home & Property Solutions' }),
    defineField({ name: 'shortName', title: 'Short Name (Navbar)', type: 'string', initialValue: 'JHPS' }),
    defineField({ name: 'phone', title: 'Phone Number', type: 'string', initialValue: '4076869817' }),
    defineField({ name: 'email', title: 'Email Address', type: 'string', initialValue: 'Info@jhpsfl.com' }),

    // ─── Logo ───
    defineField({
      name: 'logo', title: 'Logo Image', type: 'image', options: { hotspot: false },
      description: 'Upload your logo. Works best as a PNG with transparent background.',
    }),
    defineField({
      name: 'logoMaxWidth', title: 'Logo Width (px) ← change this to resize', type: 'number', initialValue: 200,
      description: 'THIS controls the logo size. Bigger = larger logo. Default: 200. Try 250–450.',
      validation: (Rule) => Rule.min(60).max(600),
    }),
    defineField({
      name: 'logoMaxHeight', title: 'Logo Max Height (px)', type: 'number', initialValue: 60,
      description: 'Safety cap so logo does not overflow the navbar. Default: 60. Rarely needs changing.',
      validation: (Rule) => Rule.min(24).max(120),
    }),
    defineField({
      name: 'logoFit', title: 'Logo Fit', type: 'string', initialValue: 'contain',
      description: 'How the logo image fits its container.',
      options: {
        list: [
          { title: 'Contain (show full logo, recommended)', value: 'contain' },
          { title: 'Cover (fill space, may crop)', value: 'cover' },
          { title: 'Fill (stretch)', value: 'fill' },
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'logoPadding', title: 'Logo Padding (px)', type: 'number', initialValue: 0,
      description: 'Add padding around the logo if it looks too tight. Default: 0.',
      validation: (Rule) => Rule.min(0).max(24),
    }),

    // ─── Colors ───
    defineField({ name: 'primaryColor', title: 'Primary Color', type: 'color', initialValue: { hex: '#4CAF50' } }),
    defineField({ name: 'darkColor', title: 'Dark Accent Color', type: 'color', initialValue: { hex: '#2E7D32' } }),
    defineField({ name: 'backgroundColor', title: 'Background Color', type: 'color', initialValue: { hex: '#050e05' } }),

    // ─── Content ───
    defineField({ name: 'tagline', title: 'Tagline', type: 'string', initialValue: 'Your Property, Transformed.' }),
    defineField({
      name: 'serviceAreas', title: 'Service Areas', type: 'array', of: [{ type: 'string' }],
      initialValue: ['Deltona', 'Orlando', 'Sanford', 'DeLand', 'Daytona Beach'],
    }),
    defineField({
      name: 'stats', title: 'Stats', type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'value', title: 'Value (number)', type: 'number' },
          { name: 'suffix', title: 'Suffix (e.g. + or %)', type: 'string' },
          { name: 'label', title: 'Label', type: 'string' },
        ],
      }],
      initialValue: [
        { value: 500, suffix: '+', label: 'Jobs Completed' },
        { value: 100, suffix: '%', label: 'Satisfaction Rate' },
        { value: 24, suffix: 'hr', label: 'Fast Response' },
        { value: 5, suffix: '+', label: 'Services Offered' },
      ],
    }),
    defineField({
      name: 'trustItems', title: 'Trust Bar Items', type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'icon', title: 'Icon (emoji)', type: 'string' },
          { name: 'title', title: 'Title', type: 'string' },
          { name: 'description', title: 'Description', type: 'string' },
        ],
      }],
      initialValue: [
        { icon: '✓', title: 'Free Estimates', description: 'No obligation quotes for all services' },
        { icon: '⚡', title: 'Fast Scheduling', description: 'Quick turnaround, flexible availability' },
        { icon: '📍', title: 'Locally Owned', description: 'Based in the Deltona / Orlando area' },
        { icon: '🛡️', title: 'Reliable & Insured', description: 'Professional service you can trust' },
      ],
    }),
    defineField({
      name: 'footerAbout', title: 'Footer About Text', type: 'text',
      initialValue: "Central Florida's trusted partner for lawn care, pressure washing, junk removal, land clearing, and property cleanups.",
    }),
  ],
  preview: { select: { title: 'companyName' } },
})
