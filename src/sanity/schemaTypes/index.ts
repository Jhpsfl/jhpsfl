import { type SchemaTypeDefinition } from 'sanity'
import { siteSettings } from './siteSettings'
import { homePage } from './homePage'
import { service } from './service'
import { galleryItem } from './galleryItem'
import { commercialPage } from './commercialPage'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [siteSettings, homePage, service, galleryItem, commercialPage],
}
