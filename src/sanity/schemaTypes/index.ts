import { type SchemaTypeDefinition } from 'sanity'
import { siteSettings } from './siteSettings'
import { homePage } from './homePage'
import { service } from './service'
import { galleryItem } from './galleryItem'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [siteSettings, homePage, service, galleryItem],
}
