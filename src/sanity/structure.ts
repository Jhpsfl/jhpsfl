import type { StructureResolver } from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Site Settings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
      S.listItem()
        .title('Home Page')
        .child(S.document().schemaType('homePage').documentId('homePage')),
      S.divider(),
      S.documentTypeListItem('service').title('Services'),
      S.documentTypeListItem('galleryItem').title('Gallery'),
      S.divider(),
      S.listItem()
        .title('Commercial Page')
        .child(S.document().schemaType('commercialPage').documentId('commercialPage')),
    ])
