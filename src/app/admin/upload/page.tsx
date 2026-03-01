'use client'

import { useRef, useState } from 'react'

export default function SanityUploadPage() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ url: string; _id: string; filename: string } | null>(null)
  const [error, setError] = useState('')
  const [label, setLabel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setStatus('uploading')
    setResult(null)
    setError('')

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('label', label)

      const res = await fetch('/api/sanity-upload', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResult(data)
      setStatus('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setStatus('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0f0a', color: '#e8f5e8',
      fontFamily: 'system-ui, sans-serif', padding: '24px 16px', maxWidth: 480, margin: '0 auto'
    }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#4ade80' }}>
        Upload to Sanity
      </h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        Select a photo — it uploads immediately and gives you the asset ID to paste into Studio.
      </p>

      {/* Optional label */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
          Label (optional — helps name the file)
        </label>
        <input
          type="text"
          placeholder="e.g. commercial-hero"
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', background: '#1a2a1a',
            border: '1px solid #374137', borderRadius: 8, color: '#e8f5e8',
            fontSize: 15, boxSizing: 'border-box'
          }}
        />
      </div>

      {/* File input — hidden, triggered by button */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      {/* Upload button */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === 'uploading'}
        style={{
          width: '100%', padding: '16px', background: status === 'uploading' ? '#374137' : '#16a34a',
          color: '#fff', border: 'none', borderRadius: 10, fontSize: 17,
          fontWeight: 600, cursor: status === 'uploading' ? 'default' : 'pointer',
          marginBottom: 24
        }}
      >
        {status === 'uploading' ? '⏳ Uploading...' : '📷 Choose Photo'}
      </button>

      {/* Success */}
      {status === 'done' && result && (
        <div style={{ background: '#14290a', border: '1px solid #16a34a', borderRadius: 10, padding: 16 }}>
          <p style={{ color: '#4ade80', fontWeight: 700, marginBottom: 12 }}>✅ Uploaded!</p>

          {/* Preview */}
          <img
            src={result.url}
            alt="uploaded"
            style={{ width: '100%', borderRadius: 8, marginBottom: 12, maxHeight: 220, objectFit: 'cover' }}
          />

          <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Asset ID (paste into Studio):</p>
          <div
            onClick={() => navigator.clipboard?.writeText(result._id)}
            style={{
              background: '#0a0f0a', padding: '10px 12px', borderRadius: 6,
              fontSize: 12, wordBreak: 'break-all', color: '#86efac',
              border: '1px solid #374137', cursor: 'pointer', marginBottom: 12
            }}
          >
            {result._id}
            <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 8 }}>(tap to copy)</span>
          </div>

          <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Direct URL:</p>
          <div
            onClick={() => navigator.clipboard?.writeText(result.url)}
            style={{
              background: '#0a0f0a', padding: '10px 12px', borderRadius: 6,
              fontSize: 12, wordBreak: 'break-all', color: '#93c5fd',
              border: '1px solid #374137', cursor: 'pointer', marginBottom: 16
            }}
          >
            {result.url}
            <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 8 }}>(tap to copy)</span>
          </div>

          <button
            onClick={() => { setStatus('idle'); setResult(null); setLabel('') }}
            style={{
              width: '100%', padding: 12, background: '#1a2a1a',
              color: '#9ca3af', border: '1px solid #374137', borderRadius: 8,
              fontSize: 15, cursor: 'pointer'
            }}
          >
            Upload Another
          </button>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ background: '#2a0a0a', border: '1px solid #dc2626', borderRadius: 10, padding: 16 }}>
          <p style={{ color: '#f87171', fontWeight: 700, marginBottom: 8 }}>❌ Upload failed</p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>{error}</p>
          <button
            onClick={() => setStatus('idle')}
            style={{
              padding: '10px 20px', background: '#1a2a1a', color: '#9ca3af',
              border: '1px solid #374137', borderRadius: 8, fontSize: 14, cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
