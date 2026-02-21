import { defineType, defineField } from 'sanity'

export const service = defineType({
  name: 'service',
  title: 'Service',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Service Title', type: 'string' }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
    defineField({ name: 'icon', title: 'Icon (emoji)', type: 'string' }),
    defineField({
      name: 'image',
      title: 'Service Image',
      type: 'image',
      options: { hotspot: true },
      description: 'Upload a photo for this service. If left blank, the URL below will be used.',
    }),
    defineField({
      name: 'imageUrl',
      title: 'Image URL (optional override)',
      type: 'url',
      description: 'Paste a direct image URL here instead of uploading. Uploaded image above takes priority.',
    }),
    defineField({
      name: 'imageFit',
      title: 'Image Fit',
      type: 'string',
      description: 'How the image fills its space.',
      initialValue: 'cover',
      options: {
        list: [
          { title: 'Cover (fill, may crop)', value: 'cover' },
          { title: 'Contain (show full image, may letterbox)', value: 'contain' },
          { title: 'Fill (stretch to fit)', value: 'fill' },
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'imagePosition',
      title: 'Image Position',
      type: 'string',
      description: 'Which part of the image to focus on when cropping.',
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
    defineField({ name: 'order', title: 'Sort Order', type: 'number', description: 'Lower numbers appear first. Use 1, 2, 3, 4, 5.' }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'description', media: 'image' },
  },
  orderings: [{ title: 'Sort Order', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }],
})
