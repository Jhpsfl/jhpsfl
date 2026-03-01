'use client'

import { useEffect, useRef, useState } from 'react'

interface UploadedAsset {
  _id: string
  url: string
  filename: string
  uploadedAt: number
}

const STORAGE_KEY = 'sanity-uploads'

function loadHistory(): UploadedAsset[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveToHistory(asset: UploadedAsset) {
  const history = loadHistory()
  const updated = [asset, ...history].slice(0, 50)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export default function SanityUploadPage() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [latest, setLatest] = useState<UploadedAsset | null>(null)
  const [error, setError] = useState('')
  const [label, setLabel] = useState('')
  const [history, setHistory] = useState<UploadedAsset[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  async function handleFile(file: File) {
    setStatus('uploading')
    setError('')

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('label', label)

      const res = await fetch('/api/sanity-upload', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Upload failed')

      const asset: UploadedAsset = {
        _id: data._id,
        url: data.url,
        filename: data.filename,
        uploadedAt: Date.now(),
      }
      saveToHistory(asset)
      setLatest(asset)
      setHistory(loadHistory())
      setStatus('done')
      setLabel('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setStatus('error')
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY)
    setHistory([])
    setLatest(null)
  }

  const isUploading = status === 'uploading'

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0f0a', color: '#e8f5e8',
      fontFamily: 'system-ui, sans-serif', padding: '24px 16px', maxWidth: 520, margin: '0 auto'
    }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#4ade80' }}>
        Sanity Upload
      </h1>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>
        Upload images here first, then in Studio tap an image field →{' '}
        <strong style={{ color: '#9ca3af' }}>Select</strong> to pick from your library.
        Uploads are saved here even after refresh.
      </p>

      {/* Label */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
          Label (optional)
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

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {/* Upload button */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        style={{
          width: '100%', padding: '16px', background: isUploading ? '#374137' : '#16a34a',
          color: '#fff', border: 'none', borderRadius: 10, fontSize: 17,
          fontWeight: 600, cursor: isUploading ? 'default' : 'pointer',
          marginBottom: 20
        }}
      >
        {isUploading ? '⏳ Uploading...' : '📷 Choose Photo'}
      </button>

      {/* Error */}
      {status === 'error' && (
        <div style={{ background: '#2a0a0a', border: '1px solid #dc2626', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <p style={{ color: '#f87171', fontWeight: 700, marginBottom: 8 }}>❌ Upload failed</p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>{error}</p>
          <button onClick={() => setStatus('idle')} style={{
            padding: '10px 20px', background: '#1a2a1a', color: '#9ca3af',
            border: '1px solid #374137', borderRadius: 8, fontSize: 14, cursor: 'pointer'
          }}>
            Try Again
          </button>
        </div>
      )}

      {/* Latest upload */}
      {status === 'done' && latest && (
        <div style={{ background: '#0d2010', border: '1px solid #16a34a', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <p style={{ color: '#4ade80', fontWeight: 700, marginBottom: 10 }}>
            ✅ Uploaded! Now go to Studio → image field → <strong>Select</strong>
          </p>
          <img src={latest.url} alt="uploaded" style={{ width: '100%', borderRadius: 6, maxHeight: 160, objectFit: 'cover', marginBottom: 10 }} />
          <div
            onClick={() => copy(latest.url, 'latest-url')}
            style={{
              background: '#0a0f0a', padding: '8px 10px', borderRadius: 6,
              border: '1px solid #374137', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10
            }}
          >
            <span style={{ color: '#93c5fd', fontSize: 12, wordBreak: 'break-all' }}>{latest.url}</span>
            <span style={{ color: copied === 'latest-url' ? '#4ade80' : '#6b7280', fontSize: 11, marginLeft: 8, flexShrink: 0 }}>
              {copied === 'latest-url' ? '✓ copied' : 'tap to copy'}
            </span>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              width: '100%', padding: 12, background: '#16a34a',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer'
            }}
          >
            📷 Upload Another
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', margin: 0 }}>
              Uploaded ({history.length})
            </p>
            <button onClick={clearHistory} style={{
              background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', padding: 0
            }}>
              Clear all
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((asset) => (
              <div key={asset._id} style={{
                background: '#111811', border: '1px solid #2a3a2a', borderRadius: 8,
                padding: 10, display: 'flex', gap: 10, alignItems: 'center'
              }}>
                <img
                  src={asset.url}
                  alt={asset.filename}
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.filename}
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => copy(asset.url, asset._id + '-url')}
                      style={{
                        background: '#1a2a1a', border: '1px solid #374137', color: '#9ca3af',
                        borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer'
                      }}
                    >
                      {copied === asset._id + '-url' ? '✓ URL' : 'Copy URL'}
                    </button>
                    <button
                      onClick={() => copy(asset._id, asset._id + '-id')}
                      style={{
                        background: '#1a2a1a', border: '1px solid #374137', color: '#9ca3af',
                        borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer'
                      }}
                    >
                      {copied === asset._id + '-id' ? '✓ ID' : 'Copy ID'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && status === 'idle' && (
        <p style={{ fontSize: 12, color: '#2a3a2a', textAlign: 'center', marginTop: 40 }}>
          Uploads will appear here and persist across refreshes
        </p>
      )}
    </div>
  )
}
