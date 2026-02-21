/**
 * JHPS Sanity Seed Script v2 — stable image URLs
 * Run: node sanity-seed.mjs
 *
 * NOTE: After running this, also add 'images.pexels.com' to next.config.ts
 * remotePatterns (instructions at bottom of this file)
 */

import https from 'https'

const PROJECT_ID = 'fiublsi2'
const DATASET = 'production'
const TOKEN = 'skqfgPl4quJXhEd58tXDU8cRY6GRabiX7b3LI2tlUzpMYMTHqgpkybUHUPisHNI1x54NrKgzjPrYoFtvcGlxiEG2XrerY6GRKI8VTtRppWZ2KcIppec9bIJf9PtA5sIqVPBFJohalWOKKfohgZg7QwAHJgKWQSIkyphMP63ifCIgBLrZIeRK'

function sanityMutate(mutations) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ mutations })
    const options = {
      hostname: `${PROJECT_ID}.api.sanity.io`,
      path: `/v2026-02-21/data/mutate/${DATASET}?returnDocuments=false`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data))
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ─── Stable Pexels image URLs (permanent, never rotate) ───
// These use specific photo IDs so they will always show the same image.
// Pexels images are free for commercial use, no attribution required.
const services = [
  {
    _id: 'service-lawn-care',
    _type: 'service',
    title: 'Lawn Care',
    description: 'Mowing, edging, trimming, blowing & seasonal cleanups. Your yard, perfected every visit.',
    icon: '🌿',
    // Pexels: green lawn being mowed
    imageUrl: 'https://images.pexels.com/photos/1453499/pexels-photo-1453499.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 1,
  },
  {
    _id: 'service-pressure-washing',
    _type: 'service',
    title: 'Pressure Washing',
    description: 'High-pressure & soft wash for driveways, buildings, sidewalks & commercial properties.',
    icon: '💧',
    // Pexels: pressure washer on driveway
    imageUrl: 'https://images.pexels.com/photos/9681671/pexels-photo-9681671.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 2,
  },
  {
    _id: 'service-junk-removal',
    _type: 'service',
    title: 'Junk Removal',
    description: 'Fast, affordable haul-away for furniture, debris, appliances & construction waste.',
    icon: '🚛',
    // Pexels: truck hauling debris
    imageUrl: 'https://images.pexels.com/photos/4108715/pexels-photo-4108715.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 3,
  },
  {
    _id: 'service-land-clearing',
    _type: 'service',
    title: 'Land Clearing',
    description: 'Brush removal, lot clearing & grading for residential and commercial properties.',
    icon: '🌲',
    // Pexels: open land / field clearing
    imageUrl: 'https://images.pexels.com/photos/296234/pexels-photo-296234.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 4,
  },
  {
    _id: 'service-property-cleanups',
    _type: 'service',
    title: 'Property Cleanups',
    description: 'Vacant house cleanup, overgrown yards, plant removal & full property restoration.',
    icon: '🏠',
    // Pexels: clean residential property exterior
    imageUrl: 'https://images.pexels.com/photos/186077/pexels-photo-186077.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 5,
  },
]

const galleryItems = [
  {
    _id: 'gallery-commercial-pressure',
    _type: 'galleryItem',
    caption: 'Commercial Pressure Washing',
    tag: 'Pressure Wash',
    imageUrl: 'https://images.pexels.com/photos/9681671/pexels-photo-9681671.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 1,
  },
  {
    _id: 'gallery-lawn-maintenance',
    _type: 'galleryItem',
    caption: 'Professional Lawn Maintenance',
    tag: 'Lawn Care',
    imageUrl: 'https://images.pexels.com/photos/1453499/pexels-photo-1453499.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 2,
  },
  {
    _id: 'gallery-property-restoration',
    _type: 'galleryItem',
    caption: 'Full Property Restoration',
    tag: 'Property Cleanup',
    imageUrl: 'https://images.pexels.com/photos/186077/pexels-photo-186077.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 3,
  },
  {
    _id: 'gallery-land-clearing',
    _type: 'galleryItem',
    caption: 'Land Clearing & Grading',
    tag: 'Land Clearing',
    imageUrl: 'https://images.pexels.com/photos/296234/pexels-photo-296234.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 4,
  },
  {
    _id: 'gallery-exterior-cleaning',
    _type: 'galleryItem',
    caption: 'Residential Exterior Cleaning',
    tag: 'Pressure Wash',
    imageUrl: 'https://images.pexels.com/photos/7587924/pexels-photo-7587924.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 5,
  },
  {
    _id: 'gallery-yard-cleanup',
    _type: 'galleryItem',
    caption: 'Garden & Yard Cleanup',
    tag: 'Lawn Care',
    imageUrl: 'https://images.pexels.com/photos/1301856/pexels-photo-1301856.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
    imageFit: 'cover',
    imagePosition: 'center',
    order: 6,
  },
]

async function seed() {
  console.log('🌱 Seeding JHPS Sanity documents with stable Pexels images...\n')

  const allDocs = [...services, ...galleryItems]
  const mutations = allDocs.map(doc => ({ createOrReplace: doc }))

  console.log(`📦 Sending ${mutations.length} documents...`)
  allDocs.forEach(d => console.log(`   • ${d.title || d.caption}`))

  try {
    await sanityMutate(mutations)
    console.log('\n✅ SUCCESS! All documents updated with stable image URLs.')
    console.log('\n⚠️  IMPORTANT — also update next.config.ts:')
    console.log('   Add this to the remotePatterns array:\n')
    console.log(`   {
     protocol: "https",
     hostname: "images.pexels.com",
   },`)
    console.log('\n   Without this, Next.js will block the Pexels images.')
    console.log('   After adding it, commit and push to trigger a Vercel redeploy.')
    console.log('\n   Delete sanity-seed.mjs when done!')
  } catch (err) {
    console.error('\n❌ Failed:', err.message)
  }
}

seed()
