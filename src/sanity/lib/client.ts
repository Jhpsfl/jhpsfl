import { createClient } from 'next-sanity'

import { apiVersion, dataset, projectId } from '../env'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false, // Must be false for SanityLive / live content updates to work
  token: process.env.SANITY_API_READ_TOKEN, // Required for private datasets (staging)
})
