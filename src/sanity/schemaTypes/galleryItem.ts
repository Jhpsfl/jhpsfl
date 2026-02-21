import { defineType, defineField } from 'sanity'

export const galleryItem = defineType({
  name: 'galleryItem',
  title: 'Gallery Item',
  type: 'document',
  fields: [
    defineField({
      name: 'image',
      title: 'Gallery Image',
      type: 'image',
      options: { hotspot: true },
      description: 'Upload a project photo. If left blank, the URL below will be used.',
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
    defineField({ name: 'caption', title: 'Caption', type: 'string' }),
    defineField({
      name: 'tag',
      title: 'Category Tag',
      type: 'string',
      options: {
        list: [
          { title: 'Lawn Care', value: 'Lawn Care' },
          { title: 'Pressure Wash', value: 'Pressure Wash' },
          { title: 'Land Clearing', value: 'Land Clearing' },
          { title: 'Property Cleanup', value: 'Property Cleanup' },
        ],
      },
    }),
    defineField({ name: 'order', title: 'Sort Order', type: 'number', description: 'Lower numbers appear first.' }),
  ],
  preview: {
    select: { title: 'caption', subtitle: 'tag', media: 'image' },
  },
  orderings: [{ title: 'Sort Order', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }],
})
