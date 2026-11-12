'use client'

import { Loader2, RefreshCw, WifiOff } from 'lucide-react'

/**
 * Thin status strip for lists that render from the device's saved copy.
 *   refreshing → "Updating…"
 *   error      → "Couldn't refresh — showing saved copy" + Retry
 * Nothing is rendered when the data is fresh and idle.
 */
export default function RefreshBar({
  refreshing, error, savedAt, onRetry,
}: { refreshing: boolean; error: string | null; savedAt: number | null; onRetry: () => void }) {
  if (!refreshing && !error) return null
  return (
    <>
      <style>{'@keyframes jh-rb-spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', fontSize: 12,
        color: error ? '#FFB74D' : '#8ab88a',
      }}>
        {error ? <WifiOff size={13} /> : <Loader2 size={13} style={{ animation: 'jh-rb-spin 0.9s linear infinite' }} />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {error ? `Couldn't refresh — showing ${savedAt ? `copy from ${ago(savedAt)}` : 'saved copy'}` : 'Updating…'}
        </span>
        {error && (
          <button onClick={onRetry} style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#4CAF50', background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>
    </>
  )
}

function ago(t: number) {
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}
