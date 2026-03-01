import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const label = (formData.get('label') as string) || ''

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const token = process.env.SANITY_API_TOKEN || process.env.SANITY_API_READ_TOKEN
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

    if (!token || !projectId) {
      return NextResponse.json({ error: 'Missing Sanity credentials' }, { status: 500 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const filename = label
      ? `${label.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.${file.name.split('.').pop()}`
      : file.name

    const uploadRes = await fetch(
      `https://${projectId}.api.sanity.io/v2024-01-01/assets/images/${dataset}?filename=${encodeURIComponent(filename)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type,
        },
        body: buffer,
      }
    )

    const result = await uploadRes.json()

    if (!uploadRes.ok) {
      return NextResponse.json({ error: result?.error?.description || 'Upload failed' }, { status: 500 })
    }

    const asset = result.document
    return NextResponse.json({
      success: true,
      _id: asset._id,
      url: asset.url,
      filename: asset.originalFilename,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
