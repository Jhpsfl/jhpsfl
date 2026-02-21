import { defineQuery } from 'next-sanity'

export const SITE_SETTINGS_QUERY = defineQuery(`
  *[_type == "siteSettings"][0]{
    companyName, shortName, phone, email,
    logo,
    logoMaxWidth,
    primaryColor, darkColor, backgroundColor,
    tagline, serviceAreas, stats, trustItems, footerAbout
  }
`)

export const HOME_PAGE_QUERY = defineQuery(`
  *[_type == "homePage"][0]{
    heroHeadline, heroHighlight, heroDescription,
    heroImage,
    promoFeaturedImage, promoFeaturedHeadline, promoFeaturedTag, promoFeaturedSubtext,
    promoSecondaryImage, promoSecondaryHeadline, promoSecondaryTag, promoSecondarySubtext,
    steps,
    bigCtaHeadline, bigCtaDescription
  }
`)

export const SERVICES_QUERY = defineQuery(`
  *[_type == "service"] | order(order asc){
    _id, title, description, icon, order,
    image
  }
`)

export const GALLERY_QUERY = defineQuery(`
  *[_type == "galleryItem"] | order(order asc){
    _id, caption, tag, order,
    image
  }
`)
