import { defineType, defineField } from 'sanity'

export const galleryItem = defineType({
  name: 'galleryItem',
  title: 'Gallery Item',
  type: 'document',
  fields: [
    defineField({ name: 'image', title: 'Image', type: 'image', options: { hotspot: true } }),
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
    defineField({ name: 'order', title: 'Sort Order', type: 'number' }),
  ],
  preview: {
    select: { title: 'caption', subtitle: 'tag', media: 'image' },
  },
  orderings: [{ title: 'Sort Order', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }],
})
